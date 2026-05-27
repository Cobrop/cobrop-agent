// scripts/learn-from-platform-code.ts
//
// Reads the CoProp-Website folder so the agent understands the product:
//   - public/   → inventory of assets (logos, brand images, screenshots)
//   - src/pages → what each page says (visible copy from .tsx/.jsx)
//
// Path is set via PLATFORM_CODE_DIR in .env, e.g.:
//   PLATFORM_CODE_DIR=C:\Users\X1\Desktop\All in One F Dell\CoProp\07202025_vf\CoProp-Website
//
// Re-run after platform updates.

import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { saveKnowledge } from '../src/learning/style-profile.js';
import { config } from '../src/config.js';
import { llmJson } from '../src/llm/client.js';
import { SYSTEM_VOICE } from '../src/llm/prompts.js';

console.log('\n🧩 CoBrop Agent · learning from platform code\n');

const PLATFORM = config.PLATFORM_CODE_DIR;

if (!PLATFORM) {
  console.log('⚠ PLATFORM_CODE_DIR not set in .env. Skipping.');
  console.log('  Add to .env: PLATFORM_CODE_DIR=C:\\Users\\X1\\Desktop\\All in One F Dell\\CoProp\\07202025_vf\\CoProp-Website\n');
  process.exit(0);
}

console.log(`   Root: ${PLATFORM}\n`);

// Verify the folder exists
try {
  await fs.access(PLATFORM);
} catch {
  console.error(`✗ Cannot read PLATFORM_CODE_DIR: ${PLATFORM}`);
  console.error('  Check the path and your file permissions.\n');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────
// 1. public/ inventory  (asset catalog)
// ──────────────────────────────────────────────────────────────

console.log('1/2  Inventorying public/ assets…');

interface Asset {
  path: string;
  size: number;
  type: 'image' | 'svg' | 'video' | 'doc' | 'other';
}

async function* walk(dir: string, base = dir): AsyncGenerator<string> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    // Skip noise
    if (e.name === 'node_modules' || e.name.startsWith('.git') || e.name === 'dist' || e.name === 'build') continue;
    if (e.isDirectory()) yield* walk(full, base);
    else yield path.relative(base, full).replace(/\\/g, '/');
  }
}

const publicDir = path.join(PLATFORM, 'public');
const assets: Asset[] = [];

try {
  await fs.access(publicDir);
  for await (const rel of walk(publicDir)) {
    try {
      const st = await fs.stat(path.join(publicDir, rel));
      const ext = path.extname(rel).toLowerCase().slice(1);
      let type: Asset['type'] = 'other';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'].includes(ext)) type = 'image';
      else if (ext === 'svg') type = 'svg';
      else if (['mp4', 'webm', 'mov'].includes(ext)) type = 'video';
      else if (['pdf', 'doc', 'docx'].includes(ext)) type = 'doc';
      assets.push({ path: rel, size: st.size, type });
    } catch {
      // ignore
    }
  }
  console.log(`     · ${assets.length} assets catalogued`);
} catch {
  console.log(`     ⚠ No public/ folder at ${publicDir} — skipping inventory.`);
}

// Group + highlight likely-brand assets
const brandHits = assets.filter((a) =>
  /logo|brand|favicon|hero|cover|og-image/i.test(a.path),
);
console.log(`     · Identified ${brandHits.length} likely brand/marketing assets`);

await saveKnowledge({
  id: 'inventory.public',
  kind: 'guide',
  subject: 'platform_assets',
  summary: `${assets.length} assets in public/ · ${brandHits.length} flagged as brand/marketing`,
  data: {
    root: publicDir,
    total: assets.length,
    by_type: assets.reduce<Record<string, number>>((acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + 1;
      return acc;
    }, {}),
    brand_assets: brandHits.map((a) => ({ path: a.path, size_kb: Math.round(a.size / 1024) })),
    all_assets: assets.map((a) => ({ path: a.path, type: a.type, size_kb: Math.round(a.size / 1024) })),
  } as unknown as Record<string, unknown>,
  sample_size: assets.length,
  confidence: 1,
  expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
});
console.log(`     ✓ Saved public/ inventory\n`);

// ──────────────────────────────────────────────────────────────
// 2. src/pages — extract visible page copy
// ──────────────────────────────────────────────────────────────

console.log('2/2  Reading src/pages to learn product copy…');

const pagesDir = path.join(PLATFORM, 'src', 'pages');

