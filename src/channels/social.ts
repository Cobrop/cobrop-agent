// src/channels/social.ts — real publish adapters for social-post.ts.
//
// Each function either posts for real or throws with a clear reason
// (missing config, expired/invalid token, API error) — callers decide
// whether that failure should block approval or just get logged.

import { config } from '../config.js';

export interface PublishResult {
  ok: true;
  post_id: string;
  post_url?: string;
}

export async function publishLinkedIn(text: string): Promise<PublishResult> {
  if (!config.LINKEDIN_ACCESS_TOKEN || !config.LINKEDIN_ORG_URN) {
    throw new Error('LinkedIn not configured — missing LINKEDIN_ACCESS_TOKEN / LINKEDIN_ORG_URN');
  }
  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.LINKEDIN_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: config.LINKEDIN_ORG_URN,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LinkedIn publish failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const postId = res.headers.get('x-restli-id') ?? res.headers.get('X-RestLi-Id') ?? 'unknown';
  return { ok: true, post_id: postId };
}

export async function publishFacebook(text: string): Promise<PublishResult> {
  if (!config.FACEBOOK_PAGE_TOKEN || !config.FACEBOOK_PAGE_ID) {
    throw new Error('Facebook not configured — missing FACEBOOK_PAGE_TOKEN / FACEBOOK_PAGE_ID');
  }
  const params = new URLSearchParams({ message: text, access_token: config.FACEBOOK_PAGE_TOKEN });
  const res = await fetch(`https://graph.facebook.com/v19.0/${config.FACEBOOK_PAGE_ID}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`Facebook publish failed (${res.status}): ${json.error?.message ?? JSON.stringify(json).slice(0, 300)}`);
  }
  return { ok: true, post_id: json.id, post_url: `https://facebook.com/${json.id}` };
}

/** Instagram Graph API is a two-step publish: create a media container from
 * a public image URL, then publish that container. Uses the same
 * FACEBOOK_PAGE_TOKEN — Instagram Business publishing rides on the Page's
 * connected app permissions, not a separate Instagram-specific token. */
export async function publishInstagram(imageUrl: string, caption: string): Promise<PublishResult> {
  if (!config.FACEBOOK_PAGE_TOKEN || !config.INSTAGRAM_BUSINESS_ID) {
    throw new Error('Instagram not configured — missing FACEBOOK_PAGE_TOKEN / INSTAGRAM_BUSINESS_ID');
  }
  const createParams = new URLSearchParams({ image_url: imageUrl, caption, access_token: config.FACEBOOK_PAGE_TOKEN });
  const createRes = await fetch(`https://graph.facebook.com/v19.0/${config.INSTAGRAM_BUSINESS_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: createParams,
  });
  const createJson = await createRes.json().catch(() => ({}));
  if (!createRes.ok || createJson.error) {
    throw new Error(`Instagram media create failed (${createRes.status}): ${createJson.error?.message ?? JSON.stringify(createJson).slice(0, 300)}`);
  }

  const publishParams = new URLSearchParams({ creation_id: createJson.id, access_token: config.FACEBOOK_PAGE_TOKEN });
  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${config.INSTAGRAM_BUSINESS_ID}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: publishParams,
  });
  const publishJson = await publishRes.json().catch(() => ({}));
  if (!publishRes.ok || publishJson.error) {
    throw new Error(`Instagram publish failed (${publishRes.status}): ${publishJson.error?.message ?? JSON.stringify(publishJson).slice(0, 300)}`);
  }
  return { ok: true, post_id: publishJson.id };
}
