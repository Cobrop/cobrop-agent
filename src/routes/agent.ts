// src/routes/agent.ts — generic agent endpoints (manual triggers, draft text)

import { Hono } from 'hono';
import { supabase, appendAction } from '../db/supabase.js';
import { llm } from '../llm/client.js';
import { SYSTEM_VOICE } from '../llm/prompts.js';
import { verifyAdmin, verifyCron } from '../middleware/auth.js';
import { listCapabilities } from '../capabilities/index.js';
import type { CapabilityName } from '../types.js';

export const agent = new Hono();

// ── List available capabilities (public) ─────────────────────────
agent.get('/capabilities', (c) => {
  return c.json({ capabilities: listCapabilities() });
});

// ── Generic LLM "draft" endpoint used by the admin console's
//    `claude.complete` replacement ─────────────────────────────────
agent.post('/draft', verifyAdmin, async (c) => {
  const body = await c.req.json<{ prompt: string; system?: string; max_tokens?: number; temperature?: number; json?: boolean }>();
  if (!body.prompt) return c.json({ error: 'prompt required' }, 400);
  const resp = await llm({
    prompt: body.prompt,
    system: body.system ?? SYSTEM_VOICE,
    maxTokens: body.max_tokens ?? 1024,
    temperature: body.temperature ?? 0.4,
    json: body.json,
  });
  return c.json({
    text: resp.text,
    provider: resp.provider,
    model: resp.model,
    tokens_in: resp.tokensIn,
    tokens_out: resp.tokensOut,
    latency_ms: resp.latencyMs,
  });
});

// ── Manually enqueue any capability ──────────────────────────────
//
// Admin-triggered runs are interactive (console "draft" buttons) —
// process immediately via runTask() instead of leaving it for the next
// scheduled cron tick, which could be up to 24h away.
agent.post('/run', verifyAdmin, async (c) => {
  const body = await c.req.json<{ capability: CapabilityName; input: Record<string, unknown> }>();
  if (!listCapabilities().includes(body.capability)) {
    return c.json({ error: 'unknown capability' }, 400);
  }
  const { data: task, error } = await supabase()
    .from('agent_tasks')
    .insert({ capability: body.capability, input: body.input })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);

  const { runTask } = await import('../queue/worker.js');
  const result = await runTask(task);
  return c.json({ enqueued: true, task_id: task.id, ...result });
});

// ── Feed for a capability: recent executed actions + pending approvals ──
async function capabilityFeed(capability: string) {
  const { data: executed } = await supabase()
    .from('agent_actions')
    .select('id, status, ref_entity, duration_ms, details, created_at')
    .eq('capability', capability)
    .in('status', ['approved-executed', 'auto-completed'])
    .order('created_at', { ascending: false })
    .limit(20);
  const { data: pending } = await supabase()
    .from('agent_approvals')
    .select('*')
    .eq('capability', capability)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return { executed: executed ?? [], pending_approvals: pending ?? [] };
}

agent.get('/blog/feed', verifyAdmin, async (c) => c.json(await capabilityFeed('blog-draft')));
agent.get('/marketing/feed', verifyAdmin, async (c) => c.json(await capabilityFeed('social-post')));

// ── Real blog posts, and the publish step ────────────────────────
//
// blog-draft.execute() always inserts status:'draft' and never sets
// published_at, so approving the capability only produces a draft. Publishing
// is a separate, deliberate act — these two endpoints are what makes the
// console's Publish button actually publish something.
agent.get('/blog/posts', verifyAdmin, async (c) => {
  const status = c.req.query('status');
  let q = supabase()
    .from('blog_posts')
    // `content` is included so the console can show the real body for review
    // before publishing — that review is the whole point of the draft step.
    .select('id, title, slug, excerpt, content, category, status, author_name, reading_time, views_count, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(c.req.query('limit')) || 25, 100));
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ posts: data ?? [] });
});

