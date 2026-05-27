// src/learning/style-profile.ts
//
// Reads/writes the agent's learned knowledge about CoBrop's voice & structure.
// Used by capabilities (especially blog-draft, social-post, broker-outreach)
// to keep output consistent with what CoBrop already publishes.

import { supabase } from '../db/supabase.js';

export interface BlogStyleProfile {
  sample_size: number;
  avg_word_count: number;
  median_word_count: number;
  avg_paragraph_count: number;
  avg_read_time_min: number;
  most_common_categories: Array<{ category: string; count: number; avg_reads: number }>;
  opening_patterns: string[];        // First-paragraph patterns seen in top posts
  voice_markers: string[];           // Phrases used a lot (kept)
  banned_phrases: string[];          // Words/phrases never used (e.g. clichés)
  structure_template: {
    has_hook_stat: boolean;
    has_broker_quote: boolean;
    has_h2_sections: boolean;
    cta_positions: string[];
    images_per_post_avg: number;
  };
  top_performers: Array<{ title: string; reads: number; lesson: string }>;
  low_performers: Array<{ title: string; reads: number; lesson: string }>;
}

export interface ListingPatternProfile {
  sample_size: number;
  avg_description_words: number;
  common_features_top10: string[];
  price_format_examples: string[];
  description_openers: string[];
}

export interface SchemaMap {
  /** What CoBrop's actual tables look like — discovered, not assumed */
  tables: Array<{
    name: string;
    row_count_approx: number;
    columns: Array<{ name: string; type: string; nullable: boolean }>;
    sample: Record<string, unknown>[];
    purpose_guess: string;
  }>;
  important_relationships: Array<{
    from: string;
    to: string;
    via: string;
  }>;
}

// ── Read API ────────────────────────────────────────────────────

export async function loadBlogStyle(): Promise<BlogStyleProfile | null> {
  return loadKnowledge<BlogStyleProfile>('style', 'blog_posts');
}

export async function loadListingPatterns(): Promise<ListingPatternProfile | null> {
  return loadKnowledge<ListingPatternProfile>('pattern', 'properties');
}

export async function loadSchemaMap(): Promise<SchemaMap | null> {
  return loadKnowledge<SchemaMap>('schema', 'platform');
}

