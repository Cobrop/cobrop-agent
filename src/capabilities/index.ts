// src/capabilities/index.ts — registry. Add new capabilities here.

import type { Capability, CapabilityName } from '../types.js';

import { leadReply } from './lead-reply.js';
import { listingOnboard } from './listing-onboard.js';
import { fraudCheck } from './fraud-check.js';
import { priceSuggest } from './price-suggest.js';
import { brokerOutreach } from './broker-outreach.js';
import { blogDraft } from './blog-draft.js';
import { socialPost } from './social-post.js';
import { nudgeBroker } from './nudge-broker.js';

const list: Capability[] = [
  leadReply,
  listingOnboard,
  fraudCheck,
  priceSuggest,
  brokerOutreach,
  blogDraft,
  socialPost,
  nudgeBroker,
];

const byName = new Map<CapabilityName, Capability>(list.map(c => [c.name, c]));

export function getCapability(name: string): Capability | undefined {
  return byName.get(name as CapabilityName);
}

export function listCapabilities(): CapabilityName[] {
  return list.map(c => c.name);
}