agent.post('/blog/posts/:id/publish', verifyAdmin, async (c) => {
  const id = c.req.param('id');

  // Read first so "already published" and "no such post" are distinguishable
  // from a silent no-op update.
  const { data: existing, error: readErr } = await supabase()
    .from('blog_posts')
    .select('id, title, status')
    .eq('id', id)
    .maybeSingle();
  if (readErr) return c.json({ error: readErr.message }, 500);
  if (!existing) return c.json({ error: 'post not found' }, 404);
  if (existing.status === 'published') {
    return c.json({ error: 'already published', post: existing }, 409);
  }

  const { data, error } = await supabase()
    .from('blog_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, title, slug, status, published_at')
    .single();
  if (error) return c.json({ error: error.message }, 500);

  await appendAction({
    capability: 'blog-draft',
    autonomy: 'approve',
    status: 'approved-executed',
    ref_entity: data.slug || data.id,
    details: { action: 'publish', post_id: data.id, title: data.title, published_at: data.published_at },
  });

  return c.json({ post: data });
});

// ── Cron-triggered batch runs (called by GitHub Actions or Vercel cron) ──
//
// Special endpoint: /agent/cron/tick drains a few pending tasks from the
// queue. Vercel cron hits this every minute to keep the agent moving in
// serverless deploys (where the in-process worker can't run between requests).
// Vercel cron jobs always use GET — support both GET and POST for flexibility.
agent.on(['GET', 'POST'], '/cron/tick', verifyCron, async (c) => {
  const max = Math.min(Number(c.req.query('max')) || 5, 20);
  const { drainOnce } = await import('../queue/worker.js');
  const result = await drainOnce(max);
  return c.json({ drained: result.processed, queued_remaining: result.queued });
});

