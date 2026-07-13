-- ============================================================
-- Network Intelligence — entity (node) layer (020)
--
-- Depends on 018_network_intelligence.sql and 019_network_views_rls.sql.
--
-- WHY: the original model made a graph node == a CRM `companies` row
-- (intro_parties.company_id NOT NULL; network_create_intro rejected any party
-- that didn't resolve to a company). But Network Intelligence is a
-- connector-analysis graph: a vertex like "AWTO" matters for showing who
-- introduced whom even though it should never be a real CRM company.
--
-- This migration introduces `network_entities` — the node. Every intro party
-- and facilitator points at an entity; an entity OPTIONALLY links to a
-- companies row (company_id NULL = a name-only node). Nodes are permanent;
-- promoting one just sets its company_id. The two views are rewritten to key
-- on entity_id, so the graph renders every participant, company-backed or not.
--
-- Backfill is a no-op when no intros exist yet (the current state), but is
-- written to correctly carry any pre-existing intro_parties/intros rows.
-- ============================================================

-- Closer parity with the TS normName() (lower, strip accents, collapse space)
-- used by the app so SQL-backfilled name_norm and app-created name_norm agree.
create extension if not exists unaccent;

-- ── The node table ───────────────────────────────────────────────────────────
create table network_entities (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,                                   -- display name as first seen
  name_norm  text not null unique,                            -- normName(name); dedup key across intros
  company_id uuid references companies(id) on delete set null, -- NULL = name-only node (never a CRM company)
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- A given company backs at most one node.
create unique index network_entities_company_uniq on network_entities (company_id) where company_id is not null;
create index network_entities_company on network_entities (company_id);

create trigger network_entities_updated_at before update on network_entities
  for each row execute function update_updated_at();

-- ── Wire intro parties + facilitators to entities ────────────────────────────
alter table intro_parties add column entity_id uuid references network_entities(id) on delete cascade;
-- Name-only facilitators (e.g. "Bruno Yoshimura — One VC") must count on the
-- leaderboard's "Made" column, so facilitators are entity-based too.
alter table intros add column facilitator_entity_id uuid references network_entities(id) on delete set null;

-- ── Backfill: one entity per company already referenced by an intro ──────────
-- (No-op when intro_parties / intros are empty.)
insert into network_entities (name, name_norm, company_id, created_by)
select distinct on (c.id)
       c.name,
       trim(regexp_replace(lower(unaccent(c.name)), '\s+', ' ', 'g')),
       c.id,
       c.created_by
from companies c
where c.id in (select company_id from intro_parties)
   or c.id in (select facilitator_company_id from intros where facilitator_company_id is not null)
on conflict (name_norm) do nothing;

update intro_parties p
   set entity_id = e.id
  from network_entities e
 where e.company_id = p.company_id
   and p.entity_id is null;

update intros i
   set facilitator_entity_id = e.id
  from network_entities e
 where e.company_id = i.facilitator_company_id
   and i.facilitator_company_id is not null
   and i.facilitator_entity_id is null;

-- Every party must now have a node.
alter table intro_parties alter column entity_id set not null;
-- Dedup key moves from company to entity (company_id stays, nullable/unused by views).
alter table intro_parties drop constraint intro_parties_intro_id_company_id_key;
alter table intro_parties alter column company_id drop not null;
alter table intro_parties add constraint intro_parties_intro_id_entity_id_key unique (intro_id, entity_id);
create index on intro_parties (entity_id);

-- ── RLS: mirror company_aliases (auth read/insert/update, admin delete) ──────
alter table network_entities enable row level security;
create policy "auth read entities"   on network_entities for select to authenticated using (true);
create policy "auth insert entities" on network_entities for insert to authenticated with check (auth.uid() = created_by);
create policy "auth update entities" on network_entities for update to authenticated using (true) with check (true);
create policy "auth delete entities" on network_entities for delete to authenticated using (is_admin());

-- ── Rewrite the views to key on entity_id ────────────────────────────────────
-- Output columns change (company_id -> entity_id), so drop and recreate.
drop view if exists v_constellation_edges;
create view v_constellation_edges as
select
  least(a.entity_id, b.entity_id)    as source_entity_id,
  greatest(a.entity_id, b.entity_id) as target_entity_id,
  count(distinct a.intro_id)         as weight
from intro_parties a
join intro_parties b
  on a.intro_id = b.intro_id
 and a.entity_id < b.entity_id
group by 1, 2;

drop view if exists v_network_leaderboard;
create view v_network_leaderboard as
with helpers as (
  select facilitator_entity_id as entity_id, count(*) as intros_facilitated
  from intros where facilitator_entity_id is not null and deleted_at is null
  group by 1
),
beneficiaries as (
  select p.entity_id, count(distinct p.intro_id) as intros_received
  from intro_parties p
  join intros i on i.id = p.intro_id and i.deleted_at is null
  group by 1
)
select
  e.id                              as entity_id,
  coalesce(c.name, e.name)          as name,
  e.company_id,
  (e.company_id is not null)        as is_company,
  coalesce(h.intros_facilitated, 0) as intros_facilitated,
  coalesce(b.intros_received, 0)    as intros_received
from network_entities e
left join companies c     on c.id = e.company_id and c.deleted_at is null
left join helpers h       on h.entity_id = e.id
left join beneficiaries b on b.entity_id = e.id
where h.intros_facilitated is not null or b.intros_received is not null;
