-- Backfill investment_stage_ids for funds whose stages were previously
-- saved to stage_ids (the old form behaviour before the form fix).
-- Only copies where investment_stage_ids is empty but stage_ids has data.
update companies
set
  investment_stage_ids = stage_ids,
  stage_ids            = '{}'
where
  type_id in (select id from tag_types where name in ('VC', 'Fund'))
  and stage_ids  <> '{}'
  and investment_stage_ids = '{}';
