# Track A — AI‑Native CRM Core (Priority)

> **Goal this track delivers:** use AI to populate and improve the GG Capital CRM. On completion, a person using Claude/Cowork (or any agent) can create, enrich, and clean CRM data through the MCP, guided by the Skill, with low‑confidence items routed to a staging area for review. **Gmail is NOT required for this goal** — Track B adds it as an automated input later.
>
> Stack: **Next.js (App Router) + Supabase (Postgres/Auth/RLS) on Vercel**. Internal‑team use only.

## Mental model (how the pieces relate)

| Piece | Role | Answers | Built in |
|---|---|---|---|
| **REST API** | The single authenticated surface over the CRM | "how does anything read/write data safely?" | A1 |
| **Schema + completeness** | What data is required vs optional, and a visible signal when a record is incomplete | "is this record complete? what's missing?" | A2 |
| **Documentation** | Endpoint + per‑field requirements | "what must I send to create X?" | A3 |
| **Staging** | Holding area for low‑confidence / incomplete events | "should this be reviewed before it's official?" | A4 |
| **MCP server** (the *hands*) | Exposes CRM actions as tools any agent can call | "what can the AI **do** to the data?" | A5 |
| **Skill** (the *playbook*) | Rules for required fields, verification, tag mapping, stage‑vs‑create | "how should the AI **do it well**?" | A6 |

MCP and Skill are complementary: the agent uses the **MCP tools** to act and the **Skill rules** to decide. The same rules also back server‑side validation (A4) so they're enforced no matter who calls.

Build order: **A1 → A2 → A3 → A4 → A5 → A6.** Each is independently shippable.

---

## A1 — REST API + user‑managed token auth

Users manage their own tokens and permissions from the app (your explicit requirement).

### Files
```
src/app/api/v1/_lib/auth.ts                 # bearer middleware: Supabase JWT | PAT → {userId, role, scopes}
src/app/api/v1/_lib/respond.ts
src/app/api/v1/_lib/validate.ts             # zod runner (.strict())
src/app/api/v1/companies/route.ts           # GET list/search, POST
src/app/api/v1/companies/[id]/route.ts      # GET, PATCH, DELETE
src/app/api/v1/contacts/route.ts
src/app/api/v1/contacts/[id]/route.ts
src/app/api/v1/meetings/route.ts
src/app/api/v1/meetings/[id]/route.ts
src/app/api/v1/interactions/route.ts
src/app/api/v1/tags/route.ts
src/app/api/v1/search/route.ts              # GET ?q= cross-entity dedupe
src/lib/auth/tokens.ts                      # mint / sha256-hash / verify PAT
src/lib/schemas/*.ts                        # zod per resource (required vs optional per A2)
src/app/(app)/settings/tokens/page.tsx      # USER token management UI
src/app/api/v1/openapi.json/route.ts        # OpenAPI 3.1 (feeds docs + MCP + ADK)
supabase/migrations/007_api_tokens.sql
```

### Migration `007_api_tokens.sql`
```sql
create table api_tokens (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,                 -- "Cowork – read/write", "Bulk import"
  token_hash   text not null unique,          -- sha256(raw); raw (prefix ggc_) shown ONCE
  scopes       text[] not null default '{}',  -- crm:read crm:write staging:read staging:write staging:promote
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index on api_tokens (user_id);
alter table api_tokens enable row level security;
create policy "owner reads tokens"   on api_tokens for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "owner writes tokens"  on api_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "owner revokes tokens" on api_tokens for update to authenticated using (user_id = auth.uid() or is_admin());
```

### Auth middleware
- Supabase JWT → verify, load `user_profiles.role`, scopes = role default set.
- PAT (`ggc_…`) → sha256 → lookup; reject revoked/expired; bump `last_used_at`; scopes from row.
- A user can only grant a token scopes ≤ their own role allows (a `user` cannot mint an admin‑delete token).

### Token management UI (`settings/tokens`)
- Create token: name, scopes (checkboxes), optional expiry → raw token shown once.
- List tokens: name, scopes, last used, expiry, **Revoke**.

### Acceptance
- [ ] User creates/revokes scoped tokens in‑app; raw shown once, stored hashed.
- [ ] Token scopes can't exceed the owner's role permissions.
- [ ] Audit fields set from token identity; client‑supplied audit fields rejected.
- [ ] Scope+role parity with current RLS (delete = admin only).
- [ ] `/api/v1/openapi.json` is valid OpenAPI 3.1.
- [ ] Jest: auth matrix (jwt/pat/expired/revoked/over‑scope), CRUD, dedupe search.

---

## A2 — Schema: mandatory vs optional + completeness signal

Creation requires only the minimum; everything else may be filled later. Every record exposes whether it's complete and what's missing.

### Field requirements (initial — confirm during build)
| Entity | Required at creation | Desired for "complete" (optional at creation) |
|---|---|---|
| **company** | `name` | website/domain, industry, region, stage, type, status, description |
| **contact** | `name`, `email`, `company_id` | phone, title/role, notes |
| **meeting** | `company_id`, `date` | participants, meeting_type, summary, follow_up |
| **interaction** | `contact_id` (or `company_id`), `date` | type, summary, follow_up |

