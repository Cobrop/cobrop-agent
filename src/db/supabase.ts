// src/db/supabase.ts — typed Supabase client (service role for the agent)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let _client: SupabaseClient | null = null;

// HARD KILL SWITCH — fail closed.
//
// The agent reaches Supabase ONLY when AGENT_DB=on is set explicitly. With the
// egress quota exhausted this defaults to blocked, so simply deploying this code
// stops every agent query without touching any dashboard.
//
// Note this is deliberately NOT "delete the key". config.ts defaults missing
// vars to '' and never exits, so an absent key does not stop anything: the
// client is still constructed, every request still leaves the server, and each
// one comes back 401 — traffic, retries and noise, just failing traffic. The
// only way to stop a request is to never make it.
const DB_ENABLED = process.env.AGENT_DB === 'on';

export function supabase(): SupabaseClient {
  if (!DB_ENABLED) {
    throw new Error(
      'Supabase access is disabled (egress quota). Set AGENT_DB=on to re-enable.'
    );
  }
  if (_client) return _client;
  _client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });
  return _client;
}

// ── Helpers used by capabilities ─────────────────────────────────

export async function loadAgentConfig(capability: string) {
  const { data, error } = await supabase()
    .from('agent_config')
    .select('autonomy, daily_cap, guardrails')
    .eq('capability', capability)
    .maybeSingle();
  if (error) throw error;
  return data ?? { autonomy: 'approve' as const, daily_cap: null, guardrails: {} };
}

export async function nextApprovalId(prefix: string): Promise<string> {
  // Human-readable running counter: RSK-0421 style. Scoped to "today" only
  // used to reset to 0001 daily and collide with permanently-existing rows
  // from prior days (unique constraint is on `id`, not per-day) — every
  // price-suggest/social-post/blog-draft approval failed for two months
  // because of this. Base it on the highest existing suffix instead.
  const { data } = await supabase()
    .from('agent_approvals')
    .select('id')
    .ilike('id', `${prefix}-%`)
    .order('id', { ascending: false })
    .limit(1);
  const last = data?.[0]?.id as string | undefined;
  const lastNum = last ? parseInt(last.slice(prefix.length + 1), 10) || 0 : 0;
  return `${prefix}-${String(lastNum + 1).padStart(4, '0')}`;
}

/** Upload an agent-generated image (social posts, etc.) to the public
 * agent-media bucket and return its public URL. */
export async function uploadAgentImage(buffer: Buffer, path: string): Promise<string> {
  const sb = supabase();
  const { error } = await sb.storage.from('agent-media').upload(path, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  const { data } = sb.storage.from('agent-media').getPublicUrl(path);
  return data.publicUrl;
}

export async function appendAction(row: {
  task_id?: string;
  approval_id?: string;
  capability: string;
  autonomy: string;
  status: string;
  ref_entity?: string;
  duration_ms?: number;
  cost_usd?: number;
  tokens_in?: number;
  tokens_out?: number;
  model?: string;
  llm_provider?: string;
  details?: Record<string, unknown>;
}) {
  const { error } = await supabase().from('agent_actions').insert(row);
  if (error) console.error('[audit] failed to append:', error.message);
}
