// src/capabilities/price-suggest.ts — price recommendation for stale listings
//
// Triggered by: daily cron (listings stale 7+ days with 0 inquiries) or manual
// Default autonomy: assist (broker sees the suggestion before any action)
//
// Reads CoBrop's real `properties`, computes comparables inline (same type +
// same city), and drafts a broker-facing recommendation. Output lives in
// agent_actions + agent_approvals — does NOT mutate the listing itself.

import { llmJson } from '../llm/client.js';
import { SYSTEM_VOICE } from '../llm/prompts.js';
import { supabase } from '../db/supabase.js';
import { loadProductKnowledge, productFragment } from '../learning/style-profile.js';
import type { Capability, CapabilityResult, ExecuteResult } from '../types.js';

interface Input { property_id: string }

interface ProposalData {
  property_id: string;
  current_price: number;
  recommended_price: number;
  change_pct: number;
  broker_copy: string;
}

export const priceSuggest: Capability<Input> = {
  name: 'price-suggest',

  async reason(input): Promise<CapabilityResult> {
    const sb = supabase();
    const t0 = Date.now();
    const trace: CapabilityResult['trace'] = [];

    const { data: prop, error } = await sb
      .from('properties')
      .select('id, broker_id, title, price, property_type, property_category, bedrooms, city, state, created_at, status')
      .eq('id', input.property_id)
      .single();
    if (error || !prop) throw new Error(`Property ${input.property_id} not found: ${error?.message}`);
    if (prop.price == null) throw new Error(`Property has no price — cannot recommend`);
    trace.push({ state: 'done', title: `Listing loaded: "${prop.title}"`, t: new Date().toISOString() });

    // Inquiries count
    const { count: inquiriesCount } = await sb
      .from('inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', input.property_id);
    const daysOnMarket = Math.floor((Date.now() - new Date(prop.created_at).getTime()) / 86400000);
    trace.push({ state: 'done', title: `${daysOnMarket}d on market, ${inquiriesCount ?? 0} inquiries`, t: new Date().toISOString() });

    // Comparables: same type, same city, similar bedrooms (±1), not this listing
    const cmpQuery = sb
      .from('properties')
      .select('id, price')
      .eq('property_type', prop.property_type)
      .eq('city', prop.city)
      .neq('id', input.property_id)
      .not('price', 'is', null);
    if (prop.bedrooms != null) cmpQuery.gte('bedrooms', Math.max(0, prop.bedrooms - 1)).lte('bedrooms', prop.bedrooms + 1);
    const { data: comps } = await cmpQuery.limit(40);

    const prices = (comps ?? []).map(c => Number(c.price)).filter(p => !Number.isNaN(p) && p > 0).sort((a, b) => a - b);
    let median: number | null = null, q1: number | null = null, q3: number | null = null;
    if (prices.length >= 3) {
      median = prices[Math.floor(prices.length / 2)];
      q1 = prices[Math.floor(prices.length * 0.25)];
      q3 = prices[Math.floor(prices.length * 0.75)];
    }
    trace.push({ state: 'done', title: `Found ${prices.length} comparables · median ${median ?? '—'}`, t: new Date().toISOString() });

    const currentPrice = Number(prop.price);
    const deviationPct = median ? Math.round(((currentPrice - median) / median) * 100) : 0;

    const product = await loadProductKnowledge();
    const system = product ? `${SYSTEM_VOICE}\n\n${productFragment(product)}` : SYSTEM_VOICE;

    const prompt = `Should this CoBrop listing be re-priced?

LISTING: "${prop.title}"
  Type: ${prop.property_type}${prop.property_category ? '/' + prop.property_category : ''}
  Bedrooms: ${prop.bedrooms ?? '?'}
  City: ${prop.city}${prop.state ? ', ' + prop.state : ''}
  Current price: ${currentPrice.toLocaleString()}
  Days on market: ${daysOnMarket}
  Inquiries so far: ${inquiriesCount ?? 0}

COMPARABLES (same type, same city, ±1 bedroom):
  Sample size: ${prices.length}
  Median: ${median?.toLocaleString() ?? '—'}
  Q1 / Q3: ${q1?.toLocaleString() ?? '—'} / ${q3?.toLocaleString() ?? '—'}
  Current is ${deviationPct > 0 ? '+' : ''}${deviationPct}% vs median

Decision rules:
- If inquiries=0 AND days≥7 AND deviation>5%, recommend dropping toward median.
- If inquiries>3 AND deviation<-5%, recommend raising 3-5%.
- Otherwise no_change.
- Stay within Q1..Q3 unless data clearly says otherwise.
- If comparables<3, be conservative and return action=no_change.

Output JSON:
{
  "recommended_price": <number>,
  "change_pct": <number, can be negative>,
  "broker_copy": "<one-sentence broker-facing message in plain English>",
  "reason": "<your reasoning>",
  "risk": "<low|med|high>",
  "confidence": <0-1>
}`;

    const { data, resp } = await llmJson<{
      recommended_price: number;
      change_pct: number;
      broker_copy: string;
      reason: string;
      risk: 'low' | 'med' | 'high';
      confidence: number;
    }>({ system, prompt, temperature: 0.2, maxTokens: 360 });
    trace.push({ state: 'done', title: `LLM suggests ${data.change_pct > 0 ? '+' : ''}${data.change_pct}% (${resp.latencyMs}ms)`, t: new Date().toISOString() });

    return {
      summary: `${prop.title}: ${data.change_pct > 0 ? '+' : ''}${data.change_pct}% → ${data.recommended_price.toLocaleString()}`,
      confidence: data.confidence,
      risk: Math.abs(data.change_pct) > 10 ? 'med' : 'low',
      proposal: {
        property_id: input.property_id,
        current_price: currentPrice,
        recommended_price: data.recommended_price,
        change_pct: data.change_pct,
        broker_copy: data.broker_copy,
      } satisfies ProposalData,
      trace: [...trace, { state: 'current', title: 'Awaiting broker review', t: new Date().toISOString() }],
      evidence: [
        { label: 'Current', value: currentPrice.toLocaleString() },
        { label: 'Suggested', value: data.recommended_price.toLocaleString() },
        { label: 'Comparables', value: `${prices.length} · median ${median?.toLocaleString() ?? '—'}` },
        { label: 'Days on market', value: String(daysOnMarket) },
        { label: 'Inquiries', value: String(inquiriesCount ?? 0) },
        { label: 'Reason', value: data.reason.slice(0, 80) },
      ],
      // Price changes always require human OK
      force_approval: true,
    };
  },

  async execute(_input, proposal): Promise<ExecuteResult> {
    // Price recommendations are advisory — the broker decides whether to apply.
    // We log everything to agent_actions; the admin console reads from there.
    const p = proposal as unknown as ProposalData;
    return {
      ok: true,
      details: {
        property_id: p.property_id,
        current_price: p.current_price,
        recommended_price: p.recommended_price,
        change_pct: p.change_pct,
        broker_copy: p.broker_copy,
      },
    };
  },
};
