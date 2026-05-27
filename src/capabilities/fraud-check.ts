// src/capabilities/fraud-check.ts — duplicate listing / scam detection
//
// Triggered by: webhook on `properties.insert` or `properties.update(images)`
// Default autonomy: APPROVE — fraud is high-risk, never auto-act.

import { llmJson } from '../llm/client.js';
import { fraudCheckPrompt, SYSTEM_VOICE } from '../llm/prompts.js';
import { supabase } from '../db/supabase.js';
import type { Capability, CapabilityResult, ExecuteResult } from '../types.js';

interface Input { property_id: string }

interface ProposalData {
  property_id: string;
  verdict: 'legitimate' | 'duplicate' | 'fraud' | 'uncertain';
  action: 'allow' | 'halt' | 'takedown' | 'escalate';
  matched_id?: string | null;
}

export const fraudCheck: Capability<Input> = {
  name: 'fraud-check',

  async reason(input): Promise<CapabilityResult> {
    const sb = supabase();
    const trace: CapabilityResult['trace'] = [];

    const { data: prop, error } = await sb
      .from('properties')
      .select('id, title, address, price, image_hashes, lat, lng, broker_id, profiles!properties_broker_id_fkey(handle, tier, strikes)')
      .eq('id', input.property_id)
      .single();
    if (error || !prop) throw new Error(`Property ${input.property_id} not found`);
    trace.push({ state: 'done', title: `Property + broker loaded`, t: new Date().toISOString() });

    // Find duplicate candidates — uses pgvector or a custom function. Stub:
    // call your own RPC. Below assumes you've created an RPC named
    // `find_dup_candidates(prop_id uuid)` returning {id, image_overlap, geo_distance_km, same_broker}.
    const { data: candidates } = await sb.rpc('find_dup_candidates', { prop_id: input.property_id });
    trace.push({ state: 'done', title: `Found ${candidates?.length ?? 0} candidate matches`, t: new Date().toISOString() });

    // Compute price deviation from neighborhood comparables (stub — wire to your real fn)
    const { data: priceCmp } = await sb.rpc('price_vs_median', { prop_id: input.property_id });
    const pricePct = priceCmp?.deviation_pct ?? 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brokerProfile = (prop as any).profiles;

    const { data, resp } = await llmJson<{
      verdict: ProposalData['verdict'];
      action: ProposalData['action'];
      matched_id: string | null;
      reason: string;
      risk: 'low' | 'med' | 'high';
      confidence: number;
    }>({
      system: SYSTEM_VOICE,
      prompt: fraudCheckPrompt({
        property: {
          id: prop.id,
          title: prop.title,
          address: prop.address,
          broker_handle: brokerProfile?.handle ?? 'unknown',
          broker_strikes: brokerProfile?.strikes ?? 0,
          broker_tier: brokerProfile?.tier ?? 'Free',
          image_hashes: (prop.image_hashes as string[]) ?? [],
          price: prop.price,
          price_vs_median_pct: pricePct,
        },
        candidates: (candidates ?? []) as Array<{ id: string; image_overlap: number; geo_distance_km: number; same_broker: boolean }>,
      }),
      temperature: 0.1, // high stakes → deterministic
      maxTokens: 280,
    });
    trace.push({ state: 'done', title: `LLM verdict: ${data.verdict} → ${data.action} (${resp.latencyMs}ms)`, t: new Date().toISOString() });

    // Fraud always requires human sign-off
    const risk: 'low' | 'med' | 'high' = data.verdict === 'legitimate' ? 'low' : 'high';

    return {
      summary: `Fraud check on "${prop.title}" → ${data.verdict} (${data.action})`,
      confidence: data.confidence,
      risk,
      proposal: {
        property_id: input.property_id,
        verdict: data.verdict,
        action: data.action,
        matched_id: data.matched_id,
      } satisfies ProposalData,
      trace: [...trace, { state: 'current', title: data.action === 'allow' ? `Pass-through` : `Awaiting admin decision`, t: new Date().toISOString() }],
      evidence: [
        { label: 'Verdict', value: data.verdict },
        { label: 'Action', value: data.action },
        { label: 'Matched listing', value: data.matched_id || '—' },
        { label: 'Reason', value: data.reason.slice(0, 60) },
      ],
      // High-stakes actions never auto-execute
      force_approval: data.action !== 'allow',
    };
  },

  async execute(_input, proposal): Promise<ExecuteResult> {
    const p = proposal as unknown as ProposalData;
    const sb = supabase();
    if (p.action === 'allow') {
      return { ok: true, details: { decision: 'allow' } };
    }
    const newStatus = p.action === 'takedown' ? 'taken_down' : p.action === 'halt' ? 'on_hold' : 'flagged';
    const { error } = await sb
      .from('properties')
      .update({ status: newStatus, fraud_check_at: new Date().toISOString(), fraud_verdict: p.verdict })
      .eq('id', p.property_id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, details: { new_status: newStatus, verdict: p.verdict } };
  },
};
