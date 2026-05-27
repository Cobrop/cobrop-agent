// src/capabilities/blog-draft.ts — learn-aware blog post drafter
//
// Triggered by:  weekly cron (gap detection) or manual ("draft post about X")
// Default autonomy: assist (always force_approval=true — admin reads before publish)
//
// Reads CoBrop's learned blog voice (built by `npm run learn`), drafts a
// full long-form post in that style, and writes the draft to agent_actions.
// The admin reviews + publishes through your existing admin portal at
// /admin/dashboard → Blog → Add blog.

import { llmJson } from '../llm/client.js';
import { SYSTEM_VOICE } from '../llm/prompts.js';
import { supabase } from '../db/supabase.js';
import { loadBlogStyle, loadProductKnowledge, styleFragmentForBlog, productFragment } from '../learning/style-profile.js';
import type { Capability, CapabilityResult, ExecuteResult } from '../types.js';

interface Input {
  title: string;
  category?: string;
  data_points?: string[];   // optional: stats / quotes to anchor the post
  target_words?: number;    // optional override; otherwise we use learned median
}

interface ProposalData {
  title: string;
  category: string;
  intro: string;
  problem: string;
  promise: string;
  first_section: string;
  body: string;          // joined paragraphs
  stats_used: string[];
  target_length_words: number;
  meta_description: string;
  suggested_image_prompts: string[];
}

export const blogDraft: Capability<Input> = {
  name: 'blog-draft',

  async reason(input): Promise<CapabilityResult> {
    const sb = supabase();
    const t0 = Date.now();
    const trace: CapabilityResult['trace'] = [];

    // 1. Load CoBrop's learned blog voice
    const style = await loadBlogStyle();
    if (style) {
      trace.push({ state: 'done', title: `Loaded blog voice from ${style.sample_size} past posts · ${style.avg_word_count} avg words`, t: new Date().toISOString() });
    } else {
      trace.push({ state: 'done', title: `No learned style — using defaults (run \`npm run learn\` to fix)`, t: new Date().toISOString() });
    }

    // 2. Load top performers as inline reference (in addition to learned style)
    const { data: top } = await sb
      .from('blog_posts')
      .select('title, content, views_count')
      .order('views_count', { ascending: false })
      .limit(3);
    const { data: low } = await sb
      .from('blog_posts')
      .select('title, views_count')
      .order('views_count', { ascending: true })
      .limit(2);

    // 3. Load product knowledge
    const product = await loadProductKnowledge();

    // 4. Build system prompt with all learned context
    const system = [
      SYSTEM_VOICE,
      productFragment(product),
      styleFragmentForBlog(style),
    ].filter(Boolean).join('\n\n');

    // 5. Decide target length
    const targetWords = input.target_words ?? style?.median_word_count ?? 900;

    // 6. Draft
    const prompt = `Draft a complete CoBrop blog post.

TITLE: "${input.title}"
CATEGORY: ${input.category ?? 'CoBrop'}
TARGET LENGTH: ${targetWords} words

REFERENCE — TOP-PERFORMING PAST POSTS (write at this quality level):
${(top ?? []).map(p => `  · "${p.title}" (${p.views_count ?? '?'} views) — first 200 chars: "${(p.content || '').slice(0, 200)}…"`).join('\n')}

REFERENCE — LOW PERFORMERS (do NOT write like these):
${(low ?? []).map(p => `  · "${p.title}" (${p.views_count ?? '?'} views)`).join('\n')}

${input.data_points?.length ? `MUST WEAVE IN THESE DATA POINTS:\n${input.data_points.map(d => `  · ${d}`).join('\n')}\n` : ''}

Structure:
1. INTRO (hook): open with a specific stat or a concrete scene. 60–80 words.
2. PROBLEM: set up the broker-level problem the post solves. 70–100 words.
3. PROMISE: tell the reader what they'll learn. 50–80 words.
4. FIRST SECTION: dive into the first concrete point, with specifics. 250–400 words.

Also produce:
- A meta description (150–160 chars, for SEO)
- 3 image prompts (for hero + 2 body images)
- A list of every specific stat you cited

Output JSON:
{
  "intro": "<paragraph 1>",
  "problem": "<paragraph 2>",
  "promise": "<paragraph 3>",
  "first_section": "<paragraph 4 — multi-paragraph allowed, separate with \\n\\n>",
  "stats_used": ["<each stat cited verbatim>"],
  "meta_description": "<150-160 chars>",
  "suggested_image_prompts": ["<3 visual prompts>"],
  "target_length_words": ${targetWords},
  "risk": "<low|med|high>",
  "confidence": <0-1>
}`;

    const { data, resp } = await llmJson<{
      intro: string;
      problem: string;
      promise: string;
      first_section: string;
      stats_used: string[];
      meta_description: string;
      suggested_image_prompts: string[];
      target_length_words: number;
      risk: 'low' | 'med' | 'high';
      confidence: number;
    }>({ system, prompt, temperature: 0.7, maxTokens: 2200 });

    const body = [data.intro, data.problem, data.promise, data.first_section].join('\n\n');
    trace.push({ state: 'done', title: `Drafted ${body.split(/\s+/).length} words (${resp.provider}, ${resp.latencyMs}ms)`, t: new Date().toISOString() });

    return {
      summary: `Blog draft: "${input.title}" (~${body.split(/\s+/).length} words)`,
      confidence: data.confidence,
      risk: data.risk,
      proposal: {
        title: input.title,
        category: input.category ?? 'CoBrop',
        intro: data.intro,
        problem: data.problem,
        promise: data.promise,
        first_section: data.first_section,
        body,
        stats_used: data.stats_used,
        target_length_words: data.target_length_words,
        meta_description: data.meta_description,
        suggested_image_prompts: data.suggested_image_prompts,
      } satisfies ProposalData,
      trace: [...trace, { state: 'current', title: 'Awaiting admin review at /admin/dashboard → Blog', t: new Date().toISOString() }],
      evidence: [
        { label: 'Target', value: `${targetWords} words` },
        { label: 'Actual', value: `${body.split(/\s+/).length} words` },
        { label: 'Stats cited', value: String(data.stats_used.length) },
        { label: 'Voice source', value: style ? `${style.sample_size} past posts` : 'defaults' },
        { label: 'Image prompts', value: String(data.suggested_image_prompts.length) },
        { label: 'Wall time', value: `${Date.now() - t0}ms` },
      ],
      // Blog posts ALWAYS require human review before publish
      force_approval: true,
    };
  },

async execute(_input, proposal): Promise<ExecuteResult> {
    const p = proposal as unknown as ProposalData;
    const wordCount = p.body.split(/\s+/).length;
    const slug = p.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
    const { error } = await supabase().from('blog_posts').insert({
      title: p.title,
      slug: `${slug}-${Date.now().toString(36).slice(-5)}`,
      excerpt: p.intro.slice(0, 280),
      content: p.body,
      category: p.category,
      status: 'draft',
      author_name: 'CoBrop Agent',
      reading_time: Math.max(1, Math.round(wordCount / 220)),
      meta_title: p.title.slice(0, 60),
      meta_description: p.meta_description,
      tags: p.stats_used.slice(0, 5),
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      details: {
        title: p.title, category: p.category, word_count: wordCount,
        slug, status: 'draft',
        suggested_image_prompts: p.suggested_image_prompts,
        full_body: p.body,
      },
    };
  },
};