// Batch enqueue by capability (one row per stale listing, etc).
//
// Every query below checks its `error`. This used to destructure only `data`,
// so a failed query fell through `data ?? []`, enqueued nothing, and returned
// {"enqueued":0} with a 200 — indistinguishable from "nothing to do". Two of
// the three daily crons were querying objects that don't exist in this database
// (`brokers_with_stale_leads`, `properties.listed_at`) and reported success
// every day while the agent did nothing.
agent.post('/cron/:capability', verifyCron, async (c) => {
  const capability = c.req.param('capability') as CapabilityName;
  if (!listCapabilities().includes(capability)) {
    return c.json({ error: 'unknown capability' }, 400);
  }

  const sb = supabase();
  const today = new Date().toISOString().slice(0, 10);

  // Ceiling on rows enqueued per run. agent_config.daily_cap is loaded by
  // loadAgentConfig() but never read again anywhere, so nothing else limits how
  // many tasks a cohort query can turn into LLM calls. ~674 listings currently
  // match the price-suggest filter; without this they would all enqueue at once.
  //
  // The default is deliberately matched to how fast the queue actually drains:
  // vercel.json runs /agent/cron/tick?max=5 once a day, and drainOnce() processes
  // tasks sequentially inside one serverless invocation, so the function timeout
  // — not this number — is the real throughput ceiling. Enqueueing more per day
  // than the tick can drain just grows agent_tasks forever. Raise both together.
  const MAX_ENQUEUE = Math.min(Number(c.req.query('max')) || 5, 100);

  // Property/broker ids this capability has already been queued for, so each run
  // advances through the backlog instead of re-picking the same oldest rows every
  // day (dedup_key only dedups within a single day).
  async function alreadyQueued(field: 'property_id' | 'broker_id'): Promise<Set<string>> {
    const { data, error } = await sb
      .from('agent_tasks')
      .select('input')
      .eq('capability', capability)
      .limit(5000);
    if (error) throw new Error(`agent_tasks lookup failed: ${error.message}`);
    return new Set(
      (data ?? [])
        .map((t) => (t.input as Record<string, string> | null)?.[field])
        .filter((v): v is string => Boolean(v)),
    );
  }

  async function enqueueAll(rows: Record<string, string>[], key: (r: Record<string, string>) => string) {
    const ids: string[] = [];
    for (const input of rows) {
      const { data, error } = await sb
        .from('agent_tasks')
        .insert({ capability, input, dedup_key: key(input) })
        .select('id')
        .single();
      // A duplicate dedup_key means this row was already queued today — expected,
      // not a failure. Anything else is real and worth surfacing.
      if (error && error.code !== '23505') {
        throw new Error(`agent_tasks insert failed: ${error.message}`);
      }
      if (data) ids.push(data.id);
    }
    return ids;
  }

  try {
    if (capability === 'price-suggest') {
      // Stale listing = still active, listed over 7 days ago, no inquiries yet.
      // `properties.listed_at` and `properties.inquiries_count` do not exist on
      // this schema — the real columns are `created_at` and a separate
      // `inquiries` table keyed by property_id.
      const staleBefore = new Date(Date.now() - 7 * 86400000).toISOString();

      // Oldest-first, and the window has to reach past everything already queued —
      // a fixed window would be fully consumed after a few weeks of runs and then
      // return nothing while hundreds of listings still waited.
      const seen = await alreadyQueued('property_id');
      const { data: props, error: propErr } = await sb
        .from('properties')
        .select('id')
        .eq('status', 'active')
        .lt('created_at', staleBefore)
        .order('created_at', { ascending: true })
        .limit(Math.min(seen.size + MAX_ENQUEUE * 20, 2000));
      if (propErr) return c.json({ error: `properties query failed: ${propErr.message}` }, 500);

      const ids = (props ?? []).map((p) => p.id as string);

      // Pull the inquiry side whole rather than probing with .in(candidateIds):
      // `inquiries` is orders of magnitude smaller than `properties`, and a few
      // hundred uuids in an .in() filter overruns the PostgREST request URL and
      // fails the request outright.
      const { data: inq, error: inqErr } = await sb
        .from('inquiries')
        .select('property_id')
        .limit(10000);
      if (inqErr) return c.json({ error: `inquiries query failed: ${inqErr.message}` }, 500);
      const contacted = new Set((inq ?? []).map((i) => i.property_id));

      const targets = ids
        .filter((id) => !contacted.has(id) && !seen.has(id))
        .slice(0, MAX_ENQUEUE);

      const enqueued = await enqueueAll(
        targets.map((property_id) => ({ property_id })),
        (r) => `price:${r.property_id}:${today}`,
      );
      return c.json({ enqueued: enqueued.length, candidates: ids.length, skipped_already_queued: seen.size });
    }

    if (capability === 'nudge-broker') {
      // The `brokers_with_stale_leads` view this read does not exist (Postgres
      // 42P01) and the error was discarded. Derive the cohort here using the same
      // window nudge-broker.reason() applies — unanswered inquiries between 18h
      // and 7 days old — so we never queue a broker whose reason() would
      // immediately come back with "0 stale leads".
      const windowStart = new Date(Date.now() - 7 * 86400000).toISOString();
      const windowEnd = new Date(Date.now() - 18 * 3600000).toISOString();
      const { data: inq, error: inqErr } = await sb
        .from('inquiries')
        .select('property_id')
        .neq('status', 'responded')
        .gt('created_at', windowStart)
        .lt('created_at', windowEnd)
        .limit(1000);
      if (inqErr) return c.json({ error: `inquiries query failed: ${inqErr.message}` }, 500);

      // Capped for the same reason as above — this feeds an .in() filter, and the
      // request URL has a finite length.
      const propIds = [...new Set((inq ?? []).map((i) => i.property_id as string).filter(Boolean))]
        .slice(0, 200);
      // Inquiries reach a broker through the listing — there is no
      // inquiries.assigned_broker_id column.
      const { data: props, error: propErr } = propIds.length
        ? await sb.from('properties').select('broker_id').in('id', propIds)
        : { data: [] as { broker_id: string }[], error: null };
      if (propErr) return c.json({ error: `properties query failed: ${propErr.message}` }, 500);

      const brokerIds = [...new Set((props ?? []).map((p) => p.broker_id as string).filter(Boolean))]
        .slice(0, MAX_ENQUEUE);

      const enqueued = await enqueueAll(
        brokerIds.map((broker_id) => ({ broker_id })),
        (r) => `nudge:${r.broker_id}:${today}`,
      );
      return c.json({ enqueued: enqueued.length, stale_inquiries: (inq ?? []).length });
    }

    if (capability === 'broker-outreach') {
      // Previously fell through to the "no batch logic configured" branch, so the
      // 06:30 cron has never enqueued anything. Cohort: brokers with at least one
      // active listing who haven't been sent outreach before. There is no 'broker'
      // value in profiles.role (only 'user' and 'admin'), so ownership of an
      // active listing is what identifies a broker here.
      const { data: props, error: propErr } = await sb
        .from('properties')
        .select('broker_id')
        .eq('status', 'active')
        .not('broker_id', 'is', null)
        .limit(2000);
      if (propErr) return c.json({ error: `properties query failed: ${propErr.message}` }, 500);

      // Drop brokers already queued *before* capping, otherwise the cap would
      // stall on the same contacted prefix once the cohort outgrows it.
      const seen = await alreadyQueued('broker_id');
      const brokerIds = [...new Set((props ?? []).map((p) => p.broker_id as string).filter(Boolean))]
        .filter((id) => !seen.has(id))
        .slice(0, 200); // bounded for the .in() filter below — request URLs are finite
      const { data: profiles, error: profErr } = brokerIds.length
        ? await sb.from('profiles').select('id, is_blocked, email').in('id', brokerIds)
        : { data: [] as { id: string; is_blocked: boolean | null; email: string | null }[], error: null };
      if (profErr) return c.json({ error: `profiles query failed: ${profErr.message}` }, 500);

      const targets = (profiles ?? [])
        .filter((p) => p.is_blocked !== true)
        .map((p) => p.id)
        .slice(0, MAX_ENQUEUE);

      const enqueued = await enqueueAll(
        targets.map((broker_id) => ({ broker_id })),
        (r) => `outreach:${r.broker_id}:${today}`,
      );
      return c.json({ enqueued: enqueued.length, remaining_uncontacted: brokerIds.length, skipped_already_queued: seen.size });
    }
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  return c.json({ enqueued: 0, message: `No batch logic configured for ${capability}` });
});

// ── KPIs for the admin console ───────────────────────────────────
agent.get('/kpis', verifyAdmin, async (c) => {
  const { data: today } = await supabase().from('agent_kpis_today').select('*').maybeSingle();
  const { data: byCapability } = await supabase().from('agent_capability_stats').select('*');
  return c.json({ today, by_capability: byCapability });
});

// ── Recent activity (the live feed in Mission Control) ───────────
agent.get('/activity', verifyAdmin, async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
  const { data, error } = await supabase()
    .from('agent_actions')
    .select('id, capability, status, ref_entity, duration_ms, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ events: data });
});

// ── Broker recruitment: prospects (brokers not yet on CoBrop) ────
//
// No sourcing pipeline exists — no scraping, no LinkedIn Search API,
// no purchased list. Rows are added here manually (console form, or
// direct calls) and the agent only ever drafts/sends to what's added;
// it never invents or looks up prospects itself.
agent.get('/prospects', verifyAdmin, async (c) => {
  const status = c.req.query('status');
  let q = supabase().from('broker_prospects').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ prospects: data });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

agent.post('/prospects', verifyAdmin, async (c) => {
  const body = await c.req.json<{
    full_name: string; company?: string; location?: string; country?: string;
    email?: string; linkedin_url?: string; phone?: string; language?: string;
    source?: string; notes?: string; fit_score?: number;
  }>();
  if (!body.full_name) return c.json({ error: 'full_name required' }, 400);
  if (body.email && !EMAIL_RE.test(body.email)) {
    return c.json({ error: `"${body.email}" doesn't look like a valid email address` }, 400);
  }
  const { data, error } = await supabase()
    .from('broker_prospects')
    .insert({ ...body, source: body.source || 'manual' })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ prospect: data });
});
