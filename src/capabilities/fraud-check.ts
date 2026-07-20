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
      .select('id, title, address, price, images, latitude, longitude, broker_id, city, property_type, bedrooms, profiles!properties_broker_id_fkey(full_name, subscription_level)')
      .eq('id', input.property_id)
      .single();
    if (error || !prop) throw new Error(`Property ${input.property_id} not found: ${error?.message ?? 'no row'}`);
    trace.push({ state: 'done', title: `Property + broker loaded`, t: new Date().toISOString() });

    // No image-hashing pipeline exists yet, so duplicate-image matching isn't
    // available — this only judges on price deviation + text/address for now.
    const candidates: Array<{ id: string; image_overlap: number; geo_distance_km: number; same_broker: boolean }> = [];
    trace.push({ state: 'done', title: `Duplicate-image matching not wired — skipped`, t: new Date().toISOString() });

    // Price deviation from comparables (same type + city, ±1 bedroom) —
    // computed inline, same approach as price-suggest.ts.
    const cmpQuery = sb
      .from('properties')
      .select('price')
      .eq('property_type', prop.property_type)
      .eq('city', prop.city)
      .neq('id', input.property_id)
      .not('price', 'is', null);
    if (prop.bedrooms != null) cmpQuery.gte('bedrooms', Math.max(0, prop.bedrooms - 1)).lte('bedrooms', prop.bedrooms + 1);
    const { data: comps } = await cmpQuery.limit(40);
    const prices = (comps ?? []).map(c => Number(c.price)).filter(p => !Number.isNaN(p) && p > 0).sort((a, b) => a - b);
    const median = prices.length >= 3 ? prices[Math.floor(prices.length / 2)] : null;
    const pricePct = median ? Math.round(((Number(prop.price) - median) / median) * 100) : 0;
    trace.push({ state: 'done', title: `Price ${pricePct > 0 ? '+' : ''}${pricePct}% vs ${prices.length} comparables`, t: new Date().toISOString() });

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
          broker_handle: brokerProfile?.full_name ?? 'unknown',
          broker_strikes: 0, // no strikes-tracking column exists yet
          broker_tier: brokerProfile?.subscription_level ?? 'Free',
          image_hashes: new Array((prop.images as string[] | null)?.length ?? 0).fill('unhashed'),
          price: prop.price,
          price_vs_median_pct: pricePct,
        },
        candidates,
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
    // fraud_check_at / fraud_verdict columns don't exist on properties — the
    // verdict is captured in the agent_actions audit log by the caller instead.
    const { error } = await sb
      .from('properties')
      .update({ status: newStatus })
      .eq('id', p.property_id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, details: { new_status: newStatus, verdict: p.verdict } };
  },
};
