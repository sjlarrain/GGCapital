---
name: company-enrichment
description: >-
  Fill in a CRM company/fund's Description and Founded year by browsing its LinkedIn
  company page live (About/Overview panel), with general web search as a fallback. Use
  when the user asks to enrich, fill in, or look up a description or founding year for a
  specific company/fund already in the CRM. Runs interactively, one company at a time,
  with a live browser the user can watch and log into LinkedIn on if needed. Always shows
  the extracted values against the current CRM record for approval before writing.
---

# Company Enrichment (LinkedIn + web)

You fill in a company/fund's `description` and `founded_year` in the GG Capital CRM by
browsing the web live, primarily LinkedIn's company "About" page. You need a **browser
tool** (e.g. Claude Code / Cowork's browser) and the **MCP connector** (server name
`gg-capital-crm`, scope `crm:write`) in this session. If either is missing, tell the user
what's missing and stop.

## Why this is interactive, one company at a time

LinkedIn requires a logged-in session for full company page content, and automated
browsing against LinkedIn is against its Terms of Service — there is real account risk if
this runs unattended or at volume. This skill only ever works **one company at a time**,
with the user watching the browser pane, so:

- You never touch a login field, password, or CAPTCHA yourself. If LinkedIn shows a login
  wall, sign-in prompt, or bot-check, stop and ask the user to log in in the browser pane
  themselves, then tell you to continue.
- You never loop over a list of companies unattended. Finish one company (through the
  user's approval or decline) before starting the next.
- You never write to the CRM without the user explicitly approving that company's
  specific proposed values.

## Golden rules

1. **LinkedIn's About panel is the primary source.** It's usually the most precise for
   both the company overview and the founding year.
2. **Always propose the LinkedIn (or web-search) value, even if the CRM field already has
   one.** LinkedIn is treated as more authoritative than whatever's currently on file —
   but the user still approves before anything is overwritten (see below).
3. **Never write without approval.** Show the proposed `description` and `founded_year`
   next to the current CRM values and your source URL, and wait for an explicit yes
   before calling `crm_update_company`. If the user only approves one field, patch only
   that field.
4. **Cite your source.** Always tell the user which URL(s) the description/year came
   from.
5. **Never bypass a login wall or CAPTCHA.** Ask the user to handle it in the browser
   pane; you do not enter credentials or attempt workarounds.

## Tools

CRM (MCP, `gg-capital-crm`): `crm_search`, `crm_get_company`, `crm_update_company`.
Browser: whatever browsing tool this session exposes (navigate, read page text/structure,
screenshot). General web search when LinkedIn isn't usable.

## Where to go next

- Step-by-step flow → `workflows/enrich-company.md`
- How to read a LinkedIn company page and what to do when it's not usable →
  `reference/extraction.md`
- Exact `crm_update_company` field mapping and the confirm-before-write rule →
  `reference/write-back.md`
