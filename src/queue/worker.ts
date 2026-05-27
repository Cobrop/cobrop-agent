// src/queue/worker.ts — polls agent_tasks for pending work, dispatches.
//
// This is the heart of the agent. It runs alongside the HTTP server.
// Pure Postgres polling (no Redis) — works fine up to ~1k tasks/min.

import { supabase, loadAgentConfig, nextApprovalId, appendAction } from '../db/supabase.js';
import { getCapability } from '../capabilities/index.js';
import { routeAction, explainRouting } from './router.js';
import { config } from '../config.js';
import type { AgentTask } from '../types.js';

let running = false;
let inflight = 0;

export function startWorker() {
  if (running) return;
  running = true;
  console.log(`✓ Queue worker: polling every ${config.QUEUE_POLL_MS}ms (concurrency=${config.QUEUE_CONCURRENCY})`);
  loop();
}

export function stopWorker() {
  running = false;
}

async function loop() {
  while (running) {
    try {
      while (inflight < config.QUEUE_CONCURRENCY) {
        const task = await claimNextTask();
        if (!task || !task.id) break;
        inflight++;
        // Fire-and-forget; track inflight via counter
        runTask(task).finally(() => { inflight--; });
      }
    } catch (err) {
      console.error('[worker] loop error:', err);
    }
    await sleep(config.QUEUE_POLL_MS);
  }
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

// ── Claim a task atomically by flipping pending → running ────────
async function claimNextTask(): Promise<AgentTask | null> {
  const sb = supabase();
  // Use a Postgres RPC for atomic SKIP LOCKED — falls back to update+returning
  const { data, error } = await sb.rpc('claim_next_agent_task');
  if (error) {
    // Fallback if RPC isn't installed yet
    if (!/function .* does not exist/i.test(error.message)) {
      throw error;
    }
    const { data: rows } = await sb
      .from('agent_tasks')
      .update({ status: 'running', started_at: new Date().toISOString(), attempts: 1 })
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .select()
      .maybeSingle();
    return rows as AgentTask | null;
  }
  return data as AgentTask | null;
}

// ── Run a single task end-to-end ─────────────────────────────────
async function runTask(task: AgentTask) {
  const t0 = Date.now();
  const cap = getCapability(task.capability);
  if (!cap) {
    await failTask(task, `Unknown capability: ${task.capability}`);
    return;
  }
  const cfg = await loadAgentConfig(task.capability);
  console.log(`[task ${task.id.slice(0, 8)}] ${task.capability} · autonomy=${cfg.autonomy}`);

  try {
    // 1. REASON: let the capability think about the input
    const result = await cap.reason(task.input);
    const routing = routeAction(cfg.autonomy, result);

    // 2. ROUTE: auto-execute or queue for approval
    if (routing === 'auto') {
      const exec = await cap.execute(task.input, result.proposal);
      if (!exec.ok) {
        await failTask(task, `Execute failed: ${exec.error}`);
        return;
      }
      await appendAction({
        task_id: task.id,
        capability: task.capability,
        autonomy: cfg.autonomy,
        status: 'auto-completed',
        ref_entity: refEntityFor(task),
        duration_ms: Date.now() - t0,
        details: { summary: result.summary, evidence: result.evidence, exec_details: exec.details },
      });
      await finishTask(task, { summary: result.summary, executed: true, ...exec.details });
      console.log(`  ✓ auto-completed: ${result.summary}`);
      return;
    }

    if (routing === 'pending') {
      // Write to approvals table — the admin console will pick this up
      const approvalId = await nextApprovalId(prefixFor(task.capability));
      const slaMs = slaForCapability(task.capability, result.risk);
      const { error } = await supabase().from('agent_approvals').insert({
        id: approvalId,
        capability: task.capability,
        task_id: task.id,
        risk: result.risk,
        confidence: result.confidence,
        what: result.summary,
        who: extractWho(result),
        proposal: typeof result.proposal === 'string' ? result.proposal : JSON.stringify(result.proposal),
        evidence: result.evidence,
        trace: result.trace,
        sla_ms: slaMs,
        status: 'pending',
      });
      if (error) {
        await failTask(task, `Approval insert failed: ${error.message}`);
        return;
      }
      // Don't audit-log here — that happens when the admin approves/rejects
      await finishTask(task, { summary: result.summary, queued_approval: approvalId });
      console.log(`  → queued for approval: ${approvalId} (${explainRouting(cfg.autonomy, result.risk, 'pending')})`);
      return;
    }

    // blocked
    await appendAction({
      task_id: task.id,
      capability: task.capability,
      autonomy: cfg.autonomy,
      status: 'blocked',
      ref_entity: refEntityFor(task),
      duration_ms: Date.now() - t0,
      details: { reason: 'autonomy=off' },
    });
    await finishTask(task, { blocked: true });
    console.log(`  · blocked (autonomy off)`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ error:`, msg);
    await failTask(task, msg);
    await appendAction({
      task_id: task.id,
      capability: task.capability,
      autonomy: cfg.autonomy,
      status: 'failed',
      ref_entity: refEntityFor(task),
      duration_ms: Date.now() - t0,
      details: { error: msg },
    });
  }
}

async function finishTask(task: AgentTask, result: Record<string, unknown>) {
  await supabase()
    .from('agent_tasks')
    .update({ status: 'done', finished_at: new Date().toISOString(), result })
    .eq('id', task.id);
}

async function failTask(task: AgentTask, error: string) {
  const attempts = task.attempts + 1;
  const exhausted = attempts >= task.max_attempts;
  await supabase()
    .from('agent_tasks')
    .update({
      status: exhausted ? 'failed' : 'pending',
      finished_at: exhausted ? new Date().toISOString() : null,
      attempts,
      error,
    })
    .eq('id', task.id);
}

// ── Small helpers ────────────────────────────────────────────────

function prefixFor(capability: string): string {
  return {
    'lead-reply':      'LD',
    'listing-onboard': 'LST',
    'fraud-check':     'RSK',
    'price-suggest':   'PR',
    'broker-outreach': 'OUT',
    'blog-draft':      'BLOG',
    'social-post':     'MKT',
    'nudge-broker':    'NU',
  }[capability] ?? 'EV';
}

function slaForCapability(capability: string, risk: string): number {
  // SLA in ms — how long admins have to decide before this expires
  const base = {
    'fraud-check':     60 * 60 * 1000,           // 1h
    'price-suggest':   4 * 60 * 60 * 1000,       // 4h
    'broker-outreach': 8 * 60 * 60 * 1000,       // 8h
    'social-post':     24 * 60 * 60 * 1000,      // 24h
    'blog-draft':      48 * 60 * 60 * 1000,      // 48h
    'listing-onboard': 12 * 60 * 60 * 1000,      // 12h
    'lead-reply':      30 * 60 * 1000,           // 30m (very tight)
    'nudge-broker':    24 * 60 * 60 * 1000,
  }[capability] ?? 4 * 60 * 60 * 1000;
  // Compress high-risk windows
  return risk === 'high' ? Math.min(base, 60 * 60 * 1000) : base;
}

function refEntityFor(task: AgentTask): string | undefined {
  const i = task.input as Record<string, unknown>;
  if (typeof i.property_id === 'string') return `property:${i.property_id}`;
  if (typeof i.inquiry_id === 'string')  return `inquiry:${i.inquiry_id}`;
  if (typeof i.broker_id === 'string')   return `broker:${i.broker_id}`;
  return undefined;
}

function extractWho(result: { evidence: Array<{ label: string; value: string }> }): string {
  const broker = result.evidence.find(e => /broker|@/i.test(e.value));
  return broker?.value ?? '';
}
