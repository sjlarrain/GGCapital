# Bulk file columns

Normalize your Excel/CSV to these headers before loading. Unknown columns are rejected.

| Column       | Required | Notes |
|--------------|----------|-------|
| subject      | yes      | The "A <> B" intro subject. Drives party parsing. |
| date         |          | YYYY-MM-DD → intros.occurred_on. |
| facilitator  |          | Name/email of who made the intro. GG member → internal. |
| side1        |          | Company name(s) on side 1; comma-separate multiples. |
| side2        |          | Company name(s) on side 2. |
| direction    |          | outbound / outbound_internal / inbound / other. Derived if blank. |
| source_ref   | yes      | Stable unique key per intro (e.g. Gmail thread id, or file:row). Prevents re-import duplication. |
| notes        |          | Free text. |

A ready-made template ships at `scripts/templates/intros-template.xlsx` in the repo.
