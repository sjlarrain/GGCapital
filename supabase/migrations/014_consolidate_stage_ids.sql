-- Consolidate to a single stage field.
-- For any fund that had investment_stage_ids populated (from the import script)
-- but stage_ids empty, copy the data over so nothing is lost.
update companies
set stage_ids = investment_stage_ids
where
  type_id in (select id from tag_types where name in ('VC', 'Fund'))
  and stage_ids    = '{}'
  and investment_stage_ids <> '{}';
