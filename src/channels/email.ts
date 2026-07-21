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

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<EmailResult> {
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
      text, // always included — the plain-text fallback most clients use
      ...(html ? { html } : {}),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`Email send failed (${res.status}): ${json.message ?? JSON.stringify(json).slice(0, 300)}`);
  }
  return { ok: true, message_id: json.id };
}

// Brand colors — dark blue #1F5C7A (header, primary text), cyan #00DFDF
// (accent, primary CTA). Real, verified links: com.cobrop.twa is the
// actual live Play Store package (confirmed 200), /signup and
// /watch-demo are real routes in CoProp-Website's App.tsx.
const BRAND_DARK = '#1F5C7A';
const BRAND_CYAN = '#00DFDF';
const LINK_SIGNUP = 'https://www.cobrop.com/signup';
const LINK_DEMO = 'https://www.cobrop.com/watch-demo';
const LINK_APP = 'https://play.google.com/store/apps/details?id=com.cobrop.twa';

/** Wraps a plain-text message body in a simple branded HTML shell with CTAs. */
export function toBrandedHtml(message: string): string {
  const paragraphs = message
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 14px;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f6f7;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f7;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;">
        <tr><td style="background:${BRAND_DARK};padding:20px 28px;">
          <a href="https://www.cobrop.com" style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;text-decoration:none;">CoBrop</a>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;color:#1c2b33;font-size:14.5px;line-height:1.6;">
          ${paragraphs}
        </td></tr>
        <tr><td style="padding:8px 28px 28px;">
          <!-- "Bulletproof" email buttons: bgcolor attribute + nested table per
               button, not just CSS on <a> — many clients (Gmail included, in
               some views) strip background/border-radius from a plain styled
               <a> and it renders as a bare underlined link. This is the
               standard reliable pattern. -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding-right:8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td align="center" bgcolor="${BRAND_CYAN}" style="border-radius:7px;background-color:${BRAND_CYAN};">
                  <a href="${LINK_SIGNUP}" target="_blank" style="display:inline-block;padding:10px 20px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:${BRAND_DARK};text-decoration:none;border-radius:7px;">Join CoBrop</a>
                </td>
              </tr></table>
            </td>
            <td style="padding-right:8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td align="center" bgcolor="#ffffff" style="border-radius:7px;background-color:#ffffff;border:1px solid ${BRAND_DARK};">
                  <a href="${LINK_DEMO}" target="_blank" style="display:inline-block;padding:9px 16px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:${BRAND_DARK};text-decoration:none;border-radius:7px;">Watch demo</a>
                </td>
              </tr></table>
            </td>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td align="center" bgcolor="#ffffff" style="border-radius:7px;background-color:#ffffff;border:1px solid ${BRAND_DARK};">
                  <a href="${LINK_APP}" target="_blank" style="display:inline-block;padding:9px 16px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:${BRAND_DARK};text-decoration:none;border-radius:7px;">Download app</a>
                </td>
              </tr></table>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e6ebed;color:#8a99a0;font-size:11.5px;">
          CoBrop · Cross-border real estate co-brokerage · <a href="https://www.cobrop.com" style="color:${BRAND_DARK};">cobrop.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
