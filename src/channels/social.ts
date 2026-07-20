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
