// src/llm/client.ts — LLM with automatic Groq → Gemini fallback
//
// Why two providers: Groq is fast (~500 tok/s) and free but has a tight
// rate limit (30 req/min on Llama 3.3 70B). Gemini Flash is free for
// 1,500 req/day but slower. Falling back means you can serve ~50k tasks/day
// without spending anything.

import Groq from 'groq-sdk';
import { config } from '../config.js';

export type LlmProvider = 'groq' | 'gemini';

export interface LlmCall {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Force a specific provider; otherwise auto */
  provider?: LlmProvider;
  /** Expect JSON output — sets JSON mode where supported */
  json?: boolean;
}

export interface LlmResponse {
  text: string;
  provider: LlmProvider;
  model: string;
  tokensIn: number;
  tokensOut: number;
  /** Cost in USD — always 0 on free tiers but tracked anyway */
  costUsd: number;
  latencyMs: number;
}

const groq = config.GROQ_API_KEY ? new Groq({ apiKey: config.GROQ_API_KEY }) : null;

// Track per-provider rate-limit state so we don't keep hammering a 429'd endpoint
const cooldown: Record<LlmProvider, number> = { groq: 0, gemini: 0 };

function inCooldown(p: LlmProvider) {
  return Date.now() < cooldown[p];
}

function cooldownFor(p: LlmProvider, ms: number) {
  cooldown[p] = Date.now() + ms;
}

// ── Groq ──────────────────────────────────────────────────────
async function callGroq(call: LlmCall): Promise<LlmResponse> {
  if (!groq) throw new Error('GROQ_API_KEY not set');
  const t0 = Date.now();
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (call.system) messages.push({ role: 'system', content: call.system });
  messages.push({ role: 'user', content: call.prompt });

  const completion = await groq.chat.completions.create({
    model: config.GROQ_MODEL,
    messages,
    temperature: call.temperature ?? 0.4,
    max_tokens: call.maxTokens ?? 1024,
    ...(call.json ? { response_format: { type: 'json_object' } } : {}),
  });

  const text = completion.choices[0]?.message?.content ?? '';
  return {
    text,
    provider: 'groq',
    model: config.GROQ_MODEL,
    tokensIn: completion.usage?.prompt_tokens ?? 0,
    tokensOut: completion.usage?.completion_tokens ?? 0,
    costUsd: 0,
    latencyMs: Date.now() - t0,
  };
}

// ── Gemini (no SDK to keep deps tiny; raw REST) ───────────────
async function callGemini(call: LlmCall): Promise<LlmResponse> {
  if (!config.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  const t0 = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: call.prompt }] }],
    ...(call.system ? { systemInstruction: { parts: [{ text: call.system }] } } : {}),
    generationConfig: {
      temperature: call.temperature ?? 0.4,
      maxOutputTokens: call.maxTokens ?? 1024,
      ...(call.json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return {
    text,
    provider: 'gemini',
    model: config.GEMINI_MODEL,
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
    costUsd: 0,
    latencyMs: Date.now() - t0,
  };
}

// ── Public API ────────────────────────────────────────────────
export async function llm(call: LlmCall): Promise<LlmResponse> {
  const tryOrder: LlmProvider[] = call.provider
    ? [call.provider]
    : ['groq', 'gemini'];

  let lastErr: unknown;
  for (const p of tryOrder) {
    if (inCooldown(p)) continue;
    try {
      if (p === 'groq') return await callGroq(call);
      if (p === 'gemini') return await callGemini(call);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Rate-limited? Cool down 60s and try next provider
      if (/rate|429|quota|throttl/i.test(msg)) {
        cooldownFor(p, 60_000);
        console.warn(`[llm] ${p} rate-limited; falling back`);
        continue;
      }
      // Hard failure — try next provider if available
      console.warn(`[llm] ${p} failed: ${msg}`);
      continue;
    }
  }
  throw new Error(`All LLM providers failed: ${lastErr instanceof Error ? lastErr.message : lastErr}`);
}

/**
 * Convenience: call LLM and parse JSON response. Strips markdown fences,
 * finds the first {…} block, parses, throws on failure.
 */
export async function llmJson<T = unknown>(call: LlmCall): Promise<{ data: T; resp: LlmResponse }> {
  const resp = await llm({ ...call, json: true });
  const cleaned = resp.text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in LLM response: ${resp.text.slice(0, 200)}`);
  const data = JSON.parse(match[0]) as T;
  return { data, resp };
}
