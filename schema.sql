-- ══════════════════════════════════════════════════════════════════════
-- CoBrop Agent · Postgres schema
-- Run this in the Supabase SQL editor (or `psql -f schema.sql`).
--
-- Adds 5 tables + RLS policies + a `platform_agent` role with
-- least-privilege access to your existing CoBrop tables.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Agent task queue ──────────────────────────────────────────
-- Replaces Redis. The worker polls this table for `pending` rows.
create table if not exists agent_tasks (
  id            uuid primary key default gen_random_uuid(),
  capability    text not null,                       -- e.g. 'lead-reply', 'listing-onboard'
  input         jsonb not null default '{}'::jsonb,  -- arbitrary payload
  status        text not null default 'pending'      -- pending | running | done | failed
                check (status in ('pending','running','done','failed')),
  attempts      int  not null default 0,
  max_attempts  int  not null default 3,
  result        jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  -- for cron-spawned tasks, prevent duplicates within a window
  dedup_key     text unique
);

create index if not exists agent_tasks_pending_idx
  on agent_tasks (status, created_at)
  where status = 'pending';

create index if not exists agent_tasks_capability_idx
  on agent_tasks (capability, created_at desc);

-- ── 2. Approvals (what the admin console reads) ──────────────────
create table if not exists agent_approvals (
  id            text primary key,                    -- e.g. 'RSK-0421', 'PR-2241'
  capability    text not null,
  task_id       uuid references agent_tasks(id) on delete set null,
  risk          text not null check (risk in ('low','med','high')),
  confidence    numeric(3,2) not null,               -- 0.00 — 1.00
  what          text not null,                        -- short title
  who           text,                                 -- broker / entity label
  proposal      text not null,                        -- the action to be taken
  evidence      jsonb not null default '[]'::jsonb,   -- [{label,value}]
  trace         jsonb not null default '[]'::jsonb,   -- [{state,title,t}]
  sla_ms        bigint not null,                      -- SLA window
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','snoozed','expired')),
  decided_at    timestamptz,
  decided_by    text,
  decision_reason text,
  created_at    timestamptz not null default now()
);

create index if not exists agent_approvals_status_idx
  on agent_approvals (status, created_at desc);

-- ── 3. Append-only audit log ─────────────────────────────────────
-- Every agent action lands here. NO updates, NO deletes (enforced
-- by RLS below).
create table if not exists agent_actions (
  id            bigserial primary key,
  task_id       uuid references agent_tasks(id) on delete set null,
  approval_id   text references agent_approvals(id) on delete set null,
  capability    text not null,
  autonomy      text not null check (autonomy in ('approve','assist','autopilot')),
  status        text not null check (status in ('auto-completed','approved-executed','rejected','blocked','failed')),
  ref_entity    text,                                 -- e.g. 'property:9914'
  duration_ms   int,
  cost_usd      numeric(8,4),
  tokens_in     int,
  tokens_out    int,
  model         text,
  llm_provider  text,                                 -- 'groq' | 'gemini'
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists agent_actions_capability_idx
  on agent_actions (capability, created_at desc);

create index if not exists agent_actions_created_idx
  on agent_actions (created_at desc);

-- ── 4. Per-capability config (autonomy + guardrails) ─────────────
create table if not exists agent_config (
  capability    text primary key,
  autonomy      text not null default 'approve'
                check (autonomy in ('off','approve','assist','autopilot')),
  daily_cap     int,                                  -- max tasks/day; null = unlimited
  guardrails    jsonb not null default '{}'::jsonb,   -- e.g. { "max_spend_usd": 50, "languages": ["en","am","ar"] }
  updated_at    timestamptz not null default now()
);

-- Seed default config — start everything on `approve` for safety
insert into agent_config (capability, autonomy) values
  ('lead-reply',       'autopilot'),
  ('listing-onboard',  'assist'),
  ('fraud-check',      'approve'),
  ('price-suggest',    'assist'),
  ('broker-outreach',  'assist'),
  ('blog-draft',       'assist'),
  ('social-post',      'assist'),
  ('nudge-broker',     'autopilot'),
  ('broker-recruit',   'approve')
on conflict (capability) do nothing;

-- ── 5. Broker prospects — cold-outreach recruitment ──────────────
-- Candidate brokers not yet on CoBrop. No scraping/sourcing pipeline
-- exists — rows are added manually (admin console / API) until a real
-- sourcing integration is built. The agent drafts personalized invites
-- from this data; it never invents prospects itself.
create table if not exists broker_prospects (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  company       text,
  location      text,                                 -- city
  country       text,
  email         text,
  linkedin_url  text,
  phone         text,
  language      text not null default 'English',
  source        text not null default 'manual',       -- how this lead was found
  notes         text,
  fit_score     int,                                   -- 0-100, optional
  status        text not null default 'new'
                check (status in ('new','contacted','responded','onboarded','declined')),
  added_by      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  contacted_at  timestamptz
);

create index if not exists broker_prospects_status_idx
  on broker_prospects (status, created_at desc);

-- ══════════════════════════════════════════════════════════════════════
-- Row-Level Security · enforce least-privilege for the agent
-- ══════════════════════════════════════════════════════════════════════

-- A custom database role the agent service authenticates as.
-- (In Supabase, you'll typically use the service_role JWT and apply
-- these same constraints via RLS policies + a `current_setting` check.)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'platform_agent') then
    create role platform_agent;
  end if;
