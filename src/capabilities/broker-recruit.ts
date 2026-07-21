// src/capabilities/broker-recruit.ts — cold outreach to brokers NOT yet
// on CoBrop, inviting them to join.
//
// Triggered by: manual (admin picks a prospect in broker_prospects)
// Default autonomy: approve — first contact with an external person,
// reputational risk, never auto-send.
//
// broker-outreach.ts targets existing CoBrop members (profiles table) —
// this targets external prospects (broker_prospects table). No sourcing
// pipeline exists (no scraping/LinkedIn Search API/purchased list) —
// prospects are added manually via POST /agent/prospects. This capability
// only ever drafts + sends to rows that are already there.

import { llmJson } from '../llm/client.js';
import { SYSTEM_VOICE } from '../llm/prompts.js';
import { supabase } from '../db/supabase.js';
import { loadProductKnowledge, loadMarketingVoice, productFragment } from '../learning/style-profile.js';
import type { Capability, CapabilityResult, ExecuteResult } from '../types.js';

interface Input {
  prospect_id: string;
}

interface ProposalData {
  prospect_id: string;
  channel: 'email' | 'manual';
  email: string | null;
  language: string;
  subject: string;
  message: string;
}

export const brokerRecruit: Capability<Input> = {
  name: 'broker-recruit',

  async reason(input): Promise<CapabilityResult> {
    const sb = supabase();
    const t0 = Date.now();
    const trace: CapabilityResult['trace'] = [];

    const { data: prospect, error } = await sb
      .from('broker_prospects')
      .select('id, full_name, company, location, country, email, linkedin_url, language, source, notes, fit_score, status')
      .eq('id', input.prospect_id)
      .single();
    if (error || !prospect) throw new Error(`Prospect ${input.prospect_id} not found: ${error?.message}`);
    trace.push({ state: 'done', title: `Prospect loaded: ${prospect.full_name}`, t: new Date().toISOString() });

    // Email is the only channel with a real, unblocked send path today —
    // LinkedIn DM needs Sales Navigator + InMail API access (gated), and
    // there's no LinkedIn URL → personal message field to fill anyway.
    // WhatsApp Business needs Meta business verification we haven't done.
    const channel: ProposalData['channel'] = prospect.email ? 'email' : 'manual';
    const lang = prospect.language || 'English';
    trace.push({ state: 'done', title: `Channel: ${channel}${!prospect.email ? ' (no email on file — draft only, send manually)' : ''}`, t: new Date().toISOString() });

    const [product, marketing] = await Promise.all([loadProductKnowledge(), loadMarketingVoice()]);
    const marketingFrag = marketing?.profile.value_props.length
      ? `\nMARKETING POSITIONING:\n  - Pitch: ${marketing.profile.elevator_pitch}\n  - Audience: ${marketing.profile.target_audience}\n  - Top value props: ${marketing.profile.value_props.slice(0, 3).join(' · ')}\n`
      : '';
    const system = `${SYSTEM_VOICE}\n\n${productFragment(product)}${marketingFrag}`;

    const prompt = `Draft a cold-outreach email inviting this broker to join CoBrop. They are NOT a CoBrop member yet — this is a first-contact introduction, not a re-engagement message.

PROSPECT
  Name: ${prospect.full_name}
  Company: ${prospect.company ?? '—'}
  Location: ${prospect.location ?? ''}${prospect.country ? ', ' + prospect.country : ''}
  Source: how we found them — ${prospect.source}
  Notes: ${prospect.notes ?? '—'}

RULES: ≤130 words · 1 short paragraph · subject line ≤ 50 chars · no hype, no "game-changer"/"leverage" clichés · mention something concrete and true about them (company or location) — never invent facts not given above · soft CTA to a 10-minute call, no pressure · sign off as "The CoBrop team".
LANGUAGE: write in ${lang}

Output JSON:
{
  "subject": "<email subject>",
  "message": "<email body in ${lang}>",
  "risk": "<low|med|high>",
  "confidence": <0-1>
}`;

    const { data, resp } = await llmJson<{
      subject: string;
      message: string;
      risk: 'low' | 'med' | 'high';
      confidence: number;
    }>({ system, prompt, temperature: 0.6, maxTokens: 320 });
    trace.push({ state: 'done', title: `Drafted invite in ${lang} (${resp.provider}, ${resp.latencyMs}ms)`, t: new Date().toISOString() });

    return {
      summary: `Recruitment invite for ${prospect.full_name}${prospect.company ? ' (' + prospect.company + ')' : ''}`,
      confidence: data.confidence,
      risk: data.risk,
      proposal: {
        prospect_id: prospect.id,
        channel,
        email: prospect.email,
        language: lang,
        subject: data.subject,
        message: data.message,
      } satisfies ProposalData,
      trace: [...trace, { state: 'current', title: 'Awaiting send approval', t: new Date().toISOString() }],
      evidence: [
        { label: 'Prospect', value: `${prospect.full_name}${prospect.company ? ' · ' + prospect.company : ''}` },
        { label: 'Location', value: `${prospect.location ?? '—'}${prospect.country ? ', ' + prospect.country : ''}` },
        { label: 'Source', value: prospect.source },
        { label: 'Channel', value: channel },
        { label: 'Wall time', value: `${Date.now() - t0}ms` },
      ],
      // First contact with a real external person — always human-reviewed.
      force_approval: true,
    };
  },

  async execute(_input, proposal): Promise<ExecuteResult> {
    const p = proposal as unknown as ProposalData;
    const sb = supabase();

    if (p.channel === 'email' && p.email) {
      try {
        const { sendEmail } = await import('../channels/email.js');
        const result = await sendEmail(p.email, p.subject, p.message);
        await sb.from('broker_prospects').update({
          status: 'contacted',
          contacted_at: new Date().toISOString(),
        }).eq('id', p.prospect_id);
        return {
          ok: true,
          details: {
            prospect_id: p.prospect_id,
            channel: 'email',
            subject: p.subject,
            full_message: p.message,
            send_status: 'sent',
            message_id: result.message_id,
          },
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    // No email on file, or email not configured — draft only.
    return {
      ok: true,
      details: {
        prospect_id: p.prospect_id,
        channel: p.channel,
        subject: p.subject,
        full_message: p.message,
        send_status: p.email ? 'drafted — RESEND_API_KEY not configured' : 'drafted — no email on file, send manually',
      },
    };
  },
};
