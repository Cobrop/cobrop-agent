// src/routes/approvals.ts — endpoints the admin console calls

import { Hono } from 'hono';
import { supabase, appendAction, loadAgentConfig } from '../db/supabase.js';
import { getCapability } from '../capabilities/index.js';
import { verifyAdmin } from '../middleware/auth.js';

export const approvals = new Hono();

approvals.use('*', verifyAdmin);

// GET /approvals?status=pending
approvals.get('/', async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const { data, error } = await supabase()
    .from('agent_approvals')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ approvals: data });
});

// POST /approvals/:id/approve
approvals.post('/:id/approve', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ admin_id?: string; edited_proposal?: Record<string, unknown> }>().catch(() => ({}));

  const sb = supabase();
  const { data: ap, error: fe } = await sb.from('agent_approvals').select('*').eq('id', id).single();
  if (fe || !ap) return c.json({ error: 'approval not found' }, 404);
  if (ap.status !== 'pending') return c.json({ error: `already ${ap.status}` }, 409);

  // Re-run execute with the (possibly edited) proposal
  const cap = getCapability(ap.capability);
  if (!cap) return c.json({ error: 'unknown capability' }, 500);
  const cfg = await loadAgentConfig(ap.capability);

  const { data: task } = await sb.from('agent_tasks').select('input').eq('id', ap.task_id).single();
  const input = (task?.input as Record<string, unknown>) ?? {};
  const proposal = (body.edited_proposal ?? (typeof ap.proposal === 'string' ? JSON.parse(ap.proposal) : ap.proposal)) as Record<string, unknown>;

  const t0 = Date.now();
  const exec = await cap.execute(input, proposal);
  if (!exec.ok) {
    return c.json({ error: 'execute failed: ' + exec.error }, 500);
  }
  await sb.from('agent_approvals').update({
    status: 'approved',
    decided_at: new Date().toISOString(),
    decided_by: body.admin_id ?? 'admin',
  }).eq('id', id);

  await appendAction({
    approval_id: id,
    task_id: ap.task_id ?? undefined,
    capability: ap.capability,
    autonomy: cfg.autonomy,
    status: 'approved-executed',
    duration_ms: Date.now() - t0,
    details: { summary: ap.what, exec_details: exec.details },
  });

  return c.json({ ok: true, exec_details: exec.details });
});

// POST /approvals/:id/reject
approvals.post('/:id/reject', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ admin_id?: string; reason?: string }>().catch(() => ({}));
  const sb = supabase();

  const { data: ap, error } = await sb.from('agent_approvals').select('*').eq('id', id).single();
  if (error || !ap) return c.json({ error: 'not found' }, 404);
  if (ap.status !== 'pending') return c.json({ error: `already ${ap.status}` }, 409);

  await sb.from('agent_approvals').update({
    status: 'rejected',
    decided_at: new Date().toISOString(),
    decided_by: body.admin_id ?? 'admin',
    decision_reason: body.reason ?? null,
  }).eq('id', id);

  await appendAction({
    approval_id: id,
    capability: ap.capability,
    autonomy: 'approve',
    status: 'rejected',
    details: { reason: body.reason ?? 'manual reject' },
  });

  return c.json({ ok: true });
});

// POST /approvals/:id/snooze
approvals.post('/:id/snooze', async (c) => {
  const id = c.req.param('id');
  const sb = supabase();
  // Re-stamp created_at so SLA timer effectively resets
  const { error } = await sb.from('agent_approvals')
    .update({ status: 'snoozed', created_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return c.json({ error: error.message }, 500);
  // Flip back to pending after 30m via a follow-up update (or just leave as snoozed)
  return c.json({ ok: true });
});
