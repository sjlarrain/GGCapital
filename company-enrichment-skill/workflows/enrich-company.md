# Enriching one company

Run this whole flow for a single company before starting another.

## 1. Identify the company

If the user named a company, call `crm_search({ q: name })` to find it (avoids typos and
duplicates). If more than one match comes back, ask which one. Then
`crm_get_company({ id })` to get the full record: `name`, `website`, `description`,
`founded_year`, and anything else useful for disambiguation (e.g. `country`).

If the user gives you an id directly (e.g. from a CRM detail page URL), skip the search
and call `crm_get_company` straight away.

## 2. Find the LinkedIn company page

Prefer navigating straight to a guessed LinkedIn URL from the company name/website if
you're confident, otherwise web-search `"<company name>" site:linkedin.com/company` (or
just `<company name> LinkedIn`) and open the top matching result. Confirm it's the right
company (matching name/website/logo) before trusting anything on the page — LinkedIn has
many similarly-named pages.

Navigate to the company's **About** page (usually `.../about/` or the "About" tab/section
on the company page). This is where the Overview text and "Founded" field live — see
`reference/extraction.md` for exactly what to look for.

## 3. Handle a login wall

If LinkedIn shows a sign-in prompt, paywall, or bot-check instead of the About content:

- Stop. Tell the user: "LinkedIn needs you to log in to see this page — go ahead in the
  browser pane, then let me know when you're in."
- Do not enter anything into the login form yourself.
- Once the user confirms, re-check the page and continue.
- If the user says they'd rather not log in, fall back to web search (step 5) instead.

## 4. Extract

Read the About/Overview text and the "Founded" year if shown. Condense the Overview into
a short markdown description (a few sentences — what the company/fund does, not a full
reproduction of LinkedIn's text). See `reference/extraction.md` for what's safe to keep
verbatim vs. what to paraphrase.

## 5. Fallback: general web search

Use this when LinkedIn's About content isn't accessible (no login, page not found, or the
company doesn't have a LinkedIn page) or is missing the field you need (e.g. no Founded
year listed). Search the company's own "About us" page, Crunchbase, or similar, and
extract the same two fields. Note which source you actually used.

If you genuinely can't find a reliable founded year or description from either LinkedIn or
the web, say so and don't guess — leave that field as-is rather than proposing a fabricated
value.

## 6. Propose the update

Show the user, for this one company:

```
<Company name>  (current CRM record)
  description:   <current value, or "empty">
  founded_year:  <current value, or "empty">

Proposed (source: <URL>)
  description:   <new value>
  founded_year:  <new value>
```

If a proposed value is unavailable, omit that field from the proposal rather than writing
`null` over an existing value.

## 7. Write back on approval

Wait for an explicit yes. The user may approve both fields, one of them, or ask for edits
to the description text — accommodate that before writing. Then call
`crm_update_company({ id, description, founded_year })` with only the approved fields (see
`reference/write-back.md`).

Confirm the write succeeded and stop. Don't move on to another company unless the user
asks.
