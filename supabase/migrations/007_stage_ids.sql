-- Convert companies.stage_id (single) → stage_ids (array)
alter table companies add column stage_ids uuid[] not null default '{}';
update companies set stage_ids = array[stage_id] where stage_id is not null;
alter table companies drop column stage_id;
