// scripts/learn-from-platform.ts
//
// Walks your CoBrop database, learns voice & structure from past content,
// writes the findings into agent_knowledge. Re-run weekly.

import { supabase } from '../src/db/supabase.js';
import { llmJson } from '../src/llm/client.js';
import { saveKnowledge } from '../src/learning/style-profile.js';
import { SYSTEM_VOICE } from '../src/llm/prompts.js';

const sb = supabase();

console.log('\n🧠 CoBrop Agent · learning from your platform\n');

// Safely try a query — returns the data or null if the table/RPC doesn't exist
async function safe<T>(fn: () => Promise<{ data: T | null; error: { message: string } | null }>): Promise<T | null> {
  try {
    const { data, error } = await fn();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// 1. Discover your real schema — list tables, sample rows
// ════════════════════════════════════════════════════════════════

console.log('1/4  Walking your database schema…');

// Try the RPC first (only exists if you ran learning-schema.sql with the helper)
const tableList = await safe<Array<{ table_name: string }>>(() =>
  sb.rpc('list_public_tables') as unknown as Promise<{ data: Array<{ table_name: string }> | null; error: { message: string } | null }>,
);

let tables: string[] = [];
if (tableList && tableList.length > 0) {
  tables = tableList.map((r) => r.table_name);
} else {
  // Fallback — probe a curated list of common CoBrop tables
  const guesses = [
    'properties', 'profiles', 'inquiries', 'agreements', 'transactions',
    'visits', 'blog_posts', 'blogs', 'posts', 'articles',
    'outreach_candidates', 'outreach_log', 'social_posts', 'notifications',
    'users', 'listings',
  ];
  for (const g of guesses) {
    const probe = await safe(() => sb.from(g).select('*').limit(1));
    if (probe !== null) tables.push(g);
  }
}

const schemaMap: {
  tables: Array<{ name: string; row_count_approx: number; columns: string[]; sample: unknown[]; purpose_guess: string }>;
} = { tables: [] };

for (const t of tables) {
  if (t.startsWith('agent_')) continue;
  const { data: rows, count, error } = await sb
    .from(t)
    .select('*', { count: 'estimated', head: false })
    .limit(3);
  if (error || !rows) continue;
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  schemaMap.tables.push({
    name: t,
    row_count_approx: count ?? rows.length,
    columns,
    sample: rows.slice(0, 2).map((r) => redactPII(r as Record<string, unknown>)),
    purpose_guess: guessPurpose(t, columns),
  });
  console.log(`     · ${t.padEnd(28)} ${(count ?? '?').toString().padStart(8)} rows · ${columns.length} cols`);
}

if (schemaMap.tables.length === 0) {
  console.log('     ⚠ No tables found. Did you run schema.sql + learning-schema.sql against the right database?');
  process.exit(1);
}

await saveKnowledge({
  id: 'schema.platform',
  kind: 'schema',
  subject: 'platform',
  summary: `${schemaMap.tables.length} application tables mapped`,
  data: schemaMap as unknown as Record<string, unknown>,
  sample_size: schemaMap.tables.length,
  confidence: 1,
});
console.log(`     ✓ Saved schema map (${schemaMap.tables.length} tables)\n`);

// ════════════════════════════════════════════════════════════════
// 2. Learn blog voice from existing posts
// ════════════════════════════════════════════════════════════════

console.log('2/4  Analyzing blog post voice & structure…');

// Try several common table names
const blogTableCandidates = ['blog_posts', 'blogs', 'posts', 'articles'];
let blogTable: string | null = null;
for (const candidate of blogTableCandidates) {
  const probe = await safe(() => sb.from(candidate).select('*').limit(1));
  if (probe !== null) {
    blogTable = candidate;
    break;
  }
}

if (!blogTable) {
  console.log('     ⚠ No blog table found — skipping. (Agent will use default CoBrop voice.)\n');
} else {
  // Try to fetch posts — we don't know exact column names, so use *
  const posts = await safe<Array<Record<string, unknown>>>(() =>
    sb.from(blogTable!).select('*').limit(30),
  );

  if (!posts || posts.length === 0) {
    console.log(`     ⚠ Table "${blogTable}" exists but has no rows — skipping.\n`);
  } else {
    console.log(`     · Found ${posts.length} posts in "${blogTable}"`);

    // Detect which columns hold the data we care about
    const sample = posts[0];
    const cols = Object.keys(sample);
    const titleCol = cols.find((c) => /title|name|headline/i.test(c)) || 'title';
    const bodyCol = cols.find((c) => /body|content|text|markdown|html/i.test(c)) || 'body';
    const readsCol = cols.find((c) => /reads|views|impressions|hits/i.test(c)) || null;
    const categoryCol = cols.find((c) => /category|tag|topic/i.test(c)) || null;
    const imagesCol = cols.find((c) => /image_urls|images|photos|media/i.test(c)) || null;

    console.log(`     · Detected columns: title="${titleCol}", body="${bodyCol}", reads="${readsCol ?? 'n/a'}"`);

    const stats = posts.map((p) => {
      const body = String(p[bodyCol] ?? '');
      const paras = body.split(/\n\n+/).filter((x) => x.trim());
      const words = body.split(/\s+/).filter(Boolean).length;
      const reads = readsCol ? Number(p[readsCol]) || 0 : 0;
      const images = imagesCol ? ((p[imagesCol] as unknown[] | null)?.length ?? 0) : 0;
      const category = categoryCol ? String(p[categoryCol] ?? 'uncategorized') : 'uncategorized';
      return {
        title: String(p[titleCol] ?? '(untitled)'),
        body,
        reads,
        words,
        paras: paras.length,
        firstPara: paras[0] || '',
        images,
        category,
      };
    });

    const avg = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
    const median = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };

    // Sort by reads if we have them, otherwise just take first 4 / last 3
    const sorted = readsCol ? [...stats].sort((a, b) => b.reads - a.reads) : stats;
    const top = sorted.slice(0, Math.min(4, posts.length));
    const low = readsCol ? sorted.slice(-3).reverse() : stats.slice(-3);

    // Categories
    const catMap = new Map<string, { count: number; reads: number }>();
    for (const p of stats) {
      const cur = catMap.get(p.category) ?? { count: 0, reads: 0 };
      cur.count++;
      cur.reads += p.reads;
      catMap.set(p.category, cur);
    }
    const categories = [...catMap.entries()]
      .map(([category, v]) => ({ category, count: v.count, avg_reads: Math.round(v.reads / v.count) }))
      .sort((a, b) => b.avg_reads - a.avg_reads);

    console.log('     · Asking LLM to extract voice patterns…');
    const samplesForLLM = top
      .map((p) => `=== "${p.title}" (${p.reads || '?'} reads) ===\n${p.firstPara.slice(0, 400)}\n`)
      .join('\n');
    const lowSamplesForLLM = low
      .map((p) => `=== "${p.title}" (${p.reads || '?'} reads) ===\n${(p.firstPara || '').slice(0, 280)}\n`)
      .join('\n');

    let voice: {
      voice_markers: string[];
      banned_phrases: string[];
      opening_patterns: string[];
      top_lessons: string[];
      low_lessons: string[];
    } = { voice_markers: [], banned_phrases: [], opening_patterns: [], top_lessons: [], low_lessons: [] };

    try {
      const { data } = await llmJson<typeof voice>({
        system: SYSTEM_VOICE,
        prompt: `Analyze CoBrop's actual blog voice from these high-performing and low-performing samples.

HIGH PERFORMERS (write like this):
${samplesForLLM}

LOW PERFORMERS (avoid these patterns):
${lowSamplesForLLM || '(none — not enough variation in data)'}

Output JSON:
{
  "voice_markers": ["<4 to 8 phrases or stylistic choices CoBrop actually uses>"],
  "banned_phrases": ["<2 to 5 cliché patterns to never use>"],
  "opening_patterns": ["<3 templates describing how the top posts open>"],
  "top_lessons": ["<${top.length} items, one one-sentence lesson per top sample, in order>"],
  "low_lessons": ["<${low.length} items, one one-sentence lesson per low sample, in order>"]
}`,
        maxTokens: 800,
        temperature: 0.3,
      });
      voice = data;
    } catch (err) {
      console.log(`     ⚠ Voice extraction failed (will use defaults): ${(err as Error).message}`);
    }

    const profile = {
      sample_size: posts.length,
      avg_word_count: avg(stats.map((s) => s.words)),
      median_word_count: median(stats.map((s) => s.words)),
      avg_paragraph_count: avg(stats.map((s) => s.paras)),
      avg_read_time_min: Math.max(1, Math.round(avg(stats.map((s) => s.words)) / 220)),
      most_common_categories: categories.slice(0, 6),
      opening_patterns: voice.opening_patterns ?? [],
      voice_markers: voice.voice_markers ?? [],
      banned_phrases: voice.banned_phrases ?? [],
      structure_template: {
        has_hook_stat: top.some((p) => /\d/.test(p.firstPara.slice(0, 200))),
        has_broker_quote: top.some((p) => /"[^"]{30,}"/.test(p.body)),
        has_h2_sections: top.some((p) => /\n##\s/.test(p.body) || /<h2/i.test(p.body)),
        cta_positions: detectCtaPositions(top.map((p) => p.body)),
        images_per_post_avg: avg(stats.map((s) => s.images)),
      },
      top_performers: top.map((p, i) => ({
        title: p.title,
        reads: p.reads,
        lesson: voice.top_lessons?.[i] || 'Strong opener and concrete examples.',
      })),
      low_performers: low.map((p, i) => ({
        title: p.title,
        reads: p.reads,
        lesson: voice.low_lessons?.[i] || 'Generic framing, no specifics.',
      })),
      detected_columns: { titleCol, bodyCol, readsCol, categoryCol, imagesCol },
    };

    await saveKnowledge({
      id: 'style.blog_posts',
      kind: 'style',
      subject: blogTable,
      summary: `Blog voice from ${posts.length} posts · ${profile.avg_word_count} avg words`,
      data: profile as unknown as Record<string, unknown>,
      sample_size: posts.length,
      confidence: posts.length >= 10 ? 0.92 : 0.7,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    console.log(`     ✓ Saved blog style profile (${posts.length} posts analyzed)\n`);
  }
}

// ════════════════════════════════════════════════════════════════
// 3. Learn listing description patterns
// ════════════════════════════════════════════════════════════════

console.log('3/4  Analyzing listing descriptions…');

const listingTableCandidates = ['properties', 'listings'];
let listingTable: string | null = null;
for (const candidate of listingTableCandidates) {
  const probe = await safe(() => sb.from(candidate).select('*').limit(1));
  if (probe !== null) {
    listingTable = candidate;
    break;
  }
}

if (!listingTable) {
  console.log('     ⚠ No listings table found — skipping.\n');
} else {
  const listings = await safe<Array<Record<string, unknown>>>(() =>
    sb.from(listingTable!).select('*').limit(40),
  );

  if (!listings || listings.length === 0) {
    console.log(`     ⚠ "${listingTable}" exists but is empty — skipping.\n`);
  } else {
    const cols = Object.keys(listings[0]);
    const descCol = cols.find((c) => /description|details|body/i.test(c)) || 'description';
    const featuresCol = cols.find((c) => /features|amenities|tags/i.test(c)) || null;
    const priceCol = cols.find((c) => /^price$|price_formatted/i.test(c)) || 'price';

    const withDesc = listings.filter((l) => l[descCol]);
    if (withDesc.length === 0) {
      console.log(`     ⚠ "${listingTable}" has no descriptions yet — skipping.\n`);
    } else {
      const wordCounts = withDesc.map((l) => String(l[descCol] ?? '').split(/\s+/).filter(Boolean).length);
      const featureCounts = new Map<string, number>();
      for (const l of withDesc) {
        const features = featuresCol ? ((l[featuresCol] as string[] | null) || []) : [];
        for (const f of features) {
          if (typeof f === 'string') featureCounts.set(f, (featureCounts.get(f) ?? 0) + 1);
        }
      }
      const top10Features = [...featureCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([f]) => f);
      const openers = withDesc.slice(0, 4).map((l) => String(l[descCol] ?? '').slice(0, 100));
      const priceExamples = [...new Set(withDesc.map((l) => String(l[priceCol] ?? '').slice(0, 30)))].slice(0, 4);

      await saveKnowledge({
        id: 'pattern.properties',
        kind: 'pattern',
        subject: listingTable,
        summary: `Listing patterns from ${withDesc.length} descriptions · avg ${Math.round(
          wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length,
        )} words`,
        data: {
          sample_size: withDesc.length,
          avg_description_words: Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length),
          common_features_top10: top10Features,
          price_format_examples: priceExamples,
          description_openers: openers,
          detected_columns: { descCol, featuresCol, priceCol },
        },
        sample_size: withDesc.length,
        confidence: 0.88,
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      });
      console.log(`     ✓ Saved listing pattern (${withDesc.length} samples from "${listingTable}")\n`);
    }
  }
}

// ════════════════════════════════════════════════════════════════
// 4. Learn outreach style (optional — only if you have history)
// ════════════════════════════════════════════════════════════════

console.log('4/4  Analyzing outreach history (if any)…');

const outreach = await safe<Array<Record<string, unknown>>>(() =>
  sb.from('outreach_log').select('*').limit(40),
);

if (!outreach || outreach.length === 0) {
  console.log('     ⚠ No outreach history yet — agent will use defaults until you have some.\n');
} else {
  const replied = outreach.filter((o) => o.replied);
  await saveKnowledge({
    id: 'pattern.outreach',
    kind: 'pattern',
    subject: 'outreach_log',
    summary: `Outreach style from ${outreach.length} historical messages · ${replied.length} replied`,
    data: {
      sample_size: outreach.length,
      reply_rate: outreach.length ? replied.length / outreach.length : 0,
      languages_used: [...new Set(outreach.map((o) => o.language as string).filter(Boolean))],
      channels_used: [...new Set(outreach.map((o) => o.channel as string).filter(Boolean))],
      best_replied_sample: (replied[0]?.message as string) || null,
    },
    sample_size: outreach.length,
    confidence: outreach.length >= 10 ? 0.85 : 0.5,
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  });
  console.log(`     ✓ Saved outreach pattern (${outreach.length} samples)\n`);
}

console.log('═════════════════════════════════════════════════════════');
console.log('✓ Learning complete. The agent now knows your platform.');
console.log('═════════════════════════════════════════════════════════\n');
console.log('To inspect what was learned, run this in Supabase SQL editor:');
console.log('  select id, summary, sample_size, confidence from agent_knowledge order by built_at desc;\n');

process.exit(0);

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

function redactPII(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (/email|phone|password|token|secret|api_key/i.test(k) && typeof v === 'string') {
      out[k] = '<redacted>';
    } else if (typeof v === 'string' && v.length > 200) {
      out[k] = v.slice(0, 200) + '…';
    } else {
      out[k] = v;
    }
  }
  return out;
}

function guessPurpose(name: string, columns: string[]): string {
  const cs = columns.join(' ');
  if (/title|description|body/i.test(cs) && /property|listing|address|price/i.test(name + cs))
    return 'Property listings';
  if (/handle|email|tier/i.test(cs) && /profile|user|broker/i.test(name)) return 'Broker / user profiles';
  if (/message|inquiry/i.test(name + cs)) return 'Lead inquiries from prospective buyers';
  if (/blog|post|article/i.test(name)) return 'Long-form content';
  if (/visit|appointment|scheduled/i.test(name + cs)) return 'Scheduled property visits';
  if (/transaction|payment|invoice/i.test(name + cs)) return 'Payments / commissions';
  if (/agreement|contract/i.test(name + cs)) return 'Co-brokerage agreements';
  if (/notification/i.test(name)) return 'In-app + push notifications';
  return 'application table';
}

function detectCtaPositions(bodies: string[]): string[] {
  let mid = 0,
    end = 0;
  for (const body of bodies) {
    const half = Math.floor(body.length / 2);
    if (/(sign up|try|join|book a|schedule|get started|learn more)/i.test(body.slice(0, half))) mid++;
    if (/(sign up|try|join|book a|schedule|get started|learn more)/i.test(body.slice(half))) end++;
  }
  const out: string[] = [];
  if (mid >= bodies.length / 2) out.push('mid');
  if (end >= bodies.length / 2) out.push('end');
  return out.length ? out : ['end'];
}