// Product knowledge (built by learn-from-platform-code from src/pages)
export interface ProductKnowledge {
  product_map: {
    elevator_pitch: string;
    pages: Array<{ name: string; purpose: string }>;
    capabilities_surfaced: string[];
    user_journeys: string[];
  };
  sample_size: number;
}
export async function loadProductKnowledge(): Promise<ProductKnowledge | null> {
  const { data } = await supabase()
    .from('agent_knowledge')
    .select('data, sample_size')
    .eq('id', 'guide.platform_pages')
    .order('built_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data.data as any;
  return { product_map: d.product_map, sample_size: data.sample_size };
}

// Web/marketing voice (built by learn-from-web)
export interface MarketingVoice {
  profile: {
    elevator_pitch: string;
    value_props: string[];
    target_audience: string;
    cta_style: string[];
    voice_markers: string[];
    geographic_focus: string[];
  };
  sample_size: number;
}
export async function loadMarketingVoice(): Promise<MarketingVoice | null> {
  const { data } = await supabase()
    .from('agent_knowledge')
    .select('data, sample_size')
    .eq('id', 'voice.marketing')
    .order('built_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data.data as any;
  return { profile: d.profile, sample_size: data.sample_size };
}

// Channel-specific social voice (linkedin / facebook)
export async function loadSocialVoice(channel: 'linkedin' | 'facebook'): Promise<{ voice_markers: string[]; opening_patterns: string[]; sample_size: number } | null> {
  const { data } = await supabase()
    .from('agent_knowledge')
    .select('data, sample_size')
    .eq('id', `voice.${channel}`)
    .order('built_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data.data as any;
  return { voice_markers: d.profile?.voice_markers ?? [], opening_patterns: d.profile?.opening_patterns ?? [], sample_size: data.sample_size };
}

async function loadKnowledge<T>(kind: string, subject: string): Promise<T | null> {
  const { data } = await supabase()
    .from('agent_knowledge')
    .select('data')
    .eq('kind', kind)
    .eq('subject', subject)
    .order('built_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.data ? (data.data as T) : null;
}

// ── Write API ───────────────────────────────────────────────────

export async function saveKnowledge(args: {
  id: string;
  kind: string;
  subject: string;
  summary: string;
  data: Record<string, unknown>;
  sample_size?: number;
  confidence?: number;
  expires_at?: string;
}) {
  const { error } = await supabase()
    .from('agent_knowledge')
    .upsert(
      {
        id: args.id,
        kind: args.kind,
        subject: args.subject,
        summary: args.summary,
        data: args.data,
        sample_size: args.sample_size ?? null,
        confidence: args.confidence ?? null,
        expires_at: args.expires_at ?? null,
        built_at: new Date().toISOString(),
        built_by: 'learn-from-platform',
      },
      { onConflict: 'id' },
    );
  if (error) throw error;
}

// ── Prompt fragments built from learned style ──────────────────
// These are mixed into the LLM prompts so the agent honors your
// actual brand voice, not a generic one.

export function styleFragmentForBlog(profile: BlogStyleProfile | null): string {
  if (!profile) return '';
  return `
CoBrop BLOG VOICE — learned from ${profile.sample_size} past posts:
- Target word count: ${profile.avg_word_count} (median ${profile.median_word_count}, ~${profile.avg_read_time_min} min read)
- Paragraph count: ${profile.avg_paragraph_count}
- ${profile.structure_template.has_hook_stat ? 'Open with a specific stat or scene' : 'Open with a story setup'}
- ${profile.structure_template.has_h2_sections ? 'Use H2 section breaks' : 'Use flowing prose without H2 breaks'}
- ${profile.structure_template.has_broker_quote ? 'Include at least one direct broker quote' : ''}
- CTA placement: ${profile.structure_template.cta_positions.join(' + ') || 'end only'}
- Images per post: ~${profile.structure_template.images_per_post_avg}
${profile.voice_markers.length ? `- Voice markers (use naturally): ${profile.voice_markers.slice(0, 8).join(', ')}` : ''}
${profile.banned_phrases.length ? `- NEVER use: ${profile.banned_phrases.join(', ')}` : ''}

OPENINGS THAT WORK (mimic the pattern, not the words):
${profile.opening_patterns.slice(0, 3).map((o, i) => `  ${i + 1}. ${o}`).join('\n')}

TOP PERFORMERS (write like these):
${profile.top_performers.slice(0, 3).map(p => `  · "${p.title}" (${p.reads} reads) — ${p.lesson}`).join('\n')}

LOW PERFORMERS (write nothing like these):
${profile.low_performers.slice(0, 2).map(p => `  · "${p.title}" (${p.reads} reads) — ${p.lesson}`).join('\n')}
`.trim();
}

export function styleFragmentForListing(profile: ListingPatternProfile | null): string {
  if (!profile) return '';
  return `
LISTING DESCRIPTION VOICE — learned from ${profile.sample_size} past listings:
- Target: ${profile.avg_description_words} words
- Common features mentioned: ${profile.common_features_top10.slice(0, 6).join(', ')}
- Opener patterns that work: ${profile.description_openers.slice(0, 2).map(o => `"${o}"`).join(' · ')}
- Price format: ${profile.price_format_examples[0] || 'follow existing convention'}
`.trim();
}

// What CoBrop actually does — fed into outreach + social + lead-reply prompts
// so the agent can name real capabilities instead of inventing generic ones.
export function productFragment(product: ProductKnowledge | null): string {
  if (!product) return '';
  return `
WHAT COBROP ACTUALLY DOES — learned from ${product.sample_size} pages of CoBrop source code:

Elevator pitch (use this exact framing, not generic platitudes):
  "${product.product_map.elevator_pitch}"

Capabilities CoBrop offers users (only reference these — don't invent others):
${product.product_map.capabilities_surfaced.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}

Common user journeys:
${product.product_map.user_journeys.slice(0, 4).map((j) => `  · ${j}`).join('\n')}
`.trim();
}

export function socialVoiceFragment(channel: 'linkedin' | 'facebook', voice: { voice_markers: string[]; opening_patterns: string[]; sample_size: number } | null): string {
  if (!voice || voice.sample_size === 0) return '';
  return `
${channel.toUpperCase()} VOICE — learned from ${voice.sample_size} past CoBrop ${channel} posts:
- Voice markers (use these naturally): ${voice.voice_markers.slice(0, 6).join(', ')}
- Opening templates that work: ${voice.opening_patterns.slice(0, 3).join(' | ')}
`.trim();
}
