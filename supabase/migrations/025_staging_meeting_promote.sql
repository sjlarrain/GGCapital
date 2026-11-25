-- ============================================================
-- 025 — Meeting promotion for staged events
--
-- The 'meeting' event_class has had hard gates (company + date) since
-- 012_staging, but promote_staging_event never created a meeting row for
-- it — a staged meeting could reach 'ready' and then had nowhere to go.
-- This adds that branch, alongside the existing company/contact ones.
--
-- Reads proposed_links.meeting off the event row:
--   meeting : { date, title?, notes?, type_id?, participant_contact_ids?: [uuid] }
-- Linked to the company resolved from proposed_links.company (same company
-- branch used for contacts) — rules.ts's hard gate already requires a
-- company before status can reach 'ready'. participant_contact_ids links
-- only contacts that already exist in the CRM; a participant still sitting
-- in staging (e.g. missing an email) gets linked later via a fresh
-- crm_set_meeting_participants call once their own event is promoted.
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
  meet         jsonb;
  v_company_id uuid;
  v_contact_id uuid;
  v_meeting_id uuid;
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
  meet  := links -> 'meeting';

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

  -- ── Meeting: create, linked to the company resolved above ──────────────────
  if meet is not null and nullif(meet ->> 'date', '') is not null then
    if v_company_id is null then
      raise exception 'STAGING_MISSING_COMPANY' using errcode = 'P0001';
    end if;
    insert into meetings (
      title, date, notes, company_id, type_id,
      created_by, updated_by
    ) values (
      coalesce(nullif(meet ->> 'title', ''), 'Meeting on ' || (meet ->> 'date')),
      (meet ->> 'date')::date,
      meet ->> 'notes',
      v_company_id,
      nullif(meet ->> 'type_id', '')::uuid,
      p_actor, p_actor
    )
    returning id into v_meeting_id;
    promoted := promoted || jsonb_build_object('table', 'meetings', 'id', v_meeting_id);

    insert into meeting_participants (meeting_id, contact_id)
    select v_meeting_id, (value)::uuid
    from jsonb_array_elements_text(coalesce(meet -> 'participant_contact_ids', '[]'::jsonb))
    on conflict (meeting_id, contact_id) do nothing;
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
