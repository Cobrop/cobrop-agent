// src/capabilities/listing-onboard.ts — validate, describe a new listing
//
// Triggered by:  property INSERT (or UPDATE on description=null / status=pending)
// Default autonomy: assist (touches public-facing copy)
//
// Reads CoBrop's real `properties` schema, generates 3 description variants
// in the learned listing voice, picks the best, and UPDATEs properties.description.

import { llmJson } from '../llm/client.js';
import { SYSTEM_VOICE } from '../llm/prompts.js';
import { supabase } from '../db/supabase.js';
import { loadProductKnowledge, loadListingPatterns, productFragment, styleFragmentForListing } from '../learning/style-profile.js';
import type { Capability, CapabilityResult, ExecuteResult } from '../types.js';

interface Input { property_id: string }

interface ProposalData {
  property_id: string;
  description: string;
  picked_variant: 'A' | 'B' | 'C';
  variants: Array<{ id: 'A' | 'B' | 'C'; text: string }>;
}

export const listingOnboard: Capability<Input> = {
  name: 'listing-onboard',

  async reason(input): Promise<CapabilityResult> {
    const sb = supabase();
    const t0 = Date.now();
    const trace: CapabilityResult['trace'] = [];

    // 1. Fetch the property
    const { data: prop, error } = await sb
      .from('properties')
      .select('id, broker_id, title, description, price, property_type, property_category, bedrooms, bathrooms, square_feet, address, city, state, neighborhood, image_url, images, status, furnished, is_exclusive')
      .eq('id', input.property_id)
      .single();
    if (error || !prop) throw new Error(`Property ${input.property_id} not found: ${error?.message}`);
    trace.push({ state: 'done', title: `Property loaded: "${prop.title}"`, t: new Date().toISOString() });

    // 2. Photo gate — properties.images is jsonb, properties.image_url is fallback
    let photoCount = 0;
    if (Array.isArray(prop.images)) photoCount = prop.images.length;
    else if (typeof prop.images === 'object' && prop.images) photoCount = Object.keys(prop.images).length;
    if (prop.image_url && photoCount === 0) photoCount = 1;

    if (photoCount < 3) {
      trace.push({ state: 'blocked', title: `Photo gate failed (${photoCount}/3)`, t: new Date().toISOString() });
      return {
        summary: `Listing "${prop.title}" needs more photos (only ${photoCount})`,
        confidence: 0.95,
        risk: 'low',
        proposal: { property_id: prop.id, reason: 'photos<3', photo_count: photoCount } as unknown as Record<string, unknown>,
        trace,
        evidence: [
          { label: 'Photos uploaded', value: String(photoCount) },
          { label: 'Required minimum', value: '3' },
          { label: 'Action', value: 'Soft-reject + ask broker for more' },
        ],
        force_approval: true,
      };
    }
    trace.push({ state: 'done', title: `Photo count OK (${photoCount})`, t: new Date().toISOString() });

    // 3. Load CoBrop's learned listing voice + product knowledge
    const [pattern, product] = await Promise.all([loadListingPatterns(), loadProductKnowledge()]);
    const styleFrag = styleFragmentForListing(pattern);
    const productFrag = productFragment(product);
    const system = [SYSTEM_VOICE, productFrag, styleFrag].filter(Boolean).join('\n\n');
    if (pattern) trace.push({ state: 'done', title: `Loaded listing voice (${pattern.sample_size} samples)`, t: new Date().toISOString() });

    // 4. Format price (numeric column)
    const priceFmt = prop.price
      ? Number(prop.price).toLocaleString(undefined, { maximumFractionDigits: 0 })
      : 'price on request';

    const locParts = [prop.neighborhood, prop.city, prop.state].filter(Boolean);

    // 5. Draft 3 description variants
    const prompt = `Generate 3 description variants (A, B, C) for this CoBrop listing.

LISTING
  Title: ${prop.title}
  Type: ${prop.property_type ?? '—'}${prop.property_category ? ' · ' + prop.property_category : ''}
  Bedrooms/Bathrooms: ${prop.bedrooms ?? '?'}br / ${prop.bathrooms ?? '?'}ba${prop.square_feet ? ' · ' + prop.square_feet + ' sqft' : ''}
  Address: ${prop.address ?? ''}${locParts.length ? ', ' + locParts.join(', ') : ''}
  Price: ${priceFmt}
  Furnished: ${prop.furnished ?? '—'}
  Photos: ${photoCount}
  ${prop.is_exclusive ? 'Exclusive CoBrop listing.' : ''}

Existing description (if any, to improve on):
${(prop.description || '(none)').slice(0, 600)}

Rules:
- Each variant: 60–80 words.
- Lead with the most distinctive feature.
- No emoji. No superlatives without backing ("stunning", "luxurious" — only if justified by the data).
- Match CoBrop's existing listing voice (see VOICE block above).

Output JSON:
{
  "variants": [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."}],
  "picked": "<A|B|C>",
  "reason": "<one sentence why this variant wins>",
  "risk": "<low|med|high>",
  "confidence": <0-1>
}`;

    const { data, resp } = await llmJson<{
      variants: Array<{ id: 'A' | 'B' | 'C'; text: string }>;
      picked: 'A' | 'B' | 'C';
      reason: string;
      risk: 'low' | 'med' | 'high';
      confidence: number;
    }>({ system, prompt, temperature: 0.5, maxTokens: 800 });

    trace.push({ state: 'done', title: `Drafted 3 variants · picked ${data.picked} (${resp.provider}, ${resp.latencyMs}ms)`, t: new Date().toISOString() });

    const picked = data.variants.find(v => v.id === data.picked) ?? data.variants[0];

    return {
      summary: `Listing "${prop.title}" → variant ${data.picked} (${picked.text.split(/\s+/).length} words)`,
      confidence: data.confidence,
      risk: data.risk,
      proposal: {
        property_id: prop.id,
        description: picked.text,
        picked_variant: data.picked,
        variants: data.variants,
      } satisfies ProposalData,
      trace: [...trace, { state: 'current', title: 'Awaiting routing decision', t: new Date().toISOString() }],
      evidence: [
        { label: 'Variants generated', value: '3' },
        { label: 'Picked', value: data.picked },
        { label: 'Words', value: String(picked.text.split(/\s+/).length) },
        { label: 'Reason', value: data.reason.slice(0, 60) },
        { label: 'Wall time', value: `${Date.now() - t0}ms` },
      ],
    };
  },

  async execute(_input, proposal): Promise<ExecuteResult> {
    const p = proposal as unknown as ProposalData;
    if (!p.description) return { ok: true, details: { skipped: 'no description in proposal' } };
    const sb = supabase();
    const { error } = await sb
      .from('properties')
      .update({ description: p.description, updated_at: new Date().toISOString() })
      .eq('id', p.property_id);
    if (error) return { ok: false, error: `Update failed: ${error.message}` };
    return {
      ok: true,
      details: {
        property_id: p.property_id,
        picked_variant: p.picked_variant,
        words: p.description.split(/\s+/).length,
        full_description: p.description,
      },
    };
  },
};
