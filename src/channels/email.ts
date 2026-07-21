// src/channels/email.ts — real email send via Resend.
//
// Chosen over LinkedIn DM (needs Sales Navigator + InMail API, gated,
// expensive) and WhatsApp Business (needs Meta business verification,
// same friction we just hit with the Facebook page) for broker
// recruitment: Resend needs only an API key, no OAuth flow, no app
// review — free tier, signup takes ~2 minutes.

import { config } from '../config.js';

export interface EmailResult {
  ok: true;
  message_id: string;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<EmailResult> {
  if (!config.RESEND_API_KEY || !config.RESEND_FROM) {
    throw new Error('Email not configured — missing RESEND_API_KEY / RESEND_FROM');
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.RESEND_FROM,
      to: [to],
      subject,
      text,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`Email send failed (${res.status}): ${json.message ?? JSON.stringify(json).slice(0, 300)}`);
  }
  return { ok: true, message_id: json.id };
}
