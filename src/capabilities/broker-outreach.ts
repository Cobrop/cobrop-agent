// src/capabilities/broker-outreach.ts — personalized outreach to brokers
//
// Triggered by:  manual (admin picks a broker) or cron (filtered cohort)
// Default autonomy: assist (admin approves before send)
//
// Targets brokers already on CoBrop (profiles table) — useful for re-engaging
// inactive brokers, inviting them to expand to new countries, etc. For
// recruiting NEW brokers from outside the platform, you'd seed an
// outreach_candidates table separately (not required for MVP).

import { llmJson } from '../llm/client.js';
import { SYSTEM_VOICE } from '../llm/prompts.js';
import { supabase } from '../db/supabase.js';
import { loadProductKnowledge, loadMarketingVoice, productFragment } from '../learning/style-profile.js';
import type { Capability, CapabilityResult, ExecuteResult } from '../types.js';

interface Input {
  broker_id: string;
  channel?: 'linkedin' | 'whatsapp' | 'email' | 'in-app';
  goal?: string; // optional context — e.g. "re-engage", "invite to Dubai", "upsell premium"
}

interface ProposalData {
  broker_id: string;
  channel: 'linkedin' | 'whatsapp' | 'email' | 'in-app';
  language: string;
  subject: string;
  message: string;
  cta: string;
  follow_up_in_days: number;
}

export const brokerOutreach: Capability<Input> = {
  name: 'broker-outreach',

  async reason(input): Promise<CapabilityResult> {
    const sb = supabase();
    const t0 = Date.now();
    const trace: CapabilityResult['trace'] = [];

    // Pull broker profile (lots of useful metadata on this table)
    const { data: broker, error } = await sb
      .from('profiles')
      .select('id, full_name, email, company, phone, city, country, languages_spoken, specializations, years_of_experience, total_properties, completed_transactions, response_rate, badge_level, subscription_level, linkedin_url, whatsapp_number, last_score_update')
      .eq('id', input.broker_id)
      .single();
    if (error || !broker) throw new Error(`Broker ${input.broker_id} not found: ${error?.message}`);
    trace.push({ state: 'done', title: `Broker loaded: ${broker.full_name}`, t: new Date().toISOString() });

    // Channel selection — prefer WhatsApp for Gulf/Arabic-speaking, LinkedIn for English
    const lang = (broker.languages_spoken && broker.languages_spoken[0]) || 'English';
    let channel: ProposalData['channel'] = input.channel || 'in-app';
    if (!input.channel) {
      if (lang === 'Arabic' || ['AE', 'QA', 'SA'].includes(broker.country || '')) channel = 'whatsapp';
      else if (broker.linkedin_url) channel = 'linkedin';
      else if (broker.email) channel = 'email';
    }
    trace.push({ state: 'done', title: `Channel: ${channel} · Language: ${lang}`, t: new Date().toISOString() });

    // Load CoBrop product + marketing voice
    const [product, marketing] = await Promise.all([loadProductKnowledge(), loadMarketingVoice()]);
    const marketingFrag = marketing?.profile.value_props.length
      ? `\nMARKETING POSITIONING:\n  - Pitch: ${marketing.profile.elevator_pitch}\n  - Audience: ${marketing.profile.target_audience}\n  - Top value props: ${marketing.profile.value_props.slice(0, 3).join(' · ')}\n`
      : '';
    const system = `${SYSTEM_VOICE}\n\n${productFragment(product)}${marketingFrag}`;

    const channelRules: Record<ProposalData['channel'], string> = {
      linkedin: '≤90 words · professional · NO emoji · soft CTA',
      whatsapp: '≤60 words · warm · 1 emoji max · clear CTA',
      email:    '≤120 words · 1 short paragraph · subject line ≤ 50 chars',
      'in-app': '≤80 words · friendly · references CoBrop directly',
    };

    const prompt = `Draft personalised outreach to this CoBrop broker.

BROKER
  Name: ${broker.full_name}
  Company: ${broker.company ?? '—'}
  Based: ${broker.city ?? ''}${broker.country ? ', ' + broker.country : ''}
  Languages: ${(broker.languages_spoken || []).join(', ') || 'English'}
  Specializations: ${(broker.specializations || []).join(', ') || '—'}
  Experience: ${broker.years_of_experience ?? '?'} years · ${broker.total_properties ?? 0} listings · ${broker.completed_transactions ?? 0} closed deals
  CoBrop tier: ${broker.subscription_level ?? 'free'} · response rate ${broker.response_rate ?? '?'}%

GOAL: ${input.goal || 'general engagement — invite to take next step on CoBrop'}
CHANNEL: ${channel} · ${channelRules[channel]}
LANGUAGE: write in ${lang}

Be hyper-specific: mention something concrete from their profile (city, specialization, or volume). No generic platitudes.

Output JSON:
{
  "subject": "<email subject or '' if not email>",
  "message": "<message body in ${lang}>",
  "cta": "<the call-to-action text inside the message>",
  "follow_up_in_days": <number>,
  "risk": "<low|med|high>",
  "confidence": <0-1>
}`;

    const { data, resp } = await llmJson<{
      subject: string;
      message: string;
      cta: string;
      follow_up_in_days: number;
      risk: 'low' | 'med' | 'high';
      confidence: number;
    }>({ system, prompt, temperature: 0.6, maxTokens: 360 });
    trace.push({ state: 'done', title: `Drafted ${channel} message in ${lang} (${resp.provider}, ${resp.latencyMs}ms)`, t: new Date().toISOString() });

    return {
      summary: `Outreach to ${broker.full_name} via ${channel}`,
      confidence: data.confidence,
      risk: data.risk,
      proposal: {
        broker_id: broker.id,
        channel,
        language: lang,
        subject: data.subject,
        message: data.message,
        cta: data.cta,
        follow_up_in_days: data.follow_up_in_days,
      } satisfies ProposalData,
      trace: [...trace, { state: 'current', title: 'Awaiting send approval', t: new Date().toISOString() }],
      evidence: [
        { label: 'Channel', value: channel },
        { label: 'Language', value: lang },
        { label: 'Words', value: String(data.message.split(/\s+/).length) },
        { label: 'Follow-up', value: `+${data.follow_up_in_days}d` },
        { label: 'Wall time', value: `${Date.now() - t0}ms` },
      ],
    };
  },

  async execute(_input, proposal): Promise<ExecuteResult> {
    // The actual send is a stub — wire to LinkedIn / WhatsApp / SendGrid here
    // once you have those tokens. For now the draft lives in agent_actions and
    // can be manually reviewed/sent through your admin UI.
    const p = proposal as unknown as ProposalData;
    return {
      ok: true,
      details: {
        broker_id: p.broker_id,
        channel: p.channel,
        language: p.language,
        subject: p.subject,
        full_message: p.message,
        cta: p.cta,
        follow_up_in_days: p.follow_up_in_days,
        send_status: 'drafted — send via configured channel adapter',
      },
    };
  },
};