> Confirm: **email mandatory for contact** (your spec). If sometimes unknown at creation, move it to "desired."

### Migration `008_completeness.sql`
```sql
create type data_status as enum ('stub','partial','complete');
-- stub = only required fields; partial = some desired present; complete = all desired present

alter table companies add column data_status data_status not null default 'stub';
alter table companies add column missing_fields text[] not null default '{}';
alter table contacts  add column data_status data_status not null default 'stub';
alter table contacts  add column missing_fields text[] not null default '{}';
-- (meetings/interactions optional — add if you want completeness tracking there too)

-- Recompute on write. Example for companies; mirror for contacts with its desired set.
create or replace function compute_company_completeness() returns trigger as $$
declare desired text[] := array['website','industry','region','stage','type','status','description'];
        missing text[] := '{}';
        f text;
begin
  foreach f in array desired loop
    if (to_jsonb(new) ->> f) is null or (to_jsonb(new) ->> f) = '' then
      missing := array_append(missing, f);
    end if;
  end loop;
  new.missing_fields := missing;
  new.data_status := case
    when array_length(missing,1) is null then 'complete'
    when array_length(missing,1) = array_length(desired,1) then 'stub'
    else 'partial' end;
  return new;
end $$ language plpgsql;

create trigger trg_company_completeness
  before insert or update on companies
  for each row execute function compute_company_completeness();
```
> Adjust the `desired` arrays to your actual column names. Build the matching `compute_contact_completeness()` from the contact table.

### UI
- Show a badge on company/contact rows + detail (e.g. `partial · missing: website, industry`).
- Filter lists by `data_status` so a human/agent can find stubs to enrich.

### Acceptance
- [ ] Creating a company with only `name` succeeds → `data_status='stub'`, `missing_fields` populated.
- [ ] Filling fields flips status toward `complete`; `missing_fields` shrinks.
- [ ] Badge + `data_status` filter visible in UI.
- [ ] `data_status` and `missing_fields` returned by the API and surfaced in OpenAPI.

---

## A3 — Documentation (endpoints + schema + field requirements)

### Deliverables
- `/docs/api` — rendered OpenAPI (Scalar/Redoc) from `openapi.json`.
- Per‑resource **field‑requirement tables** (required vs optional, types, allowed tag values), generated from the Zod schemas so docs never drift.
- Auth section: how to create/scope/revoke a token in `settings/tokens`; how to send `Authorization: Bearer ggc_…`.
- Completeness section: what `data_status`/`missing_fields` mean and how to query stubs.
- Example POST bodies: minimum‑valid (stub) and fully‑populated, for company and contact.

### Acceptance
- [ ] Each POST endpoint documents required vs optional fields and example minimal + full bodies.
- [ ] Tag‑valued fields list allowed catalog values.
- [ ] Docs render the live OpenAPI and stay in sync with Zod.

---

## A4 — Staging + review (low‑confidence / incomplete)

Anything an agent is unsure about, or that fails a hard rule, lands here for a **user** to review or an **agent** to research/complete before promotion.

### Migration `009_staging.sql`
```sql
create type staging_status as enum
  ('pending','classified','needs_info','ready','promoted','rejected');

create table staging_events (
  id               uuid primary key default uuid_generate_v4(),
  source           text not null,                 -- manual | agent | import | email(TrackB)
  source_ref       text,                          -- idempotency key
  raw_payload      jsonb not null,
  extracted        jsonb,
  proposed_links   jsonb,                         -- {company:{...|id}, contacts:[...], confidences}
  event_class      text,                          -- new_company|new_contact|meeting|interaction|update|unknown
  confidence       numeric check (confidence between 0 and 1),
  status           staging_status not null default 'pending',
  blocking_reasons text[] not null default '{}',  -- missing_company, ambiguous_contact, unmapped_tag, …
  assigned_to      uuid references auth.users(id),
  classified_by    uuid references auth.users(id),
  promoted_to      jsonb,                         -- [{table,id}]
  created_by       uuid not null references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  unique (source, source_ref)
);
create index on staging_events (status);
create index on staging_events (event_class);

create table staging_event_log (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references staging_events(id) on delete cascade,
  from_status staging_status, to_status staging_status,
  action text not null, detail jsonb, actor uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on staging_event_log (event_id);

alter table staging_events    enable row level security;
alter table staging_event_log enable row level security;
create policy "auth rw staging"     on staging_events    for all to authenticated using (true) with check (true);
create policy "auth rw staging log" on staging_event_log for all to authenticated using (true) with check (true);
```

### Files
```
src/app/api/v1/staging/events/route.ts                 # POST ingest, GET queue
src/app/api/v1/staging/events/[id]/classify/route.ts
src/app/api/v1/staging/events/[id]/promote/route.ts
src/app/api/v1/staging/events/[id]/reject/route.ts
src/lib/actions/staging.ts
src/lib/staging/rules.ts                               # hard gates + classifier (see A6)
src/lib/staging/promote.ts                             # transactional multi-table write (company+contact together)
src/lib/staging/mappings.ts                            # reuse import-script free-text→tag maps
src/app/(app)/triage/page.tsx
src/app/(app)/triage/[id]/TriageDetail.tsx
```

