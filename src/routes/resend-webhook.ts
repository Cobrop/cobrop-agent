// src/routes/resend-webhook.ts — receives Resend delivery events (bounce,
// complaint) and flags the matching broker_prospects row.
//
// Verified via Svix HMAC signing — what Resend actually uses for webhooks
// — NOT the generic WEBHOOK_SECRET scheme in middleware/auth.ts (that's a
// simple shared secret we choose; Resend signs with its own per-endpoint
// secret via a completely different mechanism, so this can't reuse
// verifyWebhook and needs its own verification here).

import { Hono } from 'hono';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { supabase } from '../db/supabase.js';

export const resendWebhook = new Hono();

function verifySvix(secret: string, id: string, timestamp: string, body: string, signatureHeader: string): boolean {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${id}.${timestamp}.${body}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  const expectedBuf = Buffer.from(expected);
  // svix-signature is space-separated "v1,<base64>" entries — check all of them
  return signatureHeader.split(' ').some((part) => {
    const sig = part.split(',')[1];
    if (!sig) return false;
    try {
      const sigBuf = Buffer.from(sig, 'base64');
      return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  });
}

interface ResendEvent {
  type: string;
  data: {
    to?: string[];
    bounce?: { message?: string; type?: string };
  };
}

resendWebhook.post('/', async (c) => {
  if (!config.RESEND_WEBHOOK_SECRET) {
    return c.json({ error: 'RESEND_WEBHOOK_SECRET not configured' }, 500);
  }
  const id = c.req.header('svix-id');
  const timestamp = c.req.header('svix-timestamp');
  const signature = c.req.header('svix-signature');
  const rawBody = await c.req.text();
  if (!id || !timestamp || !signature) {
    return c.json({ error: 'missing svix headers' }, 400);
  }
  if (!verifySvix(config.RESEND_WEBHOOK_SECRET, id, timestamp, rawBody, signature)) {
    return c.json({ error: 'invalid signature' }, 401);
  }

  const event = JSON.parse(rawBody) as ResendEvent;

  if (event.type === 'email.bounced' || event.type === 'email.complained') {
    const to = event.data.to?.[0];
    if (to) {
      await supabase()
        .from('broker_prospects')
        .update({
          email_bounced: true,
          bounce_reason: event.data.bounce?.message || event.type,
        })
        .eq('email', to)
        .eq('status', 'contacted');
    }
  }

  return c.json({ ok: true });
});
