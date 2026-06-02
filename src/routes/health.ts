// src/routes/health.ts — uptime + service status

import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';
import { config, missingKeys } from '../config.js';

export const health = new Hono();

health.get('/', async (c) => {
  let db = 'unknown';
  try {
    const { error } = await supabase().from('agent_config').select('capability').limit(1);
    db = error ? `down: ${error.message}` : 'ok';
  } catch (e) {
    db = `down: ${e instanceof Error ? e.message : e}`;
  }
  return c.json({
    ok: missingKeys.length === 0,
    service: 'cobrop-agent',
    version: '0.1.0',
    env: config.NODE_ENV,
    missing_env: missingKeys,
    llm: {
      primary: { provider: 'groq', model: config.GROQ_MODEL, configured: !!config.GROQ_API_KEY },
      fallback: { provider: 'gemini', model: config.GEMINI_MODEL, configured: !!config.GEMINI_API_KEY },
    },
    db,
    ts: new Date().toISOString(),
  });
});
