// src/capabilities/lead-reply.ts — auto-reply to inquiries on listings
//
// Schema-aware: matches CoBrop's real `inquiries`, `properties`, `profiles`
// tables. No nested joins, no assumed columns. Writes results to the
// append-only agent_actions audit log instead of mutating `inquiries`.

import { llmJson } from '../llm/client.js';
import { SYSTEM_VOICE } from '../llm/prompts.js';
import { supabase } from '../db/supabase.js';
import { loadProductKnowledge, productFragment } from '../learning/style-profile.js';
import type { Capability, CapabilityResult, ExecuteResult } from '../types.js';

interface Input { inquiry_id: string }

interface ProposalData {
  reply: string;
  next_action: 'schedule-visit' | 'qualify-budget' | 'route-to-broker' | 'send-photos';
  inquiry_id: string;
  property_id: string;
  broker_id: string;
  inquirer_id: string;
  language_detected: string;
}

export const leadReply: Capability<Input> = {
  name: 'lead-reply',

  async reason(input): Promise<CapabilityResult> {
    const sb = supabase();
    const t0 = Date.now();
    const trace: CapabilityResult['trace'] = [];

    // 1. Fetch the inquiry
    const { data: inquiry, error: ie } = await sb
      .from('inquiries')
      .select('id, property_id, inquirer_id, message, status, created_at')
      .eq('id', input.inquiry_id)
      .single();
    if (ie || !inquiry) throw new Error(`Inquiry ${input.inquiry_id} not found: ${ie?.message}`);
    trace.push({ state: 'done', title: `Inquiry loaded · status=${inquiry.status}`, t: new Date().toISOString() });

    // 2. Fetch the linked property (separate query — no fragile joins)
    const { data: property, error: pe } = await sb
      .from('properties')
      .select('id, broker_id, title, description, price, property_type, property_category, bedrooms, bathrooms, square_feet, address, city, state, neighborhood, image_url, status')
      .eq('id', inquiry.property_id)
      .single();
    if (pe || !property) throw new Error(`Property ${inquiry.property_id} not found: ${pe?.message}`);
    trace.push({ state: 'done', title: `Property loaded: "${property.title}"`, t: new Date().toISOString() });

    // 3. Fetch the listing broker (the person who'll handle the lead)
    const { data: broker, error: be } = await sb
      .from('profiles')
      .select('id, full_name, email, languages_spoken, city, country, response_rate, badge_level, verification_status')
      .eq('id', property.broker_id)
      .single();
    if (be || !broker) throw new Error(`Broker ${property.broker_id} not found: ${be?.message}`);
    trace.push({ state: 'done', title: `Broker loaded: ${broker.full_name}`, t: new Date().toISOString() });

    // 4. Fetch the inquirer (best-effort — they may not have a profile if anonymous lead)
    const { data: inquirer } = await sb
      .from('profiles')
      .select('id, full_name, email, languages_spoken, city, country')
      .eq('id', inquiry.inquirer_id)
      .maybeSingle();
    if (inquirer) {
      trace.push({ state: 'done', title: `Inquirer loaded: ${inquirer.full_name || inquirer.email}`, t: new Date().toISOString() });
    } else {
      trace.push({ state: 'done', title: `Inquirer is anonymous / not in profiles`, t: new Date().toISOString() });
    }

    // 5. Build product knowledge fragment so the agent only pitches real capabilities
    const product = await loadProductKnowledge();
    const system = product ? `${SYSTEM_VOICE}\n\n${productFragment(product)}` : SYSTEM_VOICE;

    // 6. Format a price the LLM can use
    const priceFmt = property.price
      ? Number(property.price).toLocaleString(undefined, { maximumFractionDigits: 0 })
      : 'price on request';

    // 7. Compose the prompt
    const prompt = `An inquiry just landed on one of CoBrop's listings. Draft a single auto-reply that the listing broker would send.

LISTING
  Title: ${property.title}
  Type: ${property.property_type ?? '—'}${property.property_category ? ' · ' + property.property_category : ''}
  Bedrooms/Bathrooms: ${property.bedrooms ?? '?'}br / ${property.bathrooms ?? '?'}ba${property.square_feet ? ' · ' + property.square_feet + ' sqft' : ''}
  Address: ${property.address ?? ''}${property.neighborhood ? ', ' + property.neighborhood : ''}${property.city ? ', ' + property.city : ''}
  Price: ${priceFmt}
  Description: ${(property.description || '').slice(0, 600)}

LISTING BROKER (auto-reply will go out under their name)
  Name: ${broker.full_name || 'CoBrop broker'}
  Languages: ${(broker.languages_spoken || []).join(', ') || 'English'}
  Based in: ${broker.city || ''}${broker.country ? ', ' + broker.country : ''}
  Response rate: ${broker.response_rate ?? '?'}%

INQUIRY
${inquirer ? `  From: ${inquirer.full_name || inquirer.email}${inquirer.city ? ' (' + inquirer.city + (inquirer.country ? ', ' + inquirer.country : '') + ')' : ''}` : '  From: anonymous lead'}
  Message: "${inquiry.message}"

Detect the language the inquirer wrote in (look at the text — if it's Amharic, reply in Amharic; if Arabic, reply in Arabic; otherwise English). Reply in THAT language. Be brief (≤ 90 words). Acknowledge their question, confirm one concrete fact about the property, suggest a 30-minute visit, sign off with the broker's name.

Output JSON:
{
  "reply": "<the reply body — plain text, no greeting placeholders like {name}>",
  "language_detected": "<English|Amharic|Arabic|French|other>",
  "next_action": "<schedule-visit|qualify-budget|route-to-broker|send-photos>",
  "risk": "<low|med|high>",
  "confidence": <number between 0 and 1>
}`;

    const { data, resp } = await llmJson<{
      reply: string;
      language_detected: string;
      next_action: ProposalData['next_action'];
      risk: 'low' | 'med' | 'high';
      confidence: number;
    }>({
      system,
      prompt,
      temperature: 0.3,
      maxTokens: 400,
    });

    trace.push({ state: 'done', title: `Drafted reply in ${data.language_detected} · ${resp.provider} ${resp.latencyMs}ms`, t: new Date().toISOString() });

    return {
      summary: `Auto-reply drafted for "${property.title}" inquiry → ${data.next_action}`,
      confidence: data.confidence,
      risk: data.risk,
      proposal: {
        reply: data.reply,
        next_action: data.next_action,
        inquiry_id: inquiry.id,
        property_id: property.id,
        broker_id: broker.id,
        inquirer_id: inquiry.inquirer_id,
        language_detected: data.language_detected,
      } satisfies ProposalData,
      trace: [...trace, { state: 'current', title: 'Awaiting routing decision', t: new Date().toISOString() }],
      evidence: [
        { label: 'Confidence', value: `${Math.round(data.confidence * 100)}%` },
        { label: 'Language', value: data.language_detected },
        { label: 'Routing broker', value: broker.full_name || broker.email || broker.id },
        { label: 'Next action', value: data.next_action },
        { label: 'Wall time', value: `${Date.now() - t0}ms` },
      ],
    };
  },

  async execute(_input, proposal): Promise<ExecuteResult> {
    const p = proposal as unknown as ProposalData;
    // Don't mutate inquiries.status — that's tied to a CHECK constraint and
    // owned by the existing admin flow. The reply lives in the agent_actions
    // audit log (written by the queue worker on success).
    return {
      ok: true,
      details: {
        inquiry_id: p.inquiry_id,
        property_id: p.property_id,
        broker_id: p.broker_id,
        language: p.language_detected,
        next_action: p.next_action,
        reply_preview: p.reply.slice(0, 240),
        full_reply: p.reply,
      },
    };
  },
};
