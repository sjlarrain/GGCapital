-- ============================================================
-- 004 — App changes required before BBDD import
-- ============================================================

-- ── New table: meeting type catalog ──────────────────────────
create table tag_meeting_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into tag_meeting_types (name) values
  ('Legal'),
  ('Meeting'),
  ('Network'),
  ('Pitch'),
  ('Update');

-- ── meetings: make company optional, add type ─────────────────
alter table meetings alter column company_id drop not null;

alter table meetings
  add column type_id uuid references tag_meeting_types(id) on delete set null;

create index on meetings (type_id);

-- ── companies: add source ─────────────────────────────────────
alter table companies
  add column source text check (source in ('Direct', 'Fund'));

-- ── contacts: add investment_focus ───────────────────────────
alter table contacts
  add column investment_focus text[] not null default '{}';

-- ── tag_industries: replace with unified 21-tag list ─────────
truncate tag_industries restart identity cascade;

insert into tag_industries (name) values
  ('AI'),
  ('Agnostic'),
  ('Climate Tech'),
  ('Data'),
  ('E-Commerce'),
  ('Fintech'),
  ('Foodtech'),
  ('Gaming'),
  ('Healthtech'),
  ('Insurtech'),
  ('Life Science'),
  ('Logistic'),
  ('Marketplace'),
  ('Mobility'),
  ('Pet Tech'),
  ('Proptech'),
  ('Retailtech'),
  ('SaaS'),
  ('Secondaries'),
  ('Traveltech'),
  ('Wellness');

-- ── tag_types: add VC and Network ────────────────────────────
insert into tag_types (name) values
  ('Network'),
  ('VC')
on conflict (name) do nothing;

-- ── tag_stages: add three new values ─────────────────────────
insert into tag_stages (name) values
  ('Non Deal Roadshow'),
  ('VC Fundraising'),
  ('Venture Debt')
on conflict (name) do nothing;

-- ── tag_statuses: remove Passed, add Rejected and Approved ───
delete from tag_statuses where name = 'Passed';

insert into tag_statuses (name) values
  ('Approved'),
  ('Rejected')
on conflict (name) do nothing;
