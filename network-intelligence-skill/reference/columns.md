# Bulk file columns

Normalize your Excel/CSV to these headers before loading. Unknown columns are rejected.

| Column       | Required | Notes |
|--------------|----------|-------|
| subject      | yes      | The "A <> B" intro subject. Drives party parsing. |
| date         |          | YYYY-MM-DD → intros.occurred_on. |
| facilitator  |          | Name/email of who made the intro. GG member → internal. |
| side1        |          | Name(s) on side 1; comma-separate multiples. Any name works — it becomes a node whether or not it's a CRM company. |
| side2        |          | Name(s) on side 2. |
| direction    |          | outbound / outbound_internal / inbound / other. Defaults to `other` if blank. |
| source_ref   | yes      | Stable unique key per intro (e.g. Gmail thread id, or file:row). Prevents re-import duplication. |
| notes        |          | Free text. |

Names that don't resolve to a CRM company are **not** an error — they become name-only nodes in the
graph (deduped across intros), which you can promote to real companies later. A ready-made template
ships at `scripts/templates/intros-template.csv` in the repo.
