// src/capabilities/social-post.ts — draft a social post for any channel
//
// Triggered by:  property validated (new listing → LinkedIn) or manual
// Default autonomy: assist (admin approves before publish)
//
// Drafts a channel-specific post in CoBrop's voice. Output lives in
// agent_actions; the actual publish step is a stub until LinkedIn/Meta
// tokens are wired.

import { llmJson } from '../llm/client.js';
import { SYSTEM_VOICE } from '../llm/prompts.js';
import { loadProductKnowledge, loadSocialVoice, productFragment, socialVoiceFragment } from '../learning/style-profile.js';
import type { Capability, CapabilityResult, ExecuteResult } from '../types.js';

type Channel = 'linkedin' | 'facebook' | 'instagram' | 'tiktok' | 'x' | 'telegram' | 'whatsapp';

interface Input {
  channel: Channel;
  topic: string;
  topic_sub?: string;
  language?: string;
  locale?: string;
  /** Optional: tie the post to a property — its details get added to the prompt */
  property_id?: string;
}

interface ProposalData {
  channel: Channel;
  language: string;
  body: string;
  hashtags: string[];
  suggested_publish_time_local: string;
  topic: string;
  /** Only populated for image-required channels (currently instagram) */
  image_url?: string;
}

const channelRules: Record<Channel, string> = {
  linkedin:  '220–320 words · 3 short paragraphs · 1 stat hook · NO emoji · soft CTA',
  facebook:  '180–260 words · broker case-study angle · 1 emoji max',
  instagram: '80–120 word caption · 4 lines · 5 relevant hashtags at end',
  tiktok:    '28-second reel script · 4 lines voiceover + 3 on-screen captions · casual',
  x:         '6–8 tweets in a thread · ≤270 chars each · stat-led',
  telegram:  'short paragraphs · 1 stat · clear inline-link CTA',
  whatsapp:  '1 paragraph · ≤480 chars · opt-out line at end',
};

