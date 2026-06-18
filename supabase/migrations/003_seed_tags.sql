-- ============================================================
-- SEED TAG CATALOGS (real values loaded upfront before testing)
-- ============================================================

-- Industries
insert into tag_industries (name) values
  ('Technology'),
  ('Fintech'),
  ('Healthcare'),
  ('Real Estate'),
  ('Energy'),
  ('Consumer'),
  ('Industrials'),
  ('Financial Services'),
  ('Education'),
  ('Media & Entertainment'),
  ('Telecommunications'),
  ('Agriculture'),
  ('Infrastructure'),
  ('Defence'),
  ('SaaS'),
  ('Deep Tech'),
  ('Climate Tech'),
  ('Biotech'),
  ('E-commerce'),
  ('Logistics')
on conflict (name) do nothing;

-- Regions / Countries
insert into tag_regions (name) values
  ('Australia'),
  ('New Zealand'),
  ('United States'),
  ('United Kingdom'),
  ('Singapore'),
  ('Hong Kong'),
  ('Japan'),
  ('South Korea'),
  ('China'),
  ('India'),
  ('Southeast Asia'),
  ('Europe'),
  ('Middle East'),
  ('Canada'),
  ('Latin America'),
  ('Africa'),
  ('Global')
on conflict (name) do nothing;

-- Stages
insert into tag_stages (name) values
  ('Pre-Seed'),
  ('Seed'),
  ('Series A'),
  ('Series B'),
  ('Series C'),
  ('Series D+'),
  ('Growth'),
  ('Pre-IPO'),
  ('Listed'),
  ('Mature')
on conflict (name) do nothing;

-- Types
insert into tag_types (name) values
  ('Fund'),
  ('Company'),
  ('Broker'),
  ('LP'),
  ('GP'),
  ('Family Office'),
  ('Sovereign Wealth Fund'),
  ('Accelerator'),
  ('Incubator'),
  ('Corporate VC'),
  ('Angel')
on conflict (name) do nothing;

-- Statuses
insert into tag_statuses (name) values
  ('Active'),
  ('Inactive'),
  ('Prospect'),
  ('Portfolio'),
  ('Exited'),
  ('Watch'),
  ('Passed'),
  ('Pending')
on conflict (name) do nothing;
