// scripts/learn-from-web.ts
//
// Crawls https://www.cobrop.com — main marketing pages + the blog index +
// the top blog posts — and saves the extracted text + structural notes
// into agent_knowledge so the agent can mimic CoBrop's actual web voice.
//
// Re-run weekly. Free, no API keys, just fetch.

import 'dotenv/config';
import { saveKnowledge } from '../src/learning/style-profile.js';
import { llmJson } from '../src/llm/client.js';
import { config } from '../src/config.js';
import { SYSTEM_VOICE } from '../src/llm/prompts.js';

const ROOT = config.COBROP_WEB_URL.replace(/\/$/, '');

// Pages to learn marketing voice from
const MARKETING_PATHS = ['/', '/about', '/how-it-works', '/brokers', '/faq', '/pricing', '/contact'];

console.log('\n🌐 CoBrop Agent · learning from cobrop.com\n');
console.log(`   Root: ${ROOT}\n`);

// ────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'CoBropAgentLearner/0.1 (+https://cobrop.com)' },
      // 10s timeout
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      console.log(`     · ${url} → ${r.status}`);
      return null;
    }
    return await r.text();
  } catch (e) {
    console.log(`     · ${url} → fetch failed: ${(e as Error).message}`);
    return null;
  }
}

function stripHtml(html: string): { title: string; text: string; h1: string[]; h2: string[]; images: number } {
  // Remove scripts, styles, SVG defs
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '');

  const title = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  const h1 = [...s.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
  const h2 = [...s.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
  const images = (s.match(/<img\s/gi) ?? []).length;

  // Strip nav/footer aggressively
  s = s.replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, '');
  // Convert to plain text
  const text = stripTags(s).replace(/\s+/g, ' ').trim();
  return { title, text, h1, h2, images };
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

// ────────────────────────────────────────────────────────────
// 1. Marketing pages
// ────────────────────────────────────────────────────────────

console.log('1/2  Crawling marketing pages…');

const marketingPages: Array<{ path: string; title: string; h1: string[]; h2: string[]; text: string; images: number }> = [];

for (const path of MARKETING_PATHS) {
  const html = await fetchHtml(ROOT + path);
  if (!html) continue;
  const parsed = stripHtml(html);
  if (parsed.text.length < 80) {
    console.log(`     · ${path} → too thin (${parsed.text.length} chars), skip`);
    continue;
  }
  marketingPages.push({ path, ...parsed, text: parsed.text.slice(0, 4000) });
  console.log(`     · ${path.padEnd(20)} ${parsed.text.length.toString().padStart(6)} chars · ${parsed.h2.length} H2 · ${parsed.images} imgs`);
}

if (marketingPages.length === 0) {
  console.log('     ⚠ No marketing pages crawled (site may be SPA-rendered).');
  console.log('       If cobrop.com is React/Vite, the agent will still learn from the database.\n');
} else {
  // Have the LLM extract marketing voice from these pages
  console.log('     · Asking LLM to summarize marketing voice…');

  let marketingProfile = {
    elevator_pitch: '',
    value_props: [] as string[],
    target_audience: '',
    cta_style: [] as string[],
    voice_markers: [] as string[],
    banned_phrases: [] as string[],
    geographic_focus: [] as string[],
  };

  try {
    const { data } = await llmJson<typeof marketingProfile>({
      system: SYSTEM_VOICE,
      prompt: `Analyze CoBrop's actual marketing voice from these pages of cobrop.com:

${marketingPages.map((p) => `=== PAGE: ${p.path} ===\nTitle: ${p.title}\nH1: ${p.h1.join(' | ')}\nH2: ${p.h2.join(' | ')}\n\n${p.text.slice(0, 1500)}\n`).join('\n')}

Output JSON. Be SPECIFIC — use what CoBrop actually says, not generic real-estate copy:
{
  "elevator_pitch": "<1 sentence: what CoBrop is, in CoBrop's own framing>",
  "value_props": ["<3-5 actual value props from the pages>"],
  "target_audience": "<who CoBrop is for, 1 sentence>",
  "cta_style": ["<2-3 actual CTAs found, in CoBrop's words>"],
  "voice_markers": ["<4-6 phrases or stylistic patterns CoBrop uses>"],
  "banned_phrases": ["<2-3 cliches or words CoBrop notably avoids>"],
  "geographic_focus": ["<countries / regions CoBrop names>"]
}`,
      maxTokens: 900,
      temperature: 0.2,
    });
    marketingProfile = data;
  } catch (e) {
    console.log(`     ⚠ Voice extraction failed: ${(e as Error).message}`);
  }

  await saveKnowledge({
    id: 'voice.marketing',
    kind: 'style',
    subject: 'cobrop_website',
    summary: `Marketing voice from ${marketingPages.length} pages on cobrop.com`,
    data: {
      sample_size: marketingPages.length,
      source_url: ROOT,
      pages_crawled: marketingPages.map((p) => ({ path: p.path, title: p.title, char_count: p.text.length })),
      profile: marketingProfile,
      raw_samples: marketingPages.map((p) => ({ path: p.path, title: p.title, h1: p.h1, h2: p.h2, excerpt: p.text.slice(0, 800) })),
    } as unknown as Record<string, unknown>,
    sample_size: marketingPages.length,
    confidence: marketingPages.length >= 3 ? 0.9 : 0.6,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  console.log(`     ✓ Saved marketing voice profile (${marketingPages.length} pages)\n`);
}

// ────────────────────────────────────────────────────────────
// 2. Blog index + top posts (HTML rendering)
// ────────────────────────────────────────────────────────────

console.log('2/2  Crawling /blog index + top posts…');

const blogIndexHtml = await fetchHtml(`${ROOT}/blog`);
if (!blogIndexHtml) {
  console.log('     ⚠ Could not fetch /blog (may be SPA-rendered).\n');
} else {
  const indexParsed = stripHtml(blogIndexHtml);
  // Find blog post URLs — match /blog/<slug>
  const allLinks = [...blogIndexHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const blogLinks = [...new Set(allLinks.filter((l) => /\/blog\/[^/?#]+$/.test(l) && !l.endsWith('/blog')))];
  const absolute = blogLinks.map((l) => (l.startsWith('http') ? l : ROOT + l)).slice(0, 8);

  console.log(`     · Index has ${absolute.length} blog post links`);

  const blogPosts: Array<{ url: string; title: string; h1: string[]; h2: string[]; text: string; images: number }> = [];
  for (const url of absolute) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const parsed = stripHtml(html);
    if (parsed.text.length < 300) continue;
    blogPosts.push({ url, ...parsed, text: parsed.text.slice(0, 3500) });
    console.log(`     · ${url.replace(ROOT, '').padEnd(40)} ${parsed.text.length.toString().padStart(6)} chars · ${parsed.images} imgs`);
  }

  if (blogPosts.length === 0) {
    console.log('     ⚠ No blog posts could be parsed from /blog (likely SPA-rendered).');
    console.log('       The agent already learned from the 27 blog_posts rows in Supabase — that\'s the canonical source anyway.\n');
  } else {
    await saveKnowledge({
      id: 'voice.blog_html',
      kind: 'style',
      subject: 'cobrop_blog_html',
      summary: `Blog HTML samples from ${blogPosts.length} live cobrop.com/blog pages`,
      data: {
        sample_size: blogPosts.length,
        source_root: ROOT + '/blog',
        index_h2: indexParsed.h2,
        posts: blogPosts.map((p) => ({
          url: p.url,
          title: p.title,
          h1: p.h1,
          h2: p.h2,
          excerpt: p.text.slice(0, 1200),
          images: p.images,
        })),
      } as unknown as Record<string, unknown>,
      sample_size: blogPosts.length,
      confidence: 0.85,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    console.log(`     ✓ Saved blog HTML voice (${blogPosts.length} live posts)\n`);
  }
}

console.log('═════════════════════════════════════════════════════════');
console.log('✓ Web learning complete.');
console.log('═════════════════════════════════════════════════════════\n');

process.exit(0);