### Endpoint contracts
| Method · Path | Scope | Behaviour |
|---|---|---|
| `POST /staging/events` | `staging:write` | upsert on `(source,source_ref)`; `202 {id,status}` |
| `GET /staging/events` | `staging:read` | filter `status/event_class/min_confidence` |
| `POST …/classify` | `staging:write` | run `rules.ts` → `classified`/`needs_info`/`ready`; log |
| `POST …/promote` | `staging:promote` | block if status≠`ready` OR (auto‑promote flag off AND caller=agent); transactional create (e.g. company+contact); log |
| `POST …/reject` | `staging:write` | terminal; log |

### Acceptance
- [ ] Low‑confidence / failed‑gate items stay in staging, never in official tables.
- [ ] Promote is transactional (company+contact created together or not at all).
- [ ] Agent promote blocked while auto‑promote flag off → `409`.
- [ ] Every transition logged. Triage UI: filter, resolve `needs_info`, promote, reject.

---

## A5 — MCP server (the hands)

One MCP server wrapping `/api/v1/*`. Consumable by **Claude/Cowork now** (interactive population) and by **Track B's Gemini agent later** — same server.

### Files
```
src/app/api/mcp/route.ts          # streamable-HTTP MCP transport
src/lib/mcp/tools.ts              # tool defs derived from OpenAPI
src/app/api/oauth/**              # OAuth 2.1 + PKCE (only if a Claude/Cowork connector is used)
```

### Tools
`crm_search`, `crm_get_company|contact|meeting`, `crm_create_*`, `crm_update_*`, `tags_list`, `staging_ingest`, `staging_classify`, `staging_list`, `staging_promote`, `staging_reject`.

### Auth
- **Cowork/Claude connector** → OAuth 2.1 + PKCE (Supabase as identity source), per‑user.
- **Server‑to‑server agents** (incl. Track B) → PAT.
- Both validated by A1 middleware; scopes enforced identically.

### Acceptance
- [ ] Connects as a Cowork connector; per‑user identity resolved.
- [ ] Tool calls enforce the same scopes as REST.
- [ ] `crm_create_*` respects A2 required‑field rules; `staging_promote` respects the auto‑promote flag.

---

## A6 — Skill (the playbook) + verification rules

Single source of truth for *how* to populate well. Packaged as an Anthropic Skill (downloadable from the app for Claude/Cowork); the **same rules** seed `rules.ts` server gates and, later, Track B's Gemini agent instructions.

### Package
```
gg-crm-skill/
  SKILL.md                       # when-to-use + how to drive the MCP
  reference/schema.md            # entities, required vs optional, data_status meaning, tag catalogs
  reference/verification-rules.md# the rules below
  workflows/bulk-populate.md     # list → dedupe → map tags → create or stage
  workflows/enrich-stubs.md      # find data_status='stub' → research → complete
  templates/import.csv           # columns match schema exactly
```

### Verification & classification rules
- **Required‑field gates (hard):** contact needs name+email+company; company needs name; meeting needs company+date. Missing → stage as `needs_info`, never create.
- **Completeness:** create with whatever is known; record will be `stub`/`partial`; list `missing_fields` so it can be enriched later.
- **Dedupe before create:** `crm_search` on normalized name + email/domain; strong match → update/link; weak → `needs_info: ambiguous_*`.
- **Tag mapping:** map free text to catalog via `mappings.ts`; unknown → `needs_info: unmapped_tag` + nearest match (never invent tags; new tags need admin approval).
- **Confidence:** `<0.85` or any hard‑gate failure → staging. `≥0.85` + gates pass + class ∈ {interaction, update} → eligible for auto‑promote **only if the flag is on**.

### Acceptance
- [ ] Skill downloadable from the app; Claude/Cowork uses it + MCP to bulk‑populate and enrich.
- [ ] Rules in the Skill match the server gates in `rules.ts` (one source of truth).

---

## Sequencing & open items

**Migrations:** `007_api_tokens` → `008_completeness` → `009_staging` → seed (optional) `Triage Agent` service user + token.

**Open items**
- **OA‑1:** Confirm contact `email` is truly mandatory (else move to desired).
- **OA‑2:** Confirm each entity's "desired‑for‑complete" field list (drives `data_status`).
- **OA‑3:** Auto‑promote flag default (recommend: off; all human‑reviewed at launch).
- **OA‑4:** Whether Claude/Cowork is used interactively now (then build A5 OAuth) or only server‑to‑server agents (PAT only, defer OAuth).

**Definition of done for Track A:** a user can mint a scoped token, and via Cowork+MCP+Skill create/enrich CRM records with completeness tracking, low‑confidence items landing in Triage. Goal met — independently of Gmail.
