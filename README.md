# CoBrop Agent · Backend

The autonomous platform agent that powers the [CoBrop Agent monitoring console](../index.html).
Runs on **free-tier services only** — no Anthropic, no OpenAI, no Redis, no paid queues.

## What it does

One Node service that listens for events on your CoBrop Supabase database, reasons about each
event with an LLM, and either acts autonomously or queues the action for admin approval.

Eight capabilities ship in `src/capabilities/`:

| Capability         | Trigger                            | Default autonomy |
|--------------------|------------------------------------|------------------|
| Lead reply         | `inquiries.insert`                 | Auto-pilot       |
| Listing onboard    | `properties.insert/update(photos)` | Assist           |
| Fraud / duplicate  | `properties.insert/update(images)` | Approve          |
| Price suggest      | Daily cron · stale listings        | Assist           |
| Broker outreach    | Daily cron · cohort export         | Assist           |
| Blog draft         | Weekly cron · gap detection        | Assist           |
| Social media post  | `properties.validated`             | Assist           |
| Nudge brokers      | Hourly cron · SLA monitor          | Auto-pilot       |

## Stack (all free tiers)

- **LLM**: [Groq](https://console.groq.com) — Llama 3.3 70B Versatile, ~500 tok/s, free
- **LLM fallback**: [Google Gemini](https://aistudio.google.com) — Gemini Flash, 1,500 req/day free
- **Database**: [Supabase](https://supabase.com) — 500MB Postgres, RLS, free
- **Web framework**: [Hono](https://hono.dev) — runs on Node, Bun, Cloudflare Workers, Deno
- **Hosting**: deploy anywhere (Vercel / Cloudflare Workers / Fly / Render free tier)
- **Cron**: [GitHub Actions](.github/workflows/cron.yml) — free
- **Vision** (fraud / duplicates): [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) — 10k req/day free

## Architecture

```
                                    ┌────────────────────────┐
   Supabase webhooks ──┐             │     Agent service       │
                       ├──── HTTP ───▶│   (this repo · Hono)    │◀── Admin console (../)
   GitHub Actions cron─┘             │                         │
                                     │  ┌───────────────────┐  │
                                     │  │ Queue worker      │  │
                                     │  │ (polls Postgres)  │  │
                                     │  └─────┬─────────────┘  │
                                     │        ▼                │
                                     │  ┌───────────────────┐  │
                                     │  │ Capability router │  │
                                     │  │ (autonomy gate)   │  │
                                     │  └─────┬─────────────┘  │
                                     │        ▼                │
                                     │  ┌───────────────────┐  │
                                     │  │ LLM client        │  │
                                     │  │ (Groq → Gemini)   │  │
                                     │  └───────────────────┘  │
                                     └────────────┬────────────┘
                                                  │
                              ┌───────────────────┼──────────────────┐
                              ▼                   ▼                  ▼
                       Supabase RLS         LinkedIn API      WhatsApp Business
                       (least-privilege)
```

## Quick start (5 min)

### 1. Clone & install

```bash
git clone <this-repo>
cd backend
npm install
cp .env.example .env
```

### 2. Get free API keys

| Service   | Sign-up                                  | What to grab                      |
|-----------|------------------------------------------|-----------------------------------|
| Groq      | https://console.groq.com/keys            | `GROQ_API_KEY`                    |
| Gemini    | https://aistudio.google.com/apikey       | `GEMINI_API_KEY` (fallback)       |
| Supabase  | https://supabase.com (new project)       | `URL`, `ANON_KEY`, `SERVICE_KEY`  |

Paste into `.env`. **No credit card required for any of these.**

### 3. Set up the database

```bash
# 1. Run the core schema (creates agent_tasks, agent_approvals, agent_actions, agent_config + RLS)
psql "$DATABASE_URL" -f schema.sql

# 2. Run the learning-layer schema (adds agent_knowledge table)
psql "$DATABASE_URL" -f learning-schema.sql
```

Or just copy both files into the Supabase SQL editor and run them.

This creates:
- `agent_tasks` — the work queue (replaces Redis)
- `agent_approvals` — what the admin console reads
- `agent_actions` — append-only audit log
- `agent_config` — autonomy settings per capability
- `agent_knowledge` — **what the agent has learned about your platform**
- Row-Level Security policies that pin the agent role to least-privilege

### 4. Teach the agent your platform (one-time, ~30 seconds)

```bash
npm run learn
```

This is the step that makes the agent *yours*. It walks your real database,
reads your past blog posts, listings, and outreach history, and builds a
**learned style profile** — so everything the agent drafts from then on
matches CoBrop's actual voice, not a generic LLM tone.

You'll see something like:

```
🧠 CoBrop Agent · learning from your platform

1/4  Walking your database schema…
     · properties                       8,421 rows · 24 cols
     · profiles                         3,217 rows · 18 cols
     · inquiries                       12,840 rows · 11 cols
     · blog_posts                         142 rows · 14 cols
     ✓ Saved schema map (12 tables)

2/4  Analyzing blog post voice & structure…
     · Asking LLM to extract voice patterns…
     ✓ Saved blog style profile (30 posts analyzed)

3/4  Analyzing listing descriptions…
     ✓ Saved listing pattern (40 samples)

4/4  Analyzing outreach history (if any)…
     ✓ Saved outreach pattern (28 samples)

✓ Learning complete. The agent now knows your platform.
```

Re-run weekly to keep the style profile current (the included GitHub Actions
cron does this automatically every Monday).

### 5. Seed sample data (optional, dev only)

```bash
npm run seed
```

Inserts ~10 dummy properties, brokers, inquiries so capabilities have something to chew on.

### 5. Run it

```bash
npm run dev
```

You should see:

```
✓ CoBrop Agent · listening on http://localhost:8787
✓ LLM: groq (llama-3.3-70b-versatile) · fallback: gemini (1.5-flash)
✓ Supabase: connected
✓ Queue worker: polling every 5s
```

### 6. Trigger a task manually

```bash
# Pretend a new inquiry just landed
npm run trigger -- lead-reply '{"inquiry_id":"00000000-0000-0000-0000-000000000001"}'
```

Watch the console — you'll see the agent reasoning, the LLM call, and the resulting action
(either auto-executed or queued for approval depending on autonomy level).

### 7. Wire to Supabase webhooks (real triggers)

In the Supabase dashboard → **Database → Webhooks → Create**:

```
Name:    on_inquiry_insert
Table:   inquiries
Events:  INSERT
URL:     https://your-agent.vercel.app/webhooks/inquiry
Headers: X-Webhook-Secret: <pick a long random string, put in .env too>
```

Repeat for `properties.insert`, `properties.update`, etc. The handlers in
[`src/routes/webhooks.ts`](src/routes/webhooks.ts) map each to a capability.

### 8. Wire cron triggers (free, via GitHub Actions)

The repo ships with [`.github/workflows/cron.yml`](.github/workflows/cron.yml). Set
two repo secrets:

- `AGENT_URL` — your deployed URL
- `AGENT_CRON_SECRET` — the value of `CRON_SECRET` in your `.env`

It runs `price-suggest` daily, `broker-outreach` daily at 09:00 UTC, and `blog-draft`
weekly. Edit the cron lines to match your schedule.

## Wiring to the admin console

The admin console at [`../index.html`](../index.html) is what you've been reviewing.
To point it at this backend instead of the in-browser mock:

```js
// In the console, replace window.claude.complete(...) with:
async function complete(prompt) {
  const r = await fetch(import.meta.env.VITE_AGENT_URL + '/agent/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return (await r.json()).text;
}
```

And swap the hard-coded approvals/events for live data:

```js
const r = await fetch(VITE_AGENT_URL + '/approvals?status=pending');
const approvals = await r.json();
```

## Deploy

### Option A · Vercel (recommended, free)

```bash
vercel deploy
```

The included `vercel.json` configures both the Hono routes and a background worker
(Vercel Functions can poll the queue on a cron schedule).

### Option B · Cloudflare Workers (also free, faster cold-starts)

```bash
npm run deploy:cf
```

### Option C · Just run it on a Raspberry Pi / old laptop

```bash
npm run build && npm start
```

The whole thing is ~80MB of Node — runs comfortably on a Pi 4.

## Cost

Running the entire CoBrop agent for 1,000 brokers, ~3,000 tasks/day:

| Service                | Cost          |
|------------------------|---------------|
| Groq (LLM)             | **$0**        |
| Supabase free tier     | $0            |
| Vercel free tier       | $0            |
| GitHub Actions cron    | $0            |
| Cloudflare Workers AI  | $0 (under 10k/day) |
| **Total**              | **$0 / month**|

If you blow past Groq's free rate limit (currently 30 req/min on Llama 3.3 70B),
the client automatically falls back to Gemini Flash (1,500 req/day free).
That's enough headroom for ~50,000 tasks/day before you'd need to pay anything.

## Project layout

```
backend/
├── README.md                    ← you are here
├── schema.sql                   ← Postgres schema + RLS policies
├── .env.example                 ← copy → .env
├── package.json
├── tsconfig.json
├── vercel.json                  ← Vercel deploy config
├── wrangler.toml                ← Cloudflare Workers deploy config
├── .github/workflows/cron.yml   ← free cron via GitHub Actions
├── scripts/
│   ├── seed.ts                  ← seed sample data
│   └── trigger-task.ts          ← CLI to enqueue a task
└── src/
    ├── index.ts                 ← Hono server entry
    ├── config.ts                ← env loader
    ├── types.ts                 ← shared TS types
    ├── llm/
    │   ├── client.ts            ← Groq + Gemini fallback
    │   └── prompts.ts           ← all capability prompts (same as the UI demo)
    ├── db/
    │   └── supabase.ts          ← typed Supabase client
    ├── capabilities/
    │   ├── index.ts             ← capability registry
    │   ├── lead-reply.ts
    │   ├── listing-onboard.ts
    │   ├── fraud-check.ts
    │   ├── price-suggest.ts
    │   ├── broker-outreach.ts
    │   ├── blog-draft.ts
    │   ├── social-post.ts
    │   └── nudge-broker.ts
    ├── queue/
    │   ├── router.ts            ← decides auto vs pending per autonomy + risk
    │   └── worker.ts            ← polls agent_tasks, dispatches
    ├── routes/
    │   ├── webhooks.ts          ← Supabase webhook receivers
    │   ├── approvals.ts         ← admin console API
    │   ├── agent.ts             ← manual triggers, draft endpoint
    │   └── health.ts
    └── middleware/
        ├── auth.ts              ← verify webhook secrets, admin JWT
        └── audit.ts             ← append-only log writer
```

## Next steps after this skeleton

1. **Connect to your actual CoBrop database** — point `SUPABASE_URL` at your real project and
   adjust the table names in `src/db/supabase.ts` to match.
2. **Get a LinkedIn / Meta dev account** — both free — and paste OAuth tokens into `.env`.
   Then `social-post` will actually publish.
3. **Add WhatsApp Business** (free tier covers ~1,000 conversations/month) for the
   broker-outreach channel.
4. **Tune prompts** in `src/llm/prompts.ts` against your actual past blog posts and best-performing
   outreach. The prompts shipped here are the same ones you saw in the UI demo.
5. **Set autonomy per capability** in the `agent_config` table — start everything on `approve`
   for the first week, watch the audit log, gradually move to `assist` then `autopilot`.

## License

MIT — copy, modify, ship.
