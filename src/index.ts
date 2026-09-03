// src/index.ts — server entry. Runs the Hono HTTP server. The queue worker
// runs in-process for local dev; on Vercel/CF, tasks are processed by the
// /agent/cron/tick endpoint hit on a schedule.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { config } from './config.js';
import { startWorker } from './queue/worker.js';

import { health } from './routes/health.js';
import { webhooks } from './routes/webhooks.js';
import { approvals } from './routes/approvals.js';
import { agent } from './routes/agent.js';
import { resendWebhook } from './routes/resend-webhook.js';

const app = new Hono();

app.use('*', cors({
  origin: '*', // tighten this in production
  allowMethods: ['GET', 'POST'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Secret', 'X-Cron-Secret'],
}));

app.route('/health', health);
app.route('/webhooks', webhooks);
app.route('/approvals', approvals);
app.route('/agent', agent);
// Separate top-level mount (not under /webhooks) so there's zero ambiguity
// about whether the generic WEBHOOK_SECRET middleware on the webhooks
// router could ever apply here — Resend's Svix signing is verified
// entirely inside resend-webhook.ts instead.
app.route('/resend-webhook', resendWebhook);

app.get('/', (c) =>
  c.json({
    service: 'cobrop-agent',
    docs: 'See README.md',
    endpoints: ['/health', '/webhooks/*', '/approvals', '/agent/draft', '/agent/run', '/agent/kpis', '/agent/activity', '/agent/cron/tick', '/agent/prospects', '/resend-webhook'],
  }),
);

// ── Static file serving (admin dashboard + assets in public/) ────
// Catches any request not matched by the API routes above.
// Files live in public/ — e.g. public/live-admin.html → /live-admin.html
app.use('/*', serveStatic({ root: './public' }));

// In serverless environments (Vercel / Cloudflare), don't start the
// in-process worker — it would die after the response. Instead a scheduled
// cron hits /agent/cron/tick to drain a few tasks per minute.
const IS_SERVERLESS = !!(process.env.VERCEL || process.env.CF_PAGES);

// The queue worker is OPT-IN. It used to start automatically with any local
// `tsx src/index.ts`, then poll claim_next_agent_task forever — a dev server
// left running in a background terminal is invisible and quietly burns Supabase
// egress for days. Nothing starts it now unless AGENT_WORKER=1 is set
// explicitly, and /agent/cron/tick still drains the queue on demand.
const WORKER_ENABLED = process.env.AGENT_WORKER === '1';

if (!IS_SERVERLESS) {
  const port = config.PORT;
  console.log(`\n✓ CoBrop Agent · listening on http://localhost:${port}`);
  console.log(`✓ LLM: groq (${config.GROQ_MODEL})${config.GEMINI_API_KEY ? ` · fallback: gemini (${config.GEMINI_MODEL})` : ''}`);
  console.log(`✓ Supabase: ${config.SUPABASE_URL.replace(/^https?:\/\//, '').slice(0, 40)}\n`);

  serve({ fetch: app.fetch, port });
  if (WORKER_ENABLED) {
    startWorker();
  } else {
    console.log('· Queue worker OFF (set AGENT_WORKER=1 to enable). Drain with POST /agent/cron/tick\n');
  }
}

export default app;
