// scripts/seed.ts — seed dummy data so the capabilities have things to chew on.
//
// Run with: npm run seed
//
// Inserts: 3 brokers, 4 properties, 2 inquiries, 4 outreach candidates,
// 4 past blog posts. All capabilities can be triggered against this data.

import { supabase } from '../src/db/supabase.js';

const sb = supabase();

console.log('⏳ Seeding sample data…\n');

// ── Brokers ──────────────────────────────────────────────────────
const brokers = [
  { id: '11111111-1111-1111-1111-000000000001', handle: 'meron.t', name: 'Meron Tadesse',  language: 'English', tier: 'Premium',  strikes: 0, location: 'Addis Ababa, Ethiopia' },
  { id: '11111111-1111-1111-1111-000000000002', handle: 'hewan.s', name: 'Hewan Solomon',  language: 'English', tier: 'Standard', strikes: 0, location: 'Addis Ababa, Ethiopia' },
  { id: '11111111-1111-1111-1111-000000000003', handle: 'yonas.a', name: 'Yonas Alemu',    language: 'English', tier: 'Free',     strikes: 2, location: 'Addis Ababa, Ethiopia' },
];

console.log('  · profiles…');
await sb.from('profiles').upsert(brokers, { onConflict: 'id' });

// ── Properties ───────────────────────────────────────────────────
const properties = [
  {
    id: '22222222-2222-2222-2222-000000000001',
    title: 'Roha Tower Penthouse',
    type: 'penthouse',
    bedrooms: 3, bathrooms: 3, size_m2: 240,
    address: 'Bole, Addis Ababa',
    price: 'ETB 11.4M',
    features: ['360° view', 'private elevator', 'rooftop terrace', 'premium finishes'],
    image_urls: Array.from({ length: 12 }, (_, i) => `https://placehold.co/800x600?text=Roha+${i + 1}`),
    image_hashes: Array.from({ length: 12 }, (_, i) => `hash-roha-${i}`),
    broker_id: brokers[0].id,
    listed_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    inquiries_count: 4,
    views: 234,
    lat: 9.0181, lng: 38.7869,
    country: 'ET',
    agent_status: 'pending',
  },
  {
    id: '22222222-2222-2222-2222-000000000002',
    title: 'Kazanchis 2BR',
    type: 'apartment',
    bedrooms: 2, bathrooms: 2, size_m2: 92,
    address: 'Kazanchis, Addis Ababa',
    price: 'ETB 9.5M',
    features: ['city view', 'parking', 'gym'],
    image_urls: Array.from({ length: 8 }, (_, i) => `https://placehold.co/800x600?text=Kaz+${i + 1}`),
    image_hashes: Array.from({ length: 8 }, (_, i) => `hash-kaz-${i}`),
    broker_id: brokers[1].id,
    listed_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    inquiries_count: 0,
    views: 412,
    lat: 9.0149, lng: 38.7642,
    country: 'ET',
    agent_status: 'validated',
  },
  {
    id: '22222222-2222-2222-2222-000000000003',
    title: 'CMC Villa 4BR',
    type: 'villa',
    bedrooms: 4, bathrooms: 3, size_m2: 320,
    address: 'CMC, Addis Ababa',
    price: 'ETB 18.2M',
    features: ['garden', 'compound', 'maid quarters'],
    image_urls: Array.from({ length: 6 }, (_, i) => `https://placehold.co/800x600?text=CMC+${i + 1}`),
    image_hashes: Array.from({ length: 6 }, (_, i) => 'hash-cmc-dup'),
    broker_id: brokers[2].id,
    listed_at: new Date(Date.now() - 1 * 3600000).toISOString(),
    inquiries_count: 0,
    views: 12,
    lat: 9.0394, lng: 38.8118,
    country: 'ET',
    agent_status: 'pending',
  },
  {
    id: '22222222-2222-2222-2222-000000000004',
    title: 'Sarbet Studio',
    type: 'studio',
    bedrooms: 0, bathrooms: 1, size_m2: 38,
    address: 'Sarbet, Addis Ababa',
    price: 'ETB 3.8M',
    features: ['compact', 'natural light'],
    image_urls: Array.from({ length: 3 }, (_, i) => `https://placehold.co/800x600?text=Studio+${i + 1}`), // < 5 → fails photo gate
    image_hashes: [],
    broker_id: brokers[1].id,
    listed_at: new Date().toISOString(),
    inquiries_count: 0,
    views: 0,
    country: 'ET',
    agent_status: 'pending',
  },
];