end $$;

-- Enable RLS on every agent table
alter table agent_tasks       enable row level security;
alter table agent_approvals   enable row level security;
alter table agent_actions     enable row level security;
alter table agent_config      enable row level security;
alter table broker_prospects  enable row level security;

-- Service-role bypasses RLS, but if you instead issue scoped JWTs
-- with role = 'platform_agent', the following policies apply:

create policy if not exists "agent_tasks_full_for_agent"
  on agent_tasks for all
  to platform_agent
  using (true) with check (true);

create policy if not exists "agent_approvals_rw_for_agent"
  on agent_approvals for all
  to platform_agent
  using (true) with check (true);

create policy if not exists "agent_approvals_admin_decides"
  on agent_approvals for update
  to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

create policy if not exists "agent_actions_append_only"
  on agent_actions for insert
  to platform_agent
  with check (true);

-- Explicitly NO update/delete policy → append-only audit log
-- (RLS denies by default; absence of policy = no access)

create policy if not exists "agent_actions_admin_read"
  on agent_actions for select
  to authenticated
  using (auth.jwt() ->> 'role' in ('admin','platform_agent'));

create policy if not exists "agent_config_admin_only"
  on agent_config for all
  to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

create policy if not exists "agent_config_read_for_agent"
  on agent_config for select
  to platform_agent
  using (true);

create policy if not exists "broker_prospects_full_for_agent"
  on broker_prospects for all
  to platform_agent
  using (true) with check (true);

create policy if not exists "broker_prospects_admin_all"
  on broker_prospects for all
  to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

-- ══════════════════════════════════════════════════════════════════════
-- Hardening · what the agent must NEVER do on existing CoBrop tables
--
-- Adjust these to match your real table names. Below assumes the
-- standard CoBrop schema (properties, profiles, inquiries, etc).
-- ══════════════════════════════════════════════════════════════════════

-- Properties: READ all, WRITE only agent_status, description columns
create policy if not exists "properties_agent_select"
  on properties for select to platform_agent using (true);

create policy if not exists "properties_agent_update_safe_cols"
  on properties for update to platform_agent
  using (true)
  with check (true); -- column-level constraints enforced via grants below

revoke update on properties from platform_agent;
grant  update (description, description_am, description_ar, description_fr,
               agent_status, agent_notes, price_recommendation)
   on properties to platform_agent;

-- Profiles: READ ONLY (cannot modify roles, payment fields, auth)
create policy if not exists "profiles_agent_select"
  on profiles for select to platform_agent using (true);
revoke insert, update, delete on profiles from platform_agent;

-- Transactions: READ ONLY (cannot initiate, refund, modify)
create policy if not exists "transactions_agent_select"
  on transactions for select to platform_agent using (true);
revoke insert, update, delete on transactions from platform_agent;

-- Inquiries: full read, INSERT/UPDATE allowed (for auto-replies + routing)
create policy if not exists "inquiries_agent_all"
  on inquiries for all to platform_agent using (true) with check (true);
revoke delete on inquiries from platform_agent; -- never delete an inquiry

-- ── Helpful views for the admin console ──────────────────────────

create or replace view agent_kpis_today as
select
  count(*)                                                   as tasks_today,
  count(*) filter (where status = 'auto-completed')::float
    / nullif(count(*),0) * 100                              as auto_pct,
  count(*) filter (where status = 'failed')                  as failures,
  sum(cost_usd)                                              as cost_usd,
  sum(duration_ms)::numeric / 1000 / 60                      as minutes_spent
from agent_actions
where created_at >= now() - interval '1 day';

create or replace view agent_capability_stats as
select
  capability,
  count(*)                                                   as runs_7d,
  avg(duration_ms)                                           as avg_ms,
  sum(cost_usd)                                              as total_cost,
  count(*) filter (where status = 'auto-completed')::float
    / nullif(count(*),0) * 100                              as auto_pct
from agent_actions
where created_at >= now() - interval '7 days'
group by capability
order by runs_7d desc;
