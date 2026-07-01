# Workflow: bulk-populate from a list or CSV

Goal: turn a list of companies/contacts (a CSV, a spreadsheet paste, a pipeline) into clean
CRM records — creating what's confident, staging what isn't.

## Steps

1. **Load the tag catalogs once.** Call `tags_list` and keep the `{id, name}` arrays in
   memory. You'll resolve every tag against these.
2. **For each row:**
   1. **Search.** `crm_search` on the company name (and contact email if present).
      - Exact/confident company match → reuse its `id`.
      - Multiple weak matches or none → treat as new (or stage if unsure).
   2. **Resolve tags.** Map each free-text tag to a catalog name (see
      `reference/verification-rules.md`), then to its `id` from step 1.
      - Any tag that doesn't map → do **not** guess. Route the row to staging.
   3. **Check required fields** (`reference/schema.md`). Missing a required field → staging.
   4. **Create or stage:**
      - All required fields present, tags resolved, no dedupe ambiguity, high confidence →
        `crm_create_company` / then `crm_create_contact` (with the company's `id`).
      - Otherwise → `staging_ingest` with `source: "agent"`, a `source_ref` for idempotency
        (e.g. the row key), the raw row under `raw_payload`, your best-effort structured data
        under `proposed_links` (`{ company: {...}, contact: {...} }`) and `extracted`, plus an
        honest `confidence`.
3. **Classify staged rows.** Call `staging_classify` on each new event to get its status and
   `blocking_reasons`. Fix what you can (e.g. add a resolved tag id) and re-ingest, or leave
   it for human review.
4. **Report.** Summarize: created vs staged, and the top `blocking_reasons` so the user knows
   what needs attention. Do not `staging_promote` unless the user/admin asks (agents are
   gated).

## Idempotency

Always set `source_ref` on `staging_ingest` — re-running the same import won't create
duplicate staged events.
