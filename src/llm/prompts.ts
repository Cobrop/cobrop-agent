// src/llm/prompts.ts — All capability prompts in one place.
// These are the SAME prompts used in the admin console demo. Tune here.

export const SYSTEM_VOICE = `You are CoBrop's autonomous platform agent. CoBrop is a real-estate co-brokerage platform connecting brokers across Ethiopia, Kenya, UAE, Rwanda, South Africa, Tanzania, Uganda, and Qatar so they can split fees on cross-border deals.

GLOBAL BRAND VOICE: confident, educational, empowering. Action verbs. Specific over abstract.
NEVER use: emoji (unless channel rules allow), clichés ("game-changer", "leverage", "in today's fast-paced world"), marketing hype, exclamation marks, generic real-estate platitudes.

You make decisions about brokers, listings, and content. Your decisions go through an autonomy gate before execution. Output exactly what the caller asks for — no preface, no commentary.`;

// ── Lead reply ────────────────────────────────────────────────
export const leadReplyPrompt = (input: {
  inquiry: { text: string; lang: string; broker_handle: string };
  property: { title: string; address: string; price: string; key_features: string[]; broker_handle: string };
}) => `An inquiry just landed for one of CoBrop's listings. Generate a single auto-reply.

PROPERTY: ${input.property.title} · ${input.property.address} · ${input.property.price}
KEY FEATURES: ${input.property.key_features.join(', ')}
LISTING BROKER: @${input.property.broker_handle}

INQUIRY (${input.inquiry.lang}): "${input.inquiry.text}"

Reply in ${input.inquiry.lang}. Style: brief (≤90 words), warm, professional. Acknowledge what they asked, confirm 1 fact, suggest a 30-min site visit, end with the broker's @ handle as the routing.

Output JSON:
{"reply":"<the reply text>","next_action":"<schedule-visit|qualify-budget|route-to-broker>","risk":"<low|med|high>","confidence":<0-1>}`;

// ── Listing onboard ───────────────────────────────────────────
export const listingDescriptionPrompt = (input: {
  property: { type: string; bedrooms: number; bathrooms: number; size_m2: number; address: string; price: string; year_built?: number; features: string[]; broker_tone?: string };
}) => `Generate 3 description variants for a new CoBrop listing.

PROPERTY: ${input.property.type} · ${input.property.bedrooms}BR/${input.property.bathrooms}BA · ${input.property.size_m2}m² · ${input.property.address} · ${input.property.price}
FEATURES: ${input.property.features.join(', ')}
${input.property.year_built ? `BUILT: ${input.property.year_built}` : ''}
BROKER TONE: ${input.property.broker_tone || 'standard CoBrop voice'}

For each variant (A, B, C), write 60–80 words. Lead with the most distinctive feature. NO emoji. NO superlatives ("stunning", "luxurious") without backing.

Output JSON:
{"variants":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."}],"picked":"<A|B|C>","reason":"<why this variant beats the others>","risk":"<low|med|high>","confidence":<0-1>}`;

// ── Fraud check ───────────────────────────────────────────────
export const fraudCheckPrompt = (input: {
  property: { id: string; title: string; address: string; broker_handle: string; broker_strikes: number; broker_tier: string; image_hashes: string[]; price: string; price_vs_median_pct: number };
  candidates: Array<{ id: string; image_overlap: number; geo_distance_km: number; same_broker: boolean }>;
}) => `Decide whether this CoBrop listing is a duplicate or fraud.

NEW LISTING: ${input.property.id} · "${input.property.title}" · ${input.property.address}
BROKER: @${input.property.broker_handle} · ${input.property.broker_tier} · ${input.property.broker_strikes} prior strikes
PRICE: ${input.property.price} · ${input.property.price_vs_median_pct > 0 ? '+' : ''}${input.property.price_vs_median_pct}% vs comparable median
IMAGES: ${input.property.image_hashes.length} photos

DUPLICATE CANDIDATES (top matches):
${input.candidates.map(c => `  - ${c.id}: ${(c.image_overlap * 100).toFixed(0)}% image match, ${c.geo_distance_km}km away, same-broker=${c.same_broker}`).join('\n') || '  (none above threshold)'}

Decide: legitimate · duplicate · fraud · uncertain. If price < −30% of median, flag as potential scam. If image overlap > 85% AND geo < 1km AND different broker → likely duplicate.

Output JSON:
{"verdict":"<legitimate|duplicate|fraud|uncertain>","action":"<allow|halt|takedown|escalate>","matched_id":"<id or null>","reason":"<1-sentence explanation>","risk":"<low|med|high>","confidence":<0-1>}`;

// ── Price suggest ─────────────────────────────────────────────
export const priceSuggestPrompt = (input: {
  property: { id: string; title: string; price_current: string; days_on_market: number; views: number; inquiries: number };
  comparables: { median: string; iqr_low: string; iqr_high: string; sample_size: number };
}) => `Suggest whether this stale CoBrop listing needs a price adjustment.

LISTING: ${input.property.id} · ${input.property.title}
CURRENT: ${input.property.price_current} · ${input.property.days_on_market} days on market · ${input.property.views} views · ${input.property.inquiries} inquiries
COMPARABLES (n=${input.comparables.sample_size}): median ${input.comparables.median}, IQR ${input.comparables.iqr_low}–${input.comparables.iqr_high}

Rules: if inquiries=0 after 14+ days AND price > median + 5%, suggest reduction to median. If inquiries>3 and views/inquiry ratio < 50, broker has demand → suggest no change. Otherwise tune within the IQR.

Output JSON:
{"recommended_price":"<currency-formatted>","change_pct":<number>,"broker_copy":"<one-sentence message to send the broker>","reason":"<why>","risk":"<low|med|high>","confidence":<0-1>}`;

