// src/config.ts — env loader with validation

import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  // server
  PORT: z.coerce.number().default(8787),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PUBLIC_URL: z.string().default('http://localhost:8787'),

  // LLM
  GROQ_API_KEY: z.string().min(1, 'Get one at https://console.groq.com/keys'),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Secrets
  WEBHOOK_SECRET: z.string().min(16, 'Use a 32+ char random string'),
  CRON_SECRET: z.string().min(16, 'Use a 32+ char random string'),
  ADMIN_JWT_SECRET: z.string().min(16).optional(),

  // Social
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

 // Learning sources (all optional)
  PLATFORM_CODE_DIR: z.string().optional(),
  COBROP_WEB_URL: z.string().default('https://www.cobrop.com'),
});

export type Config = z.infer<typeof Env>;

let _cfg: Config | null = null;

export function loadConfig(): Config {
  if (_cfg) return _cfg;
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    console.error('\n✗ Invalid configuration:\n');
    for (const issue of parsed.error.issues) {
      console.error(`  · ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nCopy .env.example to .env and fill in the missing values.\n');
    process.exit(1);
  }
  _cfg = parsed.data;
  return _cfg;
}

export const config = loadConfig();
