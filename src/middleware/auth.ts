// src/middleware/auth.ts — verify webhook + admin requests

import type { Context, Next } from 'hono';
import { config } from '../config.js';

export const verifyWebhook = async (c: Context, next: Next) => {
  const provided = c.req.header('x-webhook-secret') || c.req.query('secret');
  if (provided !== config.WEBHOOK_SECRET) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
};

export const verifyCron = async (c: Context, next: Next) => {
  // Vercel's own Cron Jobs auto-inject `Authorization: Bearer $CRON_SECRET`
  // (matching the CRON_SECRET env var already set here) — accept that
  // alongside the explicit header/query param used by GitHub Actions and
  // manual calls, so the vercel.json cron path never needs the secret
  // written into it (this repo is public).
  const bearer = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const provided = c.req.header('x-cron-secret') || c.req.query('secret') || bearer;
  if (provided !== config.CRON_SECRET) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
};

// For the admin console — accept a shared secret OR a valid Supabase JWT
// In production, decode and verify the JWT via Supabase's JWKS endpoint.
export const verifyAdmin = async (c: Context, next: Next) => {
  const auth = c.req.header('authorization');
  if (!auth) return c.json({ error: 'unauthorized' }, 401);
  // Accept Bearer <SUPABASE_SERVICE_ROLE_KEY> for now (matches the console's existing auth)
  if (auth === `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`) {
    await next();
    return;
  }
  return c.json({ error: 'unauthorized' }, 401);
};
