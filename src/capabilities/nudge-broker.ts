// src/capabilities/nudge-broker.ts — gentle nudge to brokers with stale leads
//
// Triggered by: hourly cron (any broker with leads waiting > 18h)
// Default autonomy: autopilot (low-stakes, friendly)

import { llmJson } from '../llm/client.js';
import { nudgeBrokerPrompt, SYSTEM_VOICE } from '../llm/prompts.js';
import { supabase } from '../db/supabase.js';
import type { Capability, CapabilityResult, ExecuteResult } from '../types.js';

interface Input { broker_id: string }

interface ProposalData {
  broker_id: string;
  in_app: string;
  whatsapp: string;
}

export const nudgeBroker: Capability<Input> = {
  name: 'nudge-broker',

  async reason(input): Promise<CapabilityResult> {
    const sb = supabase();
    const { data: broker } = await sb
      .from('profiles')
      .select('id, full_name, languages_spoken')
      .eq('id', input.broker_id)
      .single();
    if (!broker) throw new Error('Broker not found');
    const brokerHandle = broker.full_name || broker.id;
    const brokerLanguage = broker.languages_spoken?.[0] || 'English';

    // No assigned_broker_id column on inquiries — leads are tied to a broker
    // via the listing (properties.broker_id), so resolve their listings first.
    const { data: brokerProps } = await sb
      .from('properties')
      .select('id, title, price')
      .eq('broker_id', input.broker_id);
    const propMap = new Map((brokerProps ?? []).map(p => [p.id, p]));

    const { data: leads } = propMap.size > 0
      ? await sb
          .from('inquiries')
          .select('id, property_id, created_at, status')
          .in('property_id', [...propMap.keys()])
          .neq('status', 'responded')
          .gt('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      : { data: [] };

    const stale = (leads ?? []).map(l => {
      const hours = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 3600000);
      const prop = propMap.get(l.property_id);
      return { id: l.id, hours_waiting: hours, property_title: prop?.title ?? 'Unknown listing', budget: prop?.price };
    }).filter(l => l.hours_waiting >= 18);

    if (stale.length === 0) {
      return {
        summary: `No nudge needed for @${brokerHandle}`,
        confidence: 1,
        risk: 'low',
        proposal: { broker_id: broker.id, in_app: '', whatsapp: '' },
        trace: [{ state: 'done', title: `0 stale leads — skipping`, t: new Date().toISOString() }],
        evidence: [{ label: 'Stale leads', value: '0' }],
      };
    }

    const { data, resp } = await llmJson<{
      in_app: string;
      whatsapp: string;
      risk: 'low' | 'med' | 'high';
      confidence: number;
    }>({
      system: SYSTEM_VOICE,
      prompt: nudgeBrokerPrompt({
        broker_handle: brokerHandle,
        broker_language: brokerLanguage,
        stale_leads: stale,
      }),
      temperature: 0.5,
      maxTokens: 240,
    });

    return {
      summary: `Nudge for @${brokerHandle}: ${stale.length} stale leads`,
      confidence: data.confidence,
      risk: 'low',
      proposal: {
        broker_id: broker.id,
        in_app: data.in_app,
        whatsapp: data.whatsapp,
      } satisfies ProposalData,
      trace: [
        { state: 'done', title: `${stale.length} stale leads identified`, t: new Date().toISOString() },
        { state: 'done', title: `LLM drafted nudge (${resp.latencyMs}ms)`, t: new Date().toISOString() },
      ],
      evidence: [
        { label: 'Stale leads', value: String(stale.length) },
        { label: 'Oldest lead', value: `${Math.max(...stale.map(s => s.hours_waiting))}h` },
        { label: 'Channels', value: 'in-app (real) + WhatsApp (draft only)' },
      ],
    };
  },

  async execute(_input, proposal): Promise<ExecuteResult> {
    const p = proposal as unknown as ProposalData;
    if (!p.in_app) return { ok: true, details: { skipped: true } };
    const sb = supabase();
    // notifications has no channel/body/sender columns and there's no real
    // WhatsApp delivery integration — write the real in-app notification
    // (matches the shape leadRequestService.ts already uses) and keep the
    // WhatsApp copy as a draft in the log until a channel adapter exists.
    const { error } = await sb.from('notifications').insert([{
      user_id: p.broker_id,
      type: 'agent_nudge',
      priority: 'medium',
      title: 'Follow up on your leads',
      message: p.in_app,
    }]);
    if (error) return { ok: false, error: error.message };
    return { ok: true, details: { messages_sent: 1, whatsapp_draft: p.whatsapp, whatsapp_status: 'drafted — send via configured channel adapter' } };
  },
};
