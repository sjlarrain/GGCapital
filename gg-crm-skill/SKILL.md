---
name: gg-crm
description: >-
  Populate and maintain the GG Capital CRM (companies, contacts, meetings) through
  its MCP connector. Use when the user asks to add, enrich, clean, de-duplicate, or
  bulk-import CRM records, or to triage staged events. Teaches the required fields,
  the controlled tag catalogs, and the confidence/dedupe rules so low-quality data
  lands in the review queue instead of the live CRM.
---

# GG Capital CRM

You drive the GG Capital CRM through the **MCP connector** (server name `gg-capital-crm`).
Your job is to populate it **well**: complete, de-duplicated, correctly tagged — and when
you are not sure, to stage the record for human review rather than guess.

## Golden rules

1. **Search before you create.** Always call `crm_search` first. Linking an existing record
   beats creating a near-duplicate.
2. **Only use catalog tags.** Tag fields (`industry_ids`, `region_ids`, `stage_ids`,
   `type_id`, `status_id`, meeting `type_id`) must reference ids returned by `tags_list`.
   Never invent a tag or pass a free-text label as an id. If a value isn't in the catalog,
   stage the event (see below) — do not force it.
3. **Respect required fields.** A create will be rejected if required fields are missing:
   - company → `name`
   - contact → `name`, `email`, `company_id`
   - meeting → `company_id`, `date` (YYYY-MM-DD), `title`
4. **When unsure, stage it.** If you can't confidently resolve a company/contact, a tag, or a
   required field, call `staging_ingest` instead of `crm_create_*`. Low-confidence or
   incomplete events belong in the review queue.
5. **You don't self-approve.** Promotion of a staged event into the live CRM is a human step
   unless an admin has enabled auto-promote.

## Tools

Reads: `crm_search`, `crm_get_company`, `crm_get_contact`, `crm_get_meeting`, `tags_list`.
Writes: `crm_create_company`, `crm_create_contact`, `crm_create_meeting`,
`crm_update_company`, `crm_update_contact`.
Staging/triage: `staging_ingest`, `staging_classify`, `staging_list`, `staging_promote`,
`staging_reject`.

## Where to go next

- Data model, required vs optional fields, tag catalogs → `reference/schema.md`
- The exact gates the server enforces (hard fields, 0.85 confidence, dedupe, tag mapping) →
  `reference/verification-rules.md`
- Bulk-populating from a list/CSV → `workflows/bulk-populate.md`
- Enriching incomplete (`stub`/`partial`) records → `workflows/enrich-stubs.md`
- CSV column template → `templates/import.csv`
