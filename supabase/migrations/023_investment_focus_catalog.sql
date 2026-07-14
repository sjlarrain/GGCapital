-- ============================================================
-- 023 — Investment Focus becomes a DB-backed tag catalog
-- Was a hardcoded checkbox list (free text) on ContactForm; now a real
-- tag_* catalog like industries/regions/stages, editable on /tags and
-- picked via TagPicker so new options show up everywhere immediately.
-- ============================================================

create table tag_investment_focus (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table tag_investment_focus enable row level security;

create policy "auth read investment_focus"   on tag_investment_focus for select to authenticated using (true);
create policy "auth write investment_focus"  on tag_investment_focus for insert to authenticated with check (true);
create policy "auth update investment_focus" on tag_investment_focus for update to authenticated using (true);
create policy "auth delete investment_focus" on tag_investment_focus for delete to authenticated using (true);

-- 'Startups' is dropped/renamed to 'Company' per feedback; 'Service Provider'
-- and 'Others' are new.
insert into tag_investment_focus (name) values
  ('Accelerator'),
  ('Builder'),
  ('Funds'),
  ('PE'),
  ('Company'),
  ('Service Provider'),
  ('Others');

-- ── contacts: replace free-text investment_focus with tag ids ──────────────

alter table contacts add column investment_focus_ids uuid[] not null default '{}';

-- Backfill from the old free-text values where a name matches a catalog tag.
update contacts c
set investment_focus_ids = coalesce((
  select array_agg(t.id)
  from unnest(c.investment_focus) as v
  join tag_investment_focus t
    on t.name = case v when 'Startups' then 'Company' else v end
), '{}')
where cardinality(c.investment_focus) > 0;

alter table contacts drop column investment_focus;

-- ── staging promotion: resolve free-text investment_focus names to ids ─────
-- (proposed_links JSON keeps sending plain names; only the write target and
-- resolution logic change — same pattern as the other four inserted columns
-- would use if they weren't already pre-resolved to ids upstream.)

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
      company_id, industry_ids, region_ids, investment_focus_ids, stage_ids,
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
      coalesce((
        select array_agg(t.id)
        from jsonb_array_elements_text(cont -> 'investment_focus') as v
        join tag_investment_focus t on t.name = v
      ), '{}'),
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
