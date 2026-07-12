-- ============================================================
-- Network Intelligence — views + RLS (019)
--
-- Depends on 018_network_intelligence.sql (run 018 first).
--
-- The constellation and leaderboard read the two views below. They are
-- correct the instant any intro or company row changes — no refresh, no
-- materialization, no sync — because they join live through to companies.
-- ============================================================

-- ── Fuzzy-match support (tier 4 of network_search_companies) ─────────────────
-- The exact→alias→domain→fuzzy resolver's last tier uses pg_trgm similarity()
-- over companies.name. Enable the extension + a trigram index so the fuzzy
-- lookup is both possible and fast. (Not in the plan's literal SQL, but the
-- fuzzy tier it specifies cannot run without it.)
create extension if not exists pg_trgm;
create index if not exists companies_name_trgm on companies using gin (name gin_trgm_ops);

-- ── RLS: same posture as the rest of the CRM ─────────────────────────────────
-- (authenticated read/write, admin delete — mirrors 002_rls.sql). Tables that
-- carry created_by/updated_by check them the way companies does; pure
-- join/reference tables mirror meeting_participants / the tag catalogs.
alter table intros                enable row level security;
alter table intro_parties         enable row level security;
alter table relationship_sources  enable row level security;
alter table company_aliases       enable row level security;
alter table company_domains       enable row level security;

-- intros — mirrors companies (created_by/updated_by, admin delete)
create policy "auth read intros"   on intros for select to authenticated using (true);
create policy "auth insert intros" on intros for insert to authenticated with check (auth.uid() = created_by);
create policy "auth update intros" on intros for update to authenticated using (true) with check (auth.uid() = updated_by);
create policy "auth delete intros" on intros for delete to authenticated using (is_admin());

-- intro_parties — pure join table, mirrors meeting_participants
create policy "auth read intro parties"   on intro_parties for select to authenticated using (true);
create policy "auth insert intro parties" on intro_parties for insert to authenticated with check (true);
create policy "auth delete intro parties" on intro_parties for delete to authenticated using (true);

-- relationship_sources — carries created_by (no updated_by column), admin delete
create policy "auth read relationship sources"   on relationship_sources for select to authenticated using (true);
create policy "auth insert relationship sources" on relationship_sources for insert to authenticated with check (auth.uid() = created_by);
create policy "auth update relationship sources" on relationship_sources for update to authenticated using (true) with check (true);
create policy "auth delete relationship sources" on relationship_sources for delete to authenticated using (is_admin());

-- company_aliases — curated reference table, mirrors tag catalogs (admin delete)
create policy "auth read aliases"   on company_aliases for select to authenticated using (true);
create policy "auth insert aliases" on company_aliases for insert to authenticated with check (true);
create policy "auth update aliases" on company_aliases for update to authenticated using (true);
create policy "auth delete aliases" on company_aliases for delete to authenticated using (is_admin());

-- company_domains — curated reference table, mirrors tag catalogs (admin delete)
create policy "auth read domains"   on company_domains for select to authenticated using (true);
create policy "auth insert domains" on company_domains for insert to authenticated with check (true);
create policy "auth update domains" on company_domains for update to authenticated using (true);
create policy "auth delete domains" on company_domains for delete to authenticated using (is_admin());

-- ── Constellation feed: org-level edges, computed live from intros ───────────
-- One row per (companyA, companyB) pair with weight = # of intros connecting them.
create or replace view v_constellation_edges as
select
  least(a.company_id, b.company_id)    as source_company_id,
  greatest(a.company_id, b.company_id) as target_company_id,
  count(distinct a.intro_id)           as weight
from intro_parties a
join intro_parties b
  on a.intro_id = b.intro_id
 and a.company_id < b.company_id
group by 1, 2;

-- ── Leaderboard: helpers (facilitators) and beneficiaries ────────────────────
create or replace view v_network_leaderboard as
with helpers as (
  select facilitator_company_id as company_id, count(*) as intros_facilitated
  from intros where facilitator_company_id is not null and deleted_at is null
  group by 1
),
beneficiaries as (
  select p.company_id, count(distinct p.intro_id) as intros_received
  from intro_parties p
  join intros i on i.id = p.intro_id and i.deleted_at is null
  group by 1
)
select
  c.id as company_id, c.name,
  coalesce(h.intros_facilitated, 0) as intros_facilitated,
  coalesce(b.intros_received, 0)    as intros_received
from companies c
left join helpers h       on h.company_id = c.id
left join beneficiaries b on b.company_id = c.id
where c.deleted_at is null
  and (h.intros_facilitated is not null or b.intros_received is not null);
