# GG Capital CRM — AI Connector (MCP) Guide

*Track A · A5 (MCP server) + A6 (Skill). Last updated 2026-06-30.*

This guide is for **humans**: what we built, how to turn it on, how to connect an AI
assistant to the CRM, the recommended way to work with it, and concrete use cases. If you
just want the agent-facing rules, read `gg-crm-skill/SKILL.md` instead.

---

## 1. What this is (in one paragraph)

We exposed the GG Capital CRM as an **MCP server** — a standard interface an AI assistant
(Claude, Cowork, etc.) can call. Instead of you copy-pasting company data into forms, you
tell the assistant "add these 20 companies from this list" and it does it *through the same
rules the app enforces*: required fields, controlled tags, and a review queue for anything it
isn't sure about. A teammate connects once in their browser (no API key to copy), and from
then on the assistant can read and populate the CRM **as that person**.

Two halves:

- **The hands (A5):** the MCP server + the OAuth "Connect" login. This is the plumbing.
- **The playbook (A6):** a downloadable **Skill** that teaches the assistant *how* to populate
  well (when to create vs. when to send to review, how to map tags, how to avoid duplicates).

---

## 2. Architecture at a glance

```
   You (browser)                AI client (Claude/Cowork)            GG Capital app
        │                               │                                 │
        │  1. add connector ────────────┤  GET /.well-known/…             │
        │                               ├────────────────────────────────▶│  discovery
        │  2. sign in + approve ◀───────┤  OAuth 2.1 + PKCE               │
        │      (Supabase login)         │  (register → authorize → token) │
        │                               │                                 │
        │                               │  3. call tools ─────────────────▶│  /api/mcp
        │                               │     (Bearer ggo_… token)        │  15 tools
        │                               │                                 │
        │                               │        low-confidence ──────────▶│  Triage queue
        │  4. review in /triage ◀───────┼─────────────────────────────────┤
```

- **MCP endpoint:** `https://<your-app>/api/mcp`
- **Auth:** OAuth 2.1 + PKCE with Dynamic Client Registration — the client self-registers,
  the user logs in via the existing Supabase login, approves a consent screen, and the client
  receives a token it refreshes silently.
- **Identity model:** an OAuth token is minted *for a specific person*. Everything the agent
  creates is stamped with that user as `created_by` / `updated_by`.
- **Same rules as the app:** the tools reuse the exact schemas, scope checks, and staging
  gates the REST API uses — there is no "backdoor" that skips validation.

### Token types (who is who)

| Token    | Prefix   | Who       | Can promote from Triage?                        |
| -------- | -------- | --------- | ----------------------------------------------- |
| Supabase JWT | —    | Human (web app) | Yes (with `staging:promote` scope)        |
| OAuth    | `ggo_`   | **Human** via a connected AI client | Yes (admin role)      |
| PAT      | `ggc_`   | **Agent** / server-to-server        | No, while auto-promote is off |

> Design choice: an OAuth token is issued *after a human signs in*, so the agent acting on it
> is treated as that human. A PAT is a headless key, so it's treated as a non-interactive
> agent and is blocked from promoting until an admin explicitly enables auto-promote.

---

## 3. Turning it on (one-time, admin)

1. **Apply the migration.** In the Supabase SQL editor, run
   `supabase/migrations/014_oauth.sql`. It creates `oauth_clients`, `oauth_auth_codes`, and
   `oauth_access_tokens` (DDL can't go through the REST API, so this is manual — same as prior
   migrations). Verify with a quick REST `GET ...?limit=1` on each table.
2. **Deploy** the app (the routes ship with it; nothing else to configure).
3. **Leave auto-promote OFF** for launch. Agents can *stage* data but a human approves each
   promotion in `/triage`. When you trust it, set the env var `STAGING_AUTO_PROMOTE=true` to
   let PAT agents promote automatically. (OAuth/human users can already promote.)

That's it — no secrets to generate, no client IDs to hand out. Clients register themselves.

---

## 4. Connecting an AI client (each user)

1. Open **Settings → Tokens** in the app. You'll see the **"Connect an AI agent"** section
   with your MCP URL and a **Download the CRM Skill** button.
2. In your AI client (e.g., Claude/Cowork → *Add connector / Add MCP server*), paste:
   ```
   https://<your-app>/api/mcp
   ```
3. The client opens a browser window. **Sign in with your GG Capital account** and click
   **Approve** on the consent screen ("… wants to access your CRM as you"). No key to copy.
4. **Install the Skill:** download `gg-crm-skill.zip` from the same page and add it to your
   client as a Skill. This is what makes the agent *good* at data entry rather than just
   *able* to call the tools.

You're connected. The token refreshes itself; you won't log in again unless you disconnect or
it's revoked.

---

## 5. The tools (what the agent can do)

Fifteen tools, grouped by the scope they require. Scopes come from your role:
**admin** = everything; **user** = everything except `staging:promote`.

**Read (`crm:read`)**
- `crm_search` — search companies + contacts by name/email. *Always used before creating.*
- `crm_get_company` / `crm_get_contact` / `crm_get_meeting` — fetch one record by id.
- `tags_list` — the controlled tag catalogs (industries, regions, stages, types, statuses,
  meeting types). Tags **must** come from here.

**Write (`crm:write`)**
- `crm_create_company` / `crm_create_contact` / `crm_create_meeting`
- `crm_update_company` / `crm_update_contact` — partial updates (send only changed fields).

**Staging / Triage**
- `staging_ingest` (`staging:write`) — send an uncertain/incomplete observation to the review
  queue instead of writing it live.
