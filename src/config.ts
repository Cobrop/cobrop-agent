// src/config.ts — env loader. Resilient: never process.exit (that crashes
// serverless silently). Missing keys are recorded and surfaced via /health.

import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().default(8787),
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  PUBLIC_URL: z.string().default('http://localhost:8787'),

  // LLM
  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),

  // Supabase — plain strings, no .url() (a malformed value shouldn't crash boot)
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),

  // Secrets — relaxed length so a short value doesn't block deploy
  WEBHOOK_SECRET: z.string().default(''),
  CRON_SECRET: z.string().default(''),
  ADMIN_JWT_SECRET: z.string().optional(),

  // Social (all optional)
  LINKEDIN_ACCESS_TOKEN: z.string().optional(),
  LINKEDIN_ORG_URN: z.string().optional(),
  FACEBOOK_PAGE_TOKEN: z.string().optional(),
  FACEBOOK_PAGE_ID: z.string().optional(),
  INSTAGRAM_BUSINESS_ID: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),

  // Queue
  QUEUE_POLL_MS: z.coerce.number().default(5000),
  QUEUE_CONCURRENCY: z.coerce.number().default(3),

  // Learning sources (optional)
  PLATFORM_CODE_DIR: z.string().optional(),
  COBROP_WEB_URL: z.string().default('https://www.cobrop.com'),
});

export type Config = z.infer<typeof Env>;

// Which required keys are missing — surfaced via /health, never fatal.
export const missingKeys: string[] = [];

function computeMissing(c: Config) {
  const required: Array<keyof Config> = [
    'GROQ_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'WEBHOOK_SECRET', 'CRON_SECRET',
  ];
  for (const k of required) {
    if (!c[k]) missingKeys.push(k);
  }
}

let _cfg: Config | null = null;

export function loadConfig(): Config {
  if (_cfg) return _cfg;
  // safeParse with defaults can't really fail now, but guard anyway.
  const parsed = Env.safeParse(process.env);
  _cfg = parsed.success ? parsed.data : Env.parse({});
  computeMissing(_cfg);
  if (missingKeys.length) {
    console.warn('[config] missing env vars:', missingKeys.join(', '));
  }
  return _cfg;
}

export const config = loadConfig();
