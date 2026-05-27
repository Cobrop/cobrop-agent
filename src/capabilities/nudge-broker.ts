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
      .select('id, handle, language')
      .eq('id', input.broker_id)
      .single();
    if (!broker) throw new Error('Broker not found');

    const { data: leads } = await sb
      .from('inquiries')
      .select('id, created_at, properties!inner(title, price)')
      .eq('assigned_broker_id', input.broker_id)
      .is('broker_replied_at', null)
      .gt('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

    const stale = (leads ?? []).map(l => {
      const hours = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 3600000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prop = (l as any).properties;
      return { id: l.id, hours_waiting: hours, property_title: prop.title, budget: prop.price };
    }).filter(l => l.hours_waiting >= 18);

    if (stale.length === 0) {
      return {
        summary: `No nudge needed for @${broker.handle}`,
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
        broker_handle: broker.handle,
        broker_language: broker.language || 'English',
        stale_leads: stale,
      }),
      temperature: 0.5,
      maxTokens: 240,
    });

    return {
      summary: `Nudge for @${broker.handle}: ${stale.length} stale leads`,
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
        { label: 'Channels', value: 'in-app + WhatsApp' },
      ],
    };
  },

  async execute(_input, proposal): Promise<ExecuteResult> {
    const p = proposal as unknown as ProposalData;
    if (!p.in_app) return { ok: true, details: { skipped: true } };
    const sb = supabase();
    const { error } = await sb.from('notifications').insert([
      { user_id: p.broker_id, channel: 'in_app', body: p.in_app, sender: 'agent' },
      { user_id: p.broker_id, channel: 'whatsapp', body: p.whatsapp, sender: 'agent' },
    ]);
    if (error) return { ok: false, error: error.message };
    return { ok: true, details: { messages_sent: 2 } };
  },
};
