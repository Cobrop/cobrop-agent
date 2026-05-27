// src/routes/webhooks.ts — Supabase webhook receivers
//
// Wire each of these into the Supabase dashboard → Database → Webhooks.
// Each one enqueues a task; the queue worker picks it up and reasons.

import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';
import { verifyWebhook } from '../middleware/auth.js';
import type { CapabilityName } from '../types.js';

export const webhooks = new Hono();

webhooks.use('*', verifyWebhook);

interface SupabasePayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}

// Generic helper: enqueue a task with optional deduplication
async function enqueue(capability: CapabilityName, input: Record<string, unknown>, dedupKey?: string) {
  const { data, error } = await supabase()
    .from('agent_tasks')
    .insert({ capability, input, dedup_key: dedupKey })
    .select('id')
    .single();
  if (error) {
    // Duplicate key from dedup_key — that's fine, means we already enqueued
    if (error.code === '23505') return { id: null, deduped: true };
    throw error;
  }
  return { id: data.id, deduped: false };
}

// ── inquiries.insert → lead-reply ────────────────────────────────
webhooks.post('/inquiry', async (c) => {
  const p = await c.req.json<SupabasePayload>();
  if (p.type !== 'INSERT' || p.table !== 'inquiries') {
    return c.json({ skipped: true, reason: 'not an inquiry insert' });
  }
  const res = await enqueue('lead-reply', { inquiry_id: p.record.id });
  return c.json({ enqueued: true, task_id: res.id });
});

// ── properties.insert/update → listing-onboard + fraud-check ─────
webhooks.post('/property', async (c) => {
  const p = await c.req.json<SupabasePayload>();
  const propertyId = p.record.id as string;

  // On insert: run both onboarding and fraud check in parallel
  if (p.type === 'INSERT') {
    const [onboard, fraud] = await Promise.all([
      enqueue('listing-onboard', { property_id: propertyId }),
      enqueue('fraud-check', { property_id: propertyId }, `fraud:${propertyId}`),
    ]);
    return c.json({ enqueued: { listing_onboard: onboard.id, fraud_check: fraud.id } });
  }

  // On update: only re-run if images changed
  if (p.type === 'UPDATE') {
    const oldImages = JSON.stringify(p.old_record?.image_urls ?? []);
    const newImages = JSON.stringify(p.record.image_urls ?? []);
    if (oldImages !== newImages) {
      const fraud = await enqueue('fraud-check', { property_id: propertyId }, `fraud:${propertyId}:${Date.now()}`);
      return c.json({ enqueued: { fraud_check: fraud.id } });
    }
    return c.json({ skipped: true, reason: 'no relevant change' });
  }
  return c.json({ skipped: true });
});

// ── properties.update (status=validated) → social-post ───────────
webhooks.post('/property-validated', async (c) => {
  const p = await c.req.json<SupabasePayload>();
  if (p.record.agent_status !== 'validated' || p.old_record?.agent_status === 'validated') {
    return c.json({ skipped: true });
  }
  const propId = p.record.id as string;
  // Draft a LinkedIn post for the new listing
  const res = await enqueue('social-post', {
    channel: 'linkedin',
    topic: p.record.title,
    topic_sub: p.record.address,
    language: 'English',
    locale: (p.record.country as string) || 'GLOBAL',
  }, `social:${propId}:linkedin`);
  return c.json({ enqueued: { social_post: res.id } });
});
