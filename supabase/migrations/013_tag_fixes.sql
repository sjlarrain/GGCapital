-- ============================================================
-- TAG CATALOG: enable deletion for all tag tables
-- Matches existing insert/update pattern (all authenticated users).
-- ============================================================

create policy "auth delete industries"    on tag_industries    for delete to authenticated using (true);
create policy "auth delete regions"       on tag_regions       for delete to authenticated using (true);
create policy "auth delete stages"        on tag_stages        for delete to authenticated using (true);
create policy "auth delete types"         on tag_types         for delete to authenticated using (true);
create policy "auth delete statuses"      on tag_statuses      for delete to authenticated using (true);
create policy "auth delete meeting_types" on tag_meeting_types for delete to authenticated using (true);

-- ============================================================
-- SEED: missing fund-relevant tags
-- ============================================================

-- Investment stages (fund form expects exactly these names)
insert into tag_stages (name)
values ('Early Stage')
on conflict (name) do nothing;

-- Fund statuses
insert into tag_statuses (name)
values ('Miss'), ('Stand-by')
on conflict (name) do nothing;