- `staging_classify` (`staging:write`) — run the gates on a staged event → `classified` /
  `needs_info` / `ready`.
- `staging_list` (`staging:read`) — browse the queue.
- `staging_reject` (`staging:write`) — terminally reject an event.

There is no `staging_promote` MCP tool. Promotion of a `ready` event into the live CRM
(transactional: company + contact created together or not at all) only happens when a human
clicks Promote in `/triage` — Alpha policy, agents never self-approve.

### The gates every write goes through

These are enforced server-side *and* documented in the Skill, so the agent and the app agree:

- **Required fields:** company→`name`; contact→`name`+`email`+`company_id`;
  meeting→`company_id`+`date`+`title`. Missing → the record is blocked / sent to review.
- **Confidence ≥ 0.85** to be auto-`ready`; below that it waits for review.
- **Dedupe:** a confident existing match must be *linked*, not duplicated
  (`duplicate_company/contact`); several weak matches are `ambiguous_*` and need a human pick.
- **Tags:** free-text tag values must map to a catalog entry, else `unmapped_tag`. The agent
  never invents a tag.

---

## 6. Recommended workflow

The intended loop keeps humans in control while offloading the typing:

```
  Agent:  search → resolve tags → check required fields
            │
            ├─ confident + complete + no dup ──▶ create live record
            │
            └─ uncertain / incomplete / dup ───▶ staging_ingest  (Triage queue)
                                                    │
  Human:                                            ▼
        /triage → review, fix, approve (promote) or reject
```

**Principles**
1. **Search before create** — every time. Linking beats duplicating.
2. **Stage when unsure** — a record in Triage is a feature, not a failure. It's how the agent
   avoids polluting the CRM with guesses.
3. **Humans promote** — at least until you've watched it work and choose to enable
   auto-promote for agents.
4. **Tags are a closed set** — if a value isn't in `tags_list`, it goes to review; nobody
   invents tags.
5. **Enrich, don't overwrite** — for existing records the agent fills `missing_fields` and
   leaves good data alone.

---

## 7. Use cases (things to try)

Start here when you "play with it":

1. **Bulk import from a list.** Paste a CSV or a table of companies (see
   `gg-crm-skill/templates/import.csv` for the columns): *"Add these to the CRM; stage
   anything you're unsure about."* Expect: known companies created, messy/ambiguous rows in
   Triage with clear reasons.
2. **Enrich stubs.** *"Find companies marked `stub` and fill in what's missing — website,
   country, stage — but don't invent anything."* Expect: partial records moved toward
   `complete`, gaps it couldn't verify reported back.
3. **De-dup a messy add.** Deliberately add a company that already exists under a slightly
   different name. Expect: the agent finds it via `crm_search` and links/flags instead of
   creating a duplicate.
4. **Meeting capture.** *"Log a meeting with <company> on 2026-07-02, type Pitch, notes: …"*
   Expect: a meeting created (or `missing_date`/`missing_company` if you leave one out).
5. **Tag mapping.** Feed a free-text industry like "e-commerce" or "EEUU" region. Expect:
   mapped to `E-Commerce` / `United States`; feed a nonsense tag and expect `unmapped_tag` →
   Triage.
6. **Triage review.** After a bulk run, open `/triage`, read the `blocking_reasons`, fix or
   reject, and approve the good ones. This is the human half of the loop.

---

## 8. Troubleshooting

- **Client can't connect / discovery fails.** Confirm `https://<app>/.well-known/oauth-protected-resource`
  and `…/oauth-authorization-server` load in a browser (they're public JSON). If they redirect
  to `/login`, the proxy isn't letting `.well-known` through (it should — see `src/proxy.ts`).
- **"401 / Unauthorized" on every tool.** The token is missing/expired and refresh failed —
  disconnect and reconnect the connector to re-run the login.
- **A create "fails" with a validation error.** That's a gate doing its job (missing required
  field, or an unmapped tag). Check the message; add the field or a catalog tag.
- **Agent can't promote (`409` / "requires human review").** Expected: PAT agents are blocked
  while `STAGING_AUTO_PROMOTE` is off. Promote from `/triage` as a human, or enable the flag.
- **A tag "doesn't exist".** It's not in the catalog. Add it in **Tags**, or let the item sit
  in Triage until someone does.

---

## 9. Reference

- **MCP endpoint:** `/api/mcp`
- **OAuth discovery:** `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`
- **OAuth endpoints:** `/api/oauth/register` (DCR), `/api/oauth/authorize`, `/api/oauth/token`
- **REST API (same operations, for scripts):** `/api/v1/*` — spec at `/api/v1/openapi.json`,
  human docs at `/docs/api`
- **The Skill (agent playbook):** `gg-crm-skill/` in the repo; downloadable zip at
  Settings → Tokens (`/gg-crm-skill.zip`)
- **Server-side rules:** `src/lib/staging/rules.ts` (gates), `src/lib/staging/mappings.ts`
  (tag aliases), `src/lib/staging/dedupe.ts` (duplicate search)
- **Migration:** `supabase/migrations/014_oauth.sql`
- **Auto-promote flag:** env `STAGING_AUTO_PROMOTE` (default off)

---

## 10. After you've played with it (your checklist)

1. Confirm the recommended workflow feels right in practice, and whether any tool or Skill
   section is missing or confusing.
2. Decide if any **new tool or Skill workflow** is needed (e.g., interactions/notes, bulk
   update, export). If not, this is done.
3. **Announce to the team:** point them at Settings → Tokens (connect + Skill download) and
   this guide. One-liner: *"You can now connect Claude/Cowork to the CRM — sign in once, and it
   populates records for you with a review queue for anything uncertain."*
