-- ============================================================
-- A4 — Staging + review (low-confidence / incomplete events)
--
-- Holding area for events an agent is unsure about, or that fail
-- a hard rule, so a human (or agent) can review/complete before
-- promotion into the official CRM tables.
--
-- (Spec numbers this 009_staging; renumbered to 012 to follow the
--  repo's actual migration sequence — 010_api_tokens, 011_completeness.)
-- ============================================================

create type staging_status as enum
  ('pending', 'classified', 'needs_info', 'ready', 'promoted', 'rejected');

create table staging_events (
  id               uuid primary key default uuid_generate_v4(),
  source           text not null,                 -- manual | agent | import | email (Track B)
  source_ref       text,                          -- idempotency key
  raw_payload      jsonb not null,
  extracted        jsonb,
  proposed_links   jsonb,                         -- {company:{...|id}, contact:{...}, confidences}
  event_class      text,                          -- new_company | new_contact | meeting | interaction | update | unknown
  confidence       numeric check (confidence between 0 and 1),
  status           staging_status not null default 'pending',
  blocking_reasons text[] not null default '{}',  -- missing_company, ambiguous_contact, unmapped_tag, …
  assigned_to      uuid references auth.users(id),
  classified_by    uuid references auth.users(id),
  promoted_to      jsonb,                         -- [{table,id}]
  created_by       uuid not null references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  unique (source, source_ref)
);

create index on staging_events (status);
create index on staging_events (event_class);

create table staging_event_log (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid not null references staging_events(id) on delete cascade,
  from_status staging_status,
  to_status   staging_status,
  action      text not null,
  detail      jsonb,
  actor       uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index on staging_event_log (event_id);

-- Keep updated_at fresh on edits (reuses the shared trigger fn from 001).
create trigger staging_events_updated_at before update on staging_events
  for each row execute function update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table staging_events    enable row level security;
alter table staging_event_log enable row level security;

create policy "auth rw staging"     on staging_events    for all to authenticated using (true) with check (true);
create policy "auth rw staging log" on staging_event_log for all to authenticated using (true) with check (true);

-- ============================================================
-- Transactional promotion
--
-- Promotes a *ready* event into the official tables. Company and
-- contact are created together (or not at all): a plpgsql function
-- body is a single transaction, so any failure rolls back every
-- write — never a partial company-without-contact (or vice versa).
--
-- Reads proposed_links off the event row:
--   company : { id }                     -> link existing company
--           | { name, ...fields }        -> create new company
--   contact : { name, email, ...fields } -> create contact, linked to the
--                                           company above (or contact.company_id)
--
-- Re-checks status under a row lock to stay safe against races; the
-- REST/route layer returns 409 when this raises 'STAGING_NOT_READY'.
-- ============================================================
create or replace function promote_staging_event(p_event_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev           staging_events%rowtype;
  links        jsonb;
  comp         jsonb;
  cont         jsonb;
  v_company_id uuid;
  v_contact_id uuid;
  promoted     jsonb := '[]'::jsonb;
begin
  select * into ev from staging_events where id = p_event_id for update;
  if not found then
    raise exception 'STAGING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if ev.status <> 'ready' then
    raise exception 'STAGING_NOT_READY' using errcode = 'P0001';
  end if;

  links := coalesce(ev.proposed_links, '{}'::jsonb);
  comp  := links -> 'company';
  cont  := links -> 'contact';

  -- ── Company: link existing, or create new ──────────────────────────────────
  if comp is not null and comp ? 'id' then
    v_company_id := (comp ->> 'id')::uuid;
  elsif comp is not null and nullif(comp ->> 'name', '') is not null then
    insert into companies (
      name, description, website, source, country,
      type_id, status_id, parent_company_id,
      industry_ids, region_ids, stage_ids, investment_stage_ids,
      created_by, updated_by
    ) values (
      comp ->> 'name',
      comp ->> 'description',
      comp ->> 'website',
      comp ->> 'source',
      comp ->> 'country',
      nullif(comp ->> 'type_id', '')::uuid,
      nullif(comp ->> 'status_id', '')::uuid,
      nullif(comp ->> 'parent_company_id', '')::uuid,
      coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(comp -> 'industry_ids')), '{}'),
      coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(comp -> 'region_ids')), '{}'),
      coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(comp -> 'stage_ids')), '{}'),
      coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(comp -> 'investment_stage_ids')), '{}'),
      p_actor, p_actor
    )
    returning id into v_company_id;
    promoted := promoted || jsonb_build_object('table', 'companies', 'id', v_company_id);
  end if;

  -- ── Contact: create, linked to the company resolved above ──────────────────
  if cont is not null and nullif(cont ->> 'name', '') is not null then
    insert into contacts (
      name, email, role, employer, phone, expertise, location, linkedin,
      company_id, industry_ids, region_ids, investment_focus, stage_ids,
      created_by, updated_by
    ) values (
      cont ->> 'name',
      cont ->> 'email',
      cont ->> 'role',
      cont ->> 'employer',
      cont ->> 'phone',
      cont ->> 'expertise',
      cont ->> 'location',
      cont ->> 'linkedin',
      coalesce(nullif(cont ->> 'company_id', '')::uuid, v_company_id),
      coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(cont -> 'industry_ids')), '{}'),
      coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(cont -> 'region_ids')), '{}'),
      coalesce((select array_agg(value)       from jsonb_array_elements_text(cont -> 'investment_focus')), '{}'),
      coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(cont -> 'stage_ids')), '{}'),
      p_actor, p_actor
    )
    returning id into v_contact_id;
    promoted := promoted || jsonb_build_object('table', 'contacts', 'id', v_contact_id);
  end if;

  if promoted = '[]'::jsonb then
    raise exception 'STAGING_NOTHING_TO_PROMOTE' using errcode = 'P0001';
  end if;

  update staging_events
     set status      = 'promoted',
         promoted_to = promoted,
         reviewed_at = now()
   where id = p_event_id;

  insert into staging_event_log (event_id, from_status, to_status, action, detail, actor)
  values (p_event_id, ev.status, 'promoted', 'promote', jsonb_build_object('promoted_to', promoted), p_actor);

  return jsonb_build_object('id', p_event_id, 'status', 'promoted', 'promoted_to', promoted);
end $$;
