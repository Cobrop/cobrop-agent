-- ══════════════════════════════════════════════════════════════════════
-- CoBrop Agent · Learning layer
--
-- Run AFTER schema.sql.
--
-- This adds a single table where the agent stores everything it has
-- learned about your platform: the structure of your real DB, the
-- voice/format of your past blog posts, the patterns in your listings,
-- the style of your top-performing outreach, etc.
--
-- The agent reads from this table before drafting anything new, so it
-- stays consistent with how CoBrop already operates instead of writing
-- in a generic LLM voice.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists agent_knowledge (
  id            text primary key,             -- e.g. 'blog.style', 'listing.pattern', 'schema.map'
  kind          text not null,                -- 'style' | 'schema' | 'pattern' | 'guide' | 'sample'
  subject       text not null,                -- 'blog_posts' | 'properties' | 'profiles' | …
  summary       text not null,                -- short human-readable description
  data          jsonb not null,               -- the actual learned profile
  sample_size   int,                          -- how many records went into this
  confidence    numeric(3,2),
  built_at      timestamptz not null default now(),
  built_by      text not null default 'learn-from-platform',
  expires_at    timestamptz                   -- null = never; some entries refresh weekly
);

create index if not exists agent_knowledge_kind_idx on agent_knowledge (kind, subject);
create index if not exists agent_knowledge_built_idx on agent_knowledge (built_at desc);

-- RLS — agent can read its own knowledge; admins can read everything
alter table agent_knowledge enable row level security;

create policy if not exists "knowledge_read_agent"
  on agent_knowledge for select to platform_agent using (true);

create policy if not exists "knowledge_write_agent"
  on agent_knowledge for insert to platform_agent with check (true);

create policy if not exists "knowledge_update_agent"
  on agent_knowledge for update to platform_agent using (true) with check (true);

create policy if not exists "knowledge_admin_all"
  on agent_knowledge for all to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

-- Helper view: latest knowledge entry per (kind, subject)
create or replace view agent_knowledge_latest as
select distinct on (kind, subject) *
from agent_knowledge
order by kind, subject, built_at desc;

-- ── (Optional) RPC to claim next task atomically with SKIP LOCKED ───
-- Used by queue/worker.ts if present. Otherwise the worker falls back
-- to a simple UPDATE … RETURNING, which is fine for low concurrency.

create or replace function claim_next_agent_task()
returns agent_tasks
language plpgsql
as $$
declare
  picked agent_tasks;
begin
  with next_task as (
    select id from agent_tasks
    where status = 'pending'
    order by created_at
    for update skip locked
    limit 1
  )
  update agent_tasks t
     set status = 'running',
         started_at = now(),
         attempts = t.attempts + 1
    from next_task
   where t.id = next_task.id
  returning t.* into picked;
  return picked;
end;
$$;
