-- ============================================================
-- Network Intelligence — base tables (018)
--
-- Intros become graph edges over the *existing* companies/contacts.
-- A party in an intro is a FOREIGN KEY to companies.id, never a copy —
-- so there is nothing to synchronize and dedup happens once, at insert
-- time (src/lib/network/resolve.ts + network_search_companies), before
-- anything is created. New companies that don't resolve go through the
-- existing staging → /triage → promote_staging_event path (012), not a
-- new confirmation UI.
--
-- Views + RLS for these tables live in 019_network_views_rls.sql.
-- ============================================================

-- Companies/contacts gain an internal flag (GG's own org + team members).
alter table companies add column if not exists is_internal boolean not null default false;
alter table contacts  add column if not exists is_internal boolean not null default false;

-- ── Positive-match alias table for entity resolution ─────────────────────────
-- Negatives (forbidden pairs) live in the Skill + src/lib/network/resolve.ts.
create table if not exists company_aliases (
  alias      text primary key,        -- normalized: lower, unaccented, single-spaced (normName)
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists company_aliases_company on company_aliases (company_id);

-- ── Known email domains → company, for domain-tier matching ──────────────────
create table if not exists company_domains (
  domain     text primary key,        -- lower, e.g. 'norteventures.com'
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists company_domains_company on company_domains (company_id);

-- ── Intros: one row per introduction event ───────────────────────────────────
create table intros (
  id            uuid primary key default uuid_generate_v4(),
  direction     text not null check (direction in
                  ('outbound','outbound_internal','inbound','other')),
  occurred_on   date,
  subject       text,
  facilitator_company_id uuid references companies(id) on delete set null,
  facilitator_contact_id uuid references contacts(id)  on delete set null,
  source        text not null default 'skill_import',  -- skill_import | manual | bulk_excel
  source_ref    text,                                   -- idempotency key (e.g. gmail_thread_id or file:row)
  notes         text,
  created_by    uuid not null references auth.users(id),
  updated_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (source, source_ref)                           -- re-import can't duplicate
);
create index on intros (direction);
create index on intros (occurred_on);

-- ── Intro parties: the companies on each side of an intro ─────────────────────
create table intro_parties (
  id          uuid primary key default uuid_generate_v4(),
  intro_id    uuid not null references intros(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  side        smallint not null check (side in (1,2)),
  created_at  timestamptz not null default now(),
  unique (intro_id, company_id)
);
create index on intro_parties (intro_id);
create index on intro_parties (company_id);

-- ── Relationship sources: who introduced a company to GG (provenance) ─────────
create table relationship_sources (
  company_id               uuid primary key references companies(id) on delete cascade,
  introduced_by_company_id uuid references companies(id) on delete set null,
  introduced_by_contact_id uuid references contacts(id)  on delete set null,
  note                     text,
  created_by               uuid not null references auth.users(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ── Keep updated_at fresh on edits (reuses the shared trigger fn from 001) ────
create trigger intros_updated_at before update on intros
  for each row execute function update_updated_at();
create trigger relationship_sources_updated_at before update on relationship_sources
  for each row execute function update_updated_at();
