-- ============================================================
-- Founded year (022) — optional field for companies, funds, investors
-- ============================================================

alter table companies add column founded_year integer;

alter table companies add constraint companies_founded_year_range
  check (founded_year is null or (founded_year between 1800 and 2100));
