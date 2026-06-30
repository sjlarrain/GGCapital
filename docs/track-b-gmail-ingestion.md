# Track B — Gmail Ingestion (built on Track A)

> **What this adds:** an automated input that feeds Track A's staging pipeline. A Gemini agent reads incoming Gmail, extracts a proposed contact/company/meeting, dedupes, and stages it for review. **Track B requires Track A** (API, staging, MCP, rules) — do not start it until Track A's A1–A6 exist.
>
> Outcome example: an intro email arrives → one staged event proposing a linked `new_company` + `new_contact` with `data_status` and `missing_fields` set → a user (or agent) promotes it from Triage.

## Dependency on Track A

Track B builds **nothing new** in the CRM data model. It reuses:
- `POST /staging/events`, `…/classify` (A4) as the write target.
- The CRM **MCP** (A5) — or OpenAPI tools — for `crm_search` (dedupe) and `staging_*`.
- The **verification/classification rules** (A6) as the agent's instructions.
- A **PAT** scoped `crm:read` + `staging:write` (A1). Deliberately **no** `staging:promote` — the email agent never writes official tables.

## Architecture

```
Gmail ──poll──▶ GCP poller (Cloud Scheduler + Cloud Run)
                      │ per new message
                      ▼
            Gemini agent (Google ADK)
            extract → dedupe(crm_search) → classify → stage
                      │ MCP/OpenAPI tools + PAT
                      ▼
            Track A staging  ──▶  Triage UI  ──promote──▶ companies + contacts + meetings
```

ADK supports MCP natively and deploys to Cloud Run / Vertex AI Agent Engine. **Google AI Studio** is used to prototype/tune the extraction prompt; the tuned prompt becomes the agent's instructions (it is not the runtime).

## Components
| GCP service | Role |
|---|---|
| Cloud Scheduler | cron trigger (e.g. every 5 min) |
| Cloud Run (or Vertex AI Agent Engine) | hosts ADK agent + poller |
| Secret Manager | Gmail credentials + CRM PAT |
| Firestore / GCS (small) | per‑mailbox `historyId` cursor |
| Gemini (Gemini API / Vertex AI) | model behind the agent |
| Pub/Sub (later) | swap polling for Gmail `watch()` push |

## Agent loop (per new message)
1. Poller: `users.history.list` since stored `historyId`; fetch new messages.
2. Invoke ADK agent with `{from,to,subject,date,body,threadId}`.
3. Agent: **extract** entities → **dedupe** via `crm_search` → **classify** (`event_class`+`confidence` per A6) → **stage** via `staging_ingest` then `staging_classify`, with `proposed_links` (company+contact) and `extracted` fields.
4. Advance `historyId` only after a successful batch (idempotent via `(source='email', source_ref=gmail id)`).

## Files
```
agent/
  adk/agent.py            # ADK LlmAgent(model=gemini-*, tools=[MCPToolset(...) | OpenAPI], instruction=…)
  adk/instructions.md     # ported from AI-Studio-tuned prompt; references A6 rules
  poller/gmail.py         # history.list + message fetch
  poller/main.py          # Cloud Run entrypoint; loop → agent
  poller/cursor.py        # Firestore/GCS historyId
  Dockerfile
  terraform/              # Scheduler + Run + service account + Secret Manager + IAM
  .env.example            # CRM_BASE_URL, CRM_PAT(secret), GMAIL_*(secret), GEMINI/VERTEX cfg
```

## Acceptance
- [ ] Idempotent: re‑running a window creates no duplicate staging events.
- [ ] Cursor advances only on success; mid‑batch crash safe to retry.
- [ ] Secrets only in Secret Manager; PAT scoped `crm:read`+`staging:write` (no promote).
- [ ] An intro email yields exactly one staged event proposing linked `new_company`+`new_contact`, with `missing_fields` reflecting unknown data.
- [ ] Nothing reaches official tables without a human promote in Triage.

## Open items
- **OB‑1 — Gmail access mode:** Workspace **domain‑wide delegation** (one service account reads team mailboxes; needs admin consent) vs **per‑user OAuth refresh tokens**. Delegation is simpler internally.
- **OB‑2 — Agent host:** Cloud Run (simple) vs Vertex AI Agent Engine (managed sessions/memory). Default: Cloud Run for v1.
- **OB‑3 — Interface:** consume Track A's MCP, or start on its OpenAPI tools and add MCP later. Default: MCP (reuse).
- **OB‑4 — Optional in‑Gmail review surface:** a Workspace Add‑on (documented ADK pattern) only if you later want review inside Gmail; otherwise Triage UI is the surface.

## Sequence
Track A complete → tune extraction prompt in AI Studio → build `agent/` → deploy Cloud Run + Scheduler with scoped PAT → watch Triage volume/accuracy → (later) enable Track A's auto‑promote flag for safe high‑confidence classes.
