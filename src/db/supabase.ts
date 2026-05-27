// src/db/supabase.ts — typed Supabase client (service role for the agent)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
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
  // Atomic-ish id generator: counts existing rows with this prefix today
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase()
    .from('agent_approvals')
    .select('id', { count: 'exact', head: true })
    .ilike('id', `${prefix}-%`)
    .gte('created_at', today);
  const next = (count ?? 0) + 1;
  // Stable but human-readable: RSK-0421 style
  return `${prefix}-${String(next).padStart(4, '0')}`;
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