console.log('  · properties…');
await sb.from('properties').upsert(properties, { onConflict: 'id' });

// ── Inquiries ────────────────────────────────────────────────────
const inquiries = [
  {
    id: '33333333-3333-3333-3333-000000000001',
    property_id: properties[0].id,
    message: 'Hi, is the Bole penthouse still available? Would love a viewing this Saturday. Budget ~ETB 12M.',
    language: 'English',
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    status: 'new',
  },
  {
    id: '33333333-3333-3333-3333-000000000002',
    property_id: properties[1].id,
    message: 'ይህ አፓርትመንት አሁንም አለ? የቤት ኪራይ ይታያል?',
    language: 'Amharic',
    created_at: new Date(Date.now() - 35 * 60000).toISOString(),
    status: 'new',
  },
];

console.log('  · inquiries…');
await sb.from('inquiries').upsert(inquiries, { onConflict: 'id' });

// ── Outreach candidates ──────────────────────────────────────────
const candidates = [
  { id: 'oc-001', name: 'Faisal Hassan',         location: 'Nairobi, Kenya', country: 'KE', tenure: '4 yrs', listings_count: 47, specialty: 'Karen / Lavington high-end', sourced_from: 'PropZone', language: 'English' },
  { id: 'oc-002', name: 'Layla Al-Rashid',       location: 'Dubai, UAE',     country: 'AE', tenure: '6 yrs', listings_count: 112, specialty: 'Marina / JBR',               sourced_from: 'Bayut alumni',  language: 'Arabic' },
  { id: 'oc-003', name: 'Mukamuhirwa Chantal',   location: 'Kigali, Rwanda', country: 'RW', tenure: '2 yrs', listings_count: 28, specialty: 'Nyarutarama villas',         sourced_from: 'Direct referral',language: 'Kinyarwanda' },
  { id: 'oc-004', name: 'Sipho Ndlovu',          location: 'Cape Town, ZA',  country: 'ZA', tenure: '8 yrs', listings_count: 89, specialty: 'Sea Point / Camps Bay',      sourced_from: 'Property24',     language: 'English' },
];

console.log('  · outreach_candidates…');
await sb.from('outreach_candidates').upsert(candidates, { onConflict: 'id' });

// ── Past blog posts ──────────────────────────────────────────────
const blogPosts = [
  { id: 'b-001', title: '10 photos every CoBrop listing needs',                 category: 'Listing best-practice', reads: 12100, takeaway: 'Concrete checklists with examples drive 41 leads.' },
  { id: 'b-002', title: 'How brokers in Addis split fees with Nairobi',         category: 'Co-brokerage',          reads: 8400,  takeaway: 'Pair specific regional story with how-to drives shares.' },
  { id: 'b-003', title: 'What 30,000 East African inquiries taught us',          category: 'Market data',           reads: 6200,  takeaway: 'Long-form market data outperforms short opinion.' },
  { id: 'b-004', title: 'Why I left agency life: a Dubai broker take',           category: 'Founder voice',         reads: 2100 },
];

console.log('  · blog_posts…');
await sb.from('blog_posts').upsert(blogPosts, { onConflict: 'id' });

console.log('\n✓ Seed complete.\n');
console.log('Try:');
console.log('  npm run trigger -- lead-reply \'{"inquiry_id":"33333333-3333-3333-3333-000000000001"}\'');
console.log('  npm run trigger -- listing-onboard \'{"property_id":"22222222-2222-2222-2222-000000000001"}\'');
console.log('  npm run trigger -- fraud-check \'{"property_id":"22222222-2222-2222-2222-000000000003"}\'');
console.log('  npm run trigger -- broker-outreach \'{"broker_id":"oc-002"}\'');
console.log('  npm run trigger -- blog-draft \'{"title":"Why Kigali ↔ Addis is the new corridor","category":"Co-brokerage"}\'');
console.log();