export const socialPost: Capability<Input> = {
  name: 'social-post',

  async reason(input): Promise<CapabilityResult> {
    const t0 = Date.now();
    const trace: CapabilityResult['trace'] = [];

    // Optional: pull property context if a property_id was passed
    let propertyContext = '';
    if (input.property_id) {
      const { supabase } = await import('../db/supabase.js');
      const { data: prop } = await supabase()
        .from('properties')
        .select('title, property_type, bedrooms, bathrooms, price, address, city, neighborhood, description')
        .eq('id', input.property_id)
        .maybeSingle();
      if (prop) {
        propertyContext = `
PROPERTY CONTEXT:
  Title: ${prop.title}
  Type: ${prop.property_type} · ${prop.bedrooms ?? '?'}br/${prop.bathrooms ?? '?'}ba
  Location: ${prop.neighborhood ?? ''}${prop.city ? ', ' + prop.city : ''}
  Price: ${prop.price ? Number(prop.price).toLocaleString() : 'on request'}
  Description: ${(prop.description || '').slice(0, 400)}`;
        trace.push({ state: 'done', title: `Property context loaded`, t: new Date().toISOString() });
      }
    }

    // Load product knowledge + channel-specific voice (if learned earlier)
    const product = await loadProductKnowledge();
    const channelVoice = (input.channel === 'linkedin' || input.channel === 'facebook')
      ? await loadSocialVoice(input.channel)
      : null;
    if (channelVoice && channelVoice.sample_size > 0) {
      trace.push({ state: 'done', title: `Loaded ${input.channel} voice (${channelVoice.sample_size} past posts)`, t: new Date().toISOString() });
    }

    const system = [
      SYSTEM_VOICE,
      productFragment(product),
      channelVoice ? socialVoiceFragment(input.channel as 'linkedin' | 'facebook', channelVoice) : '',
    ].filter(Boolean).join('\n\n');

    const language = input.language || 'English';

    const prompt = `Draft a single ${input.channel} post for CoBrop.

CHANNEL RULES: ${channelRules[input.channel]}
LANGUAGE: ${language}
LOCALE: ${input.locale || 'GLOBAL'}
TOPIC: ${input.topic}${input.topic_sub ? ' — ' + input.topic_sub : ''}
${propertyContext}

Write in ${language}. Be specific (use a real CoBrop capability, a real number, or a real broker scenario — don't invent generic content). Match the channel rules exactly.
${input.channel === 'instagram' ? '\nAlso write an image_prompt: a short visual description (no text/words in the image) for a photorealistic marketing graphic matching this post — property exterior/interior shots, broker-at-work scenes, or clean abstract real-estate visuals work well.' : ''}

Output JSON:
{
  "body": "<the post body — plain text>",
  "hashtags": ["<tag>", "..."],
  "suggested_publish_time_local": "<HH:MM>",
  ${input.channel === 'instagram' ? '"image_prompt": "<visual description for the marketing image>",\n  ' : ''}"risk": "<low|med|high>",
  "confidence": <0-1>
}`;

    const { data, resp } = await llmJson<{
      body: string;
      hashtags: string[];
      suggested_publish_time_local: string;
      image_prompt?: string;
      risk: 'low' | 'med' | 'high';
      confidence: number;
    }>({ system, prompt, temperature: 0.7, maxTokens: 700 });
    trace.push({ state: 'done', title: `Drafted ${input.channel} post (${resp.provider}, ${resp.latencyMs}ms)`, t: new Date().toISOString() });

    let imageUrl: string | undefined;
    if (input.channel === 'instagram' && data.image_prompt) {
      const { generateImage } = await import('../channels/imageGen.js');
      const { uploadAgentImage } = await import('../db/supabase.js');
      const imageBuffer = await generateImage(data.image_prompt);
      imageUrl = await uploadAgentImage(imageBuffer, `social-posts/${Date.now()}-instagram.jpg`);
      trace.push({ state: 'done', title: `Generated + uploaded image`, t: new Date().toISOString() });
    }

    return {
      summary: `${input.channel} post drafted: "${input.topic}"`,
      confidence: data.confidence,
      risk: data.risk,
      proposal: {
        channel: input.channel,
        language,
        body: data.body,
        hashtags: data.hashtags,
        suggested_publish_time_local: data.suggested_publish_time_local,
        topic: input.topic,
        image_url: imageUrl,
      } satisfies ProposalData,
      trace: [...trace, { state: 'current', title: 'Awaiting publish approval', t: new Date().toISOString() }],
      evidence: [
        { label: 'Channel', value: input.channel },
        { label: 'Language', value: language },
        { label: 'Words', value: String(data.body.split(/\s+/).length) },
        { label: 'Suggested time', value: data.suggested_publish_time_local },
        { label: 'Hashtags', value: String(data.hashtags.length) },
        ...(imageUrl ? [{ label: 'Image', value: imageUrl }] : []),
        { label: 'Wall time', value: `${Date.now() - t0}ms` },
      ],
      // Social posts always go through human review
      force_approval: true,
    };
  },

  async execute(_input, proposal): Promise<ExecuteResult> {
    const p = proposal as unknown as ProposalData;
    const text = p.hashtags.length ? `${p.body}\n\n${p.hashtags.map(h => `#${h}`).join(' ')}` : p.body;

    // Real publish for channels with a working adapter + configured
    // credentials. Others (TikTok/X/Telegram/WhatsApp) stay drafts —
    // no adapter built yet, or the content type (video) isn't produced here.
    if (p.channel === 'linkedin' || p.channel === 'facebook') {
      const { publishLinkedIn, publishFacebook } = await import('../channels/social.js');
      const publish = p.channel === 'linkedin' ? publishLinkedIn : publishFacebook;
      try {
        const result = await publish(text);
        return {
          ok: true,
          details: {
            channel: p.channel,
            language: p.language,
            topic: p.topic,
            full_body: p.body,
            hashtags: p.hashtags,
            suggested_publish_time_local: p.suggested_publish_time_local,
            publish_status: 'published',
            post_id: result.post_id,
            post_url: result.post_url,
          },
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (p.channel === 'instagram') {
      if (!p.image_url) return { ok: false, error: 'No image was generated at draft time — cannot publish to Instagram' };
      const { publishInstagram } = await import('../channels/social.js');
      try {
        const result = await publishInstagram(p.image_url, text);
        return {
          ok: true,
          details: {
            channel: p.channel,
            language: p.language,
            topic: p.topic,
            full_body: p.body,
            hashtags: p.hashtags,
            image_url: p.image_url,
            suggested_publish_time_local: p.suggested_publish_time_local,
            publish_status: 'published',
            post_id: result.post_id,
          },
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    return {
      ok: true,
      details: {
        channel: p.channel,
        language: p.language,
        topic: p.topic,
        full_body: p.body,
        hashtags: p.hashtags,
        suggested_publish_time_local: p.suggested_publish_time_local,
        publish_status: 'drafted — publish via configured channel adapter',
      },
    };
  },
};
