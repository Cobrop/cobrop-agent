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
agent.post('/cron/:capability', verifyCron, async (c) => {
  const capability = c.req.param('capability') as CapabilityName;
  if (!listCapabilities().includes(capability)) {
    return c.json({ error: 'unknown capability' }, 400);
  }

  // The cron job picks the inputs to enqueue. Examples:
  if (capability === 'price-suggest') {
    // Find stale listings
    const { data } = await supabase()
      .from('properties')
      .select('id')
      .lt('listed_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .eq('inquiries_count', 0)
      .limit(50);
    const enqueued: string[] = [];
    for (const row of data ?? []) {
      const { data: t } = await supabase()
        .from('agent_tasks')
        .insert({ capability, input: { property_id: row.id }, dedup_key: `price:${row.id}:${new Date().toISOString().slice(0, 10)}` })
        .select('id')
        .single();
      if (t) enqueued.push(t.id);
    }
    return c.json({ enqueued: enqueued.length });
  }

  if (capability === 'nudge-broker') {
    // Find brokers with stale leads (assumes a view)
    const { data } = await supabase()
      .from('brokers_with_stale_leads')
      .select('broker_id')
      .limit(100);
    let n = 0;
    for (const row of data ?? []) {
      await supabase().from('agent_tasks').insert({
        capability,
        input: { broker_id: row.broker_id },
        dedup_key: `nudge:${row.broker_id}:${new Date().toISOString().slice(0, 10)}`,
      });
      n++;
    }
    return c.json({ enqueued: n });
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
