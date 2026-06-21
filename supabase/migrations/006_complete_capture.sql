-- ============================================================
-- 006 — Complete capture: structured columns, manager/fund
--       hierarchy, contact enrichment, nullable meeting date.
-- Run AFTER wiping data (companies/contacts/meetings/etc.),
-- BEFORE re-running scripts/import_bbdd.mjs.
-- ============================================================

-- ── companies: manager → fund hierarchy ──────────────────────
alter table companies
  add column parent_company_id uuid references companies(id) on delete set null;
create index on companies (parent_company_id);

-- ── companies: structured fields (were folded into description) ─
alter table companies
  add column website              text,
  add column round_size_musd      numeric,   -- CRM "Round / Fund Size (MUS$)"
  add column valuation_musd       numeric,   -- CRM "Valuation (MUS$)"; N.A./blank -> null
  add column legal                text,      -- CRM "Legal" (SAFE / SPV / Equity ...)
  add column deal_date            date,      -- CRM "Date"
  add column files                text[] not null default '{}',  -- CRM "Files & Media"
  add column investment_stage_ids uuid[] not null default '{}';  -- fund: rolled up from contacts' stages

-- ── contacts: structured fields ──────────────────────────────
alter table contacts
  add column linkedin  text,                 -- Contacts "LinkedIn"
  add column location  text,                  -- Contacts "Country" (person's own location)
  add column stage_ids uuid[] not null default '{}';  -- Contacts "Stage" (stages they invest in)

-- ── meetings: allow dateless meetings ────────────────────────
alter table meetings alter column date drop not null;