interface PageSummary {
  file: string;
  page_name: string;
  text_snippets: string[];
  size_chars: number;
}

const pages: PageSummary[] = [];

try {
  await fs.access(pagesDir);
  for await (const rel of walk(pagesDir)) {
    if (!/\.(tsx|jsx|ts|js)$/.test(rel)) continue;
    const full = path.join(pagesDir, rel);
    let src: string;
    try {
      src = await fs.readFile(full, 'utf8');
    } catch {
      continue;
    }
    if (src.length > 250_000) continue; // skip huge files

    // Pull visible strings: anything inside JSX text + most string literals over 12 chars
    const jsxText = [...src.matchAll(/>\s*([^<>{][^<>{}]{12,}[^<>])\s*</g)].map((m) => m[1].trim());
    const stringLiterals = [...src.matchAll(/["'`]([^"'`\n]{20,180})["'`]/g)].map((m) => m[1].trim());

    // Filter out paths, props, imports, common code-only strings
    const looksLikeCopy = (s: string) =>
      !/^(\/|@|https?:|class|on[A-Z]|data-|aria-|use[A-Z]|to-|from-|bg-|text-|flex|grid|sm:|md:|lg:|xl:)/i.test(s) &&
      !/[\\{}<>]/.test(s) &&
      /[a-z]/i.test(s) &&
      /[ .,!?]/.test(s) &&
      s.split(' ').length >= 3;

    const snippets = [...new Set([...jsxText, ...stringLiterals].filter(looksLikeCopy))].slice(0, 30);
    if (snippets.length === 0) continue;

    pages.push({
      file: rel.replace(/\\/g, '/'),
      page_name: path.basename(rel, path.extname(rel)),
      text_snippets: snippets,
      size_chars: src.length,
    });
  }
  console.log(`     · Parsed ${pages.length} page files for visible copy`);
} catch {
  console.log(`     ⚠ No src/pages folder at ${pagesDir} — skipping.`);
}

if (pages.length > 0) {
  // Ask LLM to summarize what each page does, in CoBrop's voice
  console.log('     · Asking LLM to summarize the product surface…');

  let productMap = {
    elevator_pitch: '',
    pages: [] as Array<{ name: string; purpose: string }>,
    capabilities_surfaced: [] as string[],
    user_journeys: [] as string[],
  };

  // Take the top ~15 pages by content density to fit the prompt
  const ranked = [...pages].sort((a, b) => b.text_snippets.length - a.text_snippets.length).slice(0, 15);

  try {
    const { data } = await llmJson<typeof productMap>({
      system: SYSTEM_VOICE,
      prompt: `Read these page snippets from CoBrop's actual frontend code and summarize what the product does.

${ranked.map((p) => `=== ${p.page_name} (${p.file}) ===\n${p.text_snippets.slice(0, 10).join(' · ')}\n`).join('\n')}

Output JSON. Be specific to CoBrop, not generic:
{
  "elevator_pitch": "<1 sentence: what the product does, from a user's perspective>",
  "pages": [{"name":"<page name>","purpose":"<1 sentence what that page does>"}, ...],
  "capabilities_surfaced": ["<4-8 things CoBrop lets users do, in user-facing language>"],
  "user_journeys": ["<3-5 typical journeys: broker signing up, posting a listing, etc>"]
}`,
      maxTokens: 1400,
      temperature: 0.2,
    });
    productMap = data;
  } catch (e) {
    console.log(`     ⚠ LLM summarization failed: ${(e as Error).message}`);
  }

  await saveKnowledge({
    id: 'guide.platform_pages',
    kind: 'guide',
    subject: 'platform_pages',
    summary: `Product surface from ${pages.length} page files in src/pages`,
    data: {
      sample_size: pages.length,
      product_map: productMap,
      pages_indexed: pages.map((p) => ({ file: p.file, name: p.page_name, snippet_count: p.text_snippets.length })),
      page_copy_excerpts: ranked.map((p) => ({ file: p.file, name: p.page_name, snippets: p.text_snippets.slice(0, 8) })),
    } as unknown as Record<string, unknown>,
    sample_size: pages.length,
    confidence: 0.9,
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  console.log(`     ✓ Saved product knowledge (${pages.length} pages indexed)\n`);
}

console.log('═════════════════════════════════════════════════════════');
console.log('✓ Platform code learning complete.');
console.log('═════════════════════════════════════════════════════════\n');

process.exit(0);
