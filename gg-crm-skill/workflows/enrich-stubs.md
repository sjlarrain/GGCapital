# Workflow: enrich incomplete records

Goal: bring `stub` / `partial` records up to `complete` by filling missing fields — without
overwriting good data or inventing values.

## Steps

1. **Find incomplete records.** `crm_search` for the target set, or fetch a known id with
   `crm_get_company` / `crm_get_contact`. Read `data_status` and `missing_fields` — those
   tell you exactly what's absent.
2. **Gather only the missing fields.** Research/confirm values for the fields in
   `missing_fields`. Leave populated fields alone unless the user asks to correct them.
3. **Resolve any tags** against `tags_list` (see `reference/verification-rules.md`). Unmapped
   free text → don't set it; note it for review.
4. **Patch.** Call `crm_update_company` / `crm_update_contact` with the `id` and **only** the
   fields you're changing. Partial updates are expected — never resend the whole record.
5. **Verify.** Re-read the record; confirm `data_status` improved and `missing_fields`
   shrank. Report what you filled and what's still missing (and why, if a value was unmapped
   or unverifiable).

## Guardrails

- Don't fabricate emails, websites, or tags to clear `missing_fields`. A verifiable gap left
  open is better than a wrong value.
- If a required field can't be confirmed, leave the record as-is and tell the user.
