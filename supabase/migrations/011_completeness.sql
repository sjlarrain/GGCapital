-- A2: data_status + missing_fields completeness tracking on companies and contacts

create type data_status as enum ('stub', 'partial', 'complete');
-- stub    = only required fields present
-- partial = some desired fields present
-- complete = all desired fields present

alter table companies add column data_status   data_status not null default 'stub';
alter table companies add column missing_fields text[]      not null default '{}';

alter table contacts  add column data_status   data_status not null default 'stub';
alter table contacts  add column missing_fields text[]      not null default '{}';

-- ── Company completeness ──────────────────────────────────────────────────────
-- Desired: website, industry_ids, region_ids, stage_ids, type_id, status_id, description

create or replace function compute_company_completeness() returns trigger as $$
declare
  missing text[] := '{}';
begin
  if new.website is null or new.website = '' then
    missing := array_append(missing, 'website');
  end if;
  if new.industry_ids is null or array_length(new.industry_ids, 1) is null then
    missing := array_append(missing, 'industry_ids');
  end if;
  if new.region_ids is null or array_length(new.region_ids, 1) is null then
    missing := array_append(missing, 'region_ids');
  end if;
  if new.stage_ids is null or array_length(new.stage_ids, 1) is null then
    missing := array_append(missing, 'stage_ids');
  end if;
  if new.type_id is null then
    missing := array_append(missing, 'type_id');
  end if;
  if new.status_id is null then
    missing := array_append(missing, 'status_id');
  end if;
  if new.description is null or new.description = '' then
    missing := array_append(missing, 'description');
  end if;

  new.missing_fields := missing;
  new.data_status := case
    when array_length(missing, 1) is null         then 'complete'
    when array_length(missing, 1) = 7             then 'stub'
    else 'partial'
  end;
  return new;
end $$ language plpgsql;

create trigger trg_company_completeness
  before insert or update on companies
  for each row execute function compute_company_completeness();

-- ── Contact completeness ──────────────────────────────────────────────────────
-- Desired: phone, role, expertise (notes), linkedin, location

create or replace function compute_contact_completeness() returns trigger as $$
declare
  missing text[] := '{}';
begin
  if new.phone is null or new.phone = '' then
    missing := array_append(missing, 'phone');
  end if;
  if new.role is null or new.role = '' then
    missing := array_append(missing, 'role');
  end if;
  if new.expertise is null or new.expertise = '' then
    missing := array_append(missing, 'expertise');
  end if;
  if new.linkedin is null or new.linkedin = '' then
    missing := array_append(missing, 'linkedin');
  end if;
  if new.location is null or new.location = '' then
    missing := array_append(missing, 'location');
  end if;

  new.missing_fields := missing;
  new.data_status := case
    when array_length(missing, 1) is null         then 'complete'
    when array_length(missing, 1) = 5             then 'stub'
    else 'partial'
  end;
  return new;
end $$ language plpgsql;

create trigger trg_contact_completeness
  before insert or update on contacts
  for each row execute function compute_contact_completeness();

-- ── Backfill existing rows ────────────────────────────────────────────────────
-- Touch every row so the BEFORE triggers fire and compute correct status.
update companies set name = name;
update contacts  set name = name;