// ── Broker outreach ───────────────────────────────────────────
export const brokerOutreachPrompt = (input: {
  broker: { name: string; location: string; tenure: string; listings_count: number; specialty: string; sourced_from: string; language: string };
  channel: 'linkedin' | 'whatsapp' | 'email';
}) => `Draft a personalized outbound message to recruit this broker to CoBrop.

BROKER: ${input.broker.name} (${input.broker.location})
EXPERIENCE: ${input.broker.tenure} · ${input.broker.listings_count} active listings · specializes in ${input.broker.specialty}
SOURCED: ${input.broker.sourced_from}
CHANNEL: ${input.channel}
LANGUAGE: ${input.broker.language}

Voice: warm but professional, hyper-specific (mention their actual area/specialty), brief (≤90 words on LinkedIn, ≤60 words on WhatsApp), no emoji on LinkedIn (1 max on WhatsApp), soft CTA to a 7-min onboarding call.

Output JSON:
{"message":"<the message body>","cta":"<the CTA text>","follow_up_in_days":<number>,"risk":"<low|med|high>","confidence":<0-1>}`;

// ── Blog draft ────────────────────────────────────────────────
export const blogDraftPrompt = (input: {
  title: string;
  category: string;
  past_top_posts: Array<{ title: string; reads: string; takeaway: string }>;
  past_low_posts: Array<{ title: string; reads: string }>;
  data_points?: string[];
}) => `Draft the first 4 paragraphs of a CoBrop blog post.

TITLE: "${input.title}"
CATEGORY: ${input.category}

LEARNINGS FROM TOP POSTS:
${input.past_top_posts.map(p => `  · "${p.title}" (${p.reads} reads) — ${p.takeaway}`).join('\n')}

PATTERNS TO AVOID (from low performers):
${input.past_low_posts.map(p => `  · "${p.title}" (only ${p.reads} reads)`).join('\n')}

${input.data_points ? `DATA POINTS TO USE:\n${input.data_points.map(d => `  · ${d}`).join('\n')}\n` : ''}

Structure: hook with a specific stat or scene → set up broker-level problem → promise the answer. Include 2-3 specific stats. Long-form (8-12 min reads outperform on CoBrop).

Output JSON:
{"intro":"<paragraph 1 - the hook>","problem":"<paragraph 2 - broker-level problem>","promise":"<paragraph 3 - what we'll cover>","first_section":"<paragraph 4 - first body section>","stats_used":["<each stat cited>"],"target_length_words":<number>,"risk":"<low|med|high>","confidence":<0-1>}`;

// ── Social post ───────────────────────────────────────────────
export const socialPostPrompt = (input: {
  channel: 'linkedin' | 'facebook' | 'instagram' | 'tiktok' | 'x' | 'telegram' | 'whatsapp';
  topic: string;
  topic_sub: string;
  language: string;
  locale: string;
}) => `Draft a social post for CoBrop.

CHANNEL: ${input.channel}
TOPIC: ${input.topic} — ${input.topic_sub}
LANGUAGE: ${input.language}
LOCALE: ${input.locale}

Channel rules:
- linkedin: 220–320 words · 3 short paragraphs · 1 stat hook · NO emoji · soft CTA
- facebook: 180–260 words · broker case-study angle · 1 emoji max
- instagram: 80–120 word caption · 4 lines · 5 relevant hashtags at end
- tiktok: 28-second reel script · 4 lines voiceover + 3 on-screen captions · casual
- x: thread of 6–8 tweets · ≤270 chars each · stat-led
- telegram: short paragraphs · 1 stat · clear inline-link CTA
- whatsapp: 1 paragraph · ≤480 chars · opt-out line at end

Output JSON:
{"body":"<the post body>","hashtags":["<tag>","..."],"suggested_publish_time_local":"<HH:MM>","risk":"<low|med|high>","confidence":<0-1>}`;

// ── Broker nudge ──────────────────────────────────────────────
export const nudgeBrokerPrompt = (input: {
  broker_handle: string;
  broker_language: string;
  stale_leads: Array<{ id: string; hours_waiting: number; property_title: string; budget?: string }>;
}) => `One of CoBrop's brokers has leads slipping. Send a nudge.

BROKER: @${input.broker_handle}
LANGUAGE: ${input.broker_language}

STALE LEADS:
${input.stale_leads.map(l => `  · ${l.id}: ${l.property_title} · waiting ${l.hours_waiting}h${l.budget ? ' · budget ' + l.budget : ''}`).join('\n')}

Write a single in-app message + WhatsApp message. Tone: friendly nudge, not lecture. Mention exactly how much each lead is worth in expected commission if applicable. Brief.

Output JSON:
{"in_app":"<short in-app message>","whatsapp":"<WhatsApp message>","risk":"<low|med|high>","confidence":<0-1>}`;
