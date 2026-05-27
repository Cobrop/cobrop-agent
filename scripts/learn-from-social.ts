// scripts/learn-from-social.ts
//
// Reads recent LinkedIn + Facebook posts from CoBrop's pages (using the
// access tokens in .env), analyzes voice per platform, and saves
// platform-specific style profiles to agent_knowledge.
//
// Skips a platform if its tokens aren't set — no error, just a notice.

import 'dotenv/config';
import { saveKnowledge } from '../src/learning/style-profile.js';
import { llmJson } from '../src/llm/client.js';
import { SYSTEM_VOICE } from '../src/llm/prompts.js';

console.log('\n📱 CoBrop Agent · learning from social media\n');

const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_ORG = process.env.LINKEDIN_ORG_URN; // e.g. urn:li:organization:12345
const FB_TOKEN = process.env.FACEBOOK_PAGE_TOKEN;
const FB_PAGE = process.env.FACEBOOK_PAGE_ID;

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) {
      console.log(`     · ${url.slice(0, 60)}… → ${r.status}: ${(await r.text()).slice(0, 120)}`);
      return null;
    }
    return (await r.json()) as T;
  } catch (e) {
    console.log(`     · fetch failed: ${(e as Error).message}`);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// LinkedIn
// ──────────────────────────────────────────────────────────────

console.log('1/2  LinkedIn');

if (!LINKEDIN_TOKEN || !LINKEDIN_ORG) {
  console.log('     ⚠ LINKEDIN_ACCESS_TOKEN or LINKEDIN_ORG_URN not set — skipping.');
  console.log('       Get a token at https://www.linkedin.com/developers/ → register a company app.\n');
} else {
  const orgId = LINKEDIN_ORG.split(':').pop();
  // LinkedIn UGC posts endpoint
  const url = `https://api.linkedin.com/v2/posts?author=${encodeURIComponent(LINKEDIN_ORG)}&count=20`;
  const data = await fetchJson<{ elements?: Array<{ commentary?: string; content?: unknown; createdAt?: number }> }>(url, {
    headers: {
      Authorization: `Bearer ${LINKEDIN_TOKEN}`,
      'LinkedIn-Version': '202405',
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });

  const posts = (data?.elements ?? []).filter((p) => p.commentary).slice(0, 20);
  console.log(`     · Found ${posts.length} LinkedIn posts (org id ${orgId})`);

  if (posts.length === 0) {
    console.log('     ⚠ No posts returned. Token may lack r_organization_social scope.\n');
  } else {
    const samples = posts.map((p) => p.commentary || '').filter((t) => t.length > 60);
    let voice = { voice_markers: [] as string[], opening_patterns: [] as string[], hashtag_style: '' as string };
    try {
      const { data: extracted } = await llmJson<typeof voice>({
        system: SYSTEM_VOICE,
        prompt: `Analyze CoBrop's LinkedIn voice from these real posts:

${samples.slice(0, 8).map((s, i) => `=== POST ${i + 1} ===\n${s.slice(0, 600)}\n`).join('\n')}

Output JSON:
{
  "voice_markers": ["<4-6 phrases or patterns specific to CoBrop's LinkedIn voice>"],
  "opening_patterns": ["<3 ways the posts hook readers>"],
  "hashtag_style": "<describe how hashtags are used: position, count, casing>"
}`,
        maxTokens: 500,
        temperature: 0.2,
      });
      voice = extracted;
    } catch (e) {
      console.log(`     ⚠ voice extraction failed: ${(e as Error).message}`);
    }

    await saveKnowledge({
      id: 'voice.linkedin',
      kind: 'style',
      subject: 'cobrop_linkedin',
      summary: `LinkedIn voice from ${samples.length} recent posts`,
      data: { sample_size: samples.length, samples: samples.slice(0, 5), profile: voice } as unknown as Record<string, unknown>,
      sample_size: samples.length,
      confidence: samples.length >= 5 ? 0.9 : 0.6,
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    });
    console.log(`     ✓ Saved LinkedIn voice (${samples.length} posts)\n`);
  }
}

// ──────────────────────────────────────────────────────────────
// Facebook
// ──────────────────────────────────────────────────────────────

console.log('2/2  Facebook');

if (!FB_TOKEN || !FB_PAGE) {
  console.log('     ⚠ FACEBOOK_PAGE_TOKEN or FACEBOOK_PAGE_ID not set — skipping.');
  console.log('       Get a token at https://developers.facebook.com/ → register an app for your page.\n');
} else {
  const url = `https://graph.facebook.com/v19.0/${FB_PAGE}/posts?fields=message,created_time,likes.summary(true),shares&limit=30&access_token=${FB_TOKEN}`;
  const data = await fetchJson<{ data?: Array<{ message?: string; created_time?: string; likes?: { summary?: { total_count?: number } } }> }>(url);

  const posts = (data?.data ?? []).filter((p) => p.message);
  console.log(`     · Found ${posts.length} Facebook posts`);

  if (posts.length === 0) {
    console.log('     ⚠ No posts returned. Check page id + token scopes.\n');
  } else {
    const samples = posts.map((p) => p.message || '').filter((t) => t.length > 40);
    let voice = { voice_markers: [] as string[], opening_patterns: [] as string[], emoji_use: '' as string };
    try {
      const { data: extracted } = await llmJson<typeof voice>({
        system: SYSTEM_VOICE,
        prompt: `Analyze CoBrop's Facebook voice from these real posts:

${samples.slice(0, 8).map((s, i) => `=== POST ${i + 1} ===\n${s.slice(0, 500)}\n`).join('\n')}

Output JSON:
{
  "voice_markers": ["<4-6 phrases or patterns specific to CoBrop's Facebook voice>"],
  "opening_patterns": ["<3 ways the posts hook readers>"],
  "emoji_use": "<describe emoji frequency, where they appear>"
}`,
        maxTokens: 500,
        temperature: 0.2,
      });
      voice = extracted;
    } catch (e) {
      console.log(`     ⚠ voice extraction failed: ${(e as Error).message}`);
    }

    await saveKnowledge({
      id: 'voice.facebook',
      kind: 'style',
      subject: 'cobrop_facebook',
      summary: `Facebook voice from ${samples.length} recent posts`,
      data: { sample_size: samples.length, samples: samples.slice(0, 5), profile: voice } as unknown as Record<string, unknown>,
      sample_size: samples.length,
      confidence: samples.length >= 5 ? 0.9 : 0.6,
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    });
    console.log(`     ✓ Saved Facebook voice (${samples.length} posts)\n`);
  }
}

console.log('═════════════════════════════════════════════════════════');
console.log('✓ Social learning complete.');
console.log('═════════════════════════════════════════════════════════\n');

process.exit(0);
