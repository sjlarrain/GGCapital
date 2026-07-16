# Writing back to the CRM

Only one tool call: `crm_update_company({ id, ...patch })`, scope `crm:write`. Send only
the fields the user approved — this tool patches, it doesn't replace the whole record.

| Field          | Type                          | Notes |
| -------------- | ------------------------------ | ----- |
| `description`  | markdown string                | Short paraphrased overview, a few sentences. |
| `founded_year` | integer, 1800–2100             | Plain year, e.g. `2019`. |

## Rules

- **Never call this without the user's explicit approval of that company's specific
  proposed values** (see `workflows/enrich-company.md` step 6–7). "Go ahead and enrich
  Acme" is authorization to *look up and propose*, not to write — always show the diff
  first.
- Send only the field(s) the user approved. If they approved the description but asked
  you to leave founded_year alone (e.g. they weren't sure it was right), omit
  `founded_year` from the patch entirely rather than sending `null`.
- If the call errors (e.g. `Not found` — company was deleted/archived since you fetched
  it), tell the user and stop; don't retry blindly.
- This is the only write this skill performs. It doesn't touch tags, contacts, meetings,
  or any other company field — if the user asks for something beyond description/founded
  year, that's outside this skill's scope.
