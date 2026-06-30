# Architecture Overview — Track A and B

## System diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GG CAPITAL CRM SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         TRACK A (PRIORITY)                           │   │
│  │              AI-Native CRM Core (standalone, shippable)              │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  ┌─ A1 ──────────────────────────────┐                             │   │
│  │  │ REST API + Token Auth              │                             │   │
│  │  │ (user-managed PAT)                 │                             │   │
│  │  │ [/api/v1/*]                        │                             │   │
│  │  │ ├─ companies, contacts, meetings   │                             │   │
│  │  │ ├─ staging/events                  │                             │   │
│  │  │ └─ tags, search (dedupe)           │                             │   │
│  │  └─────────────────────────────────────┘                             │   │
│  │         ↓                                                             │   │
│  │  ┌─ A2 ──────────────────────────────┐                             │   │
│  │  │ Schema + Completeness              │                             │   │
│  │  │ • data_status (stub/partial/...)   │                             │   │
│  │  │ • missing_fields list              │                             │   │
│  │  │ • required vs optional per entity  │                             │   │
│  │  └─────────────────────────────────────┘                             │   │
│  │         ↓                                                             │   │
│  │  ┌─ A3 ──────────────────────────────┐                             │   │
│  │  │ Documentation                      │                             │   │
│  │  │ • OpenAPI 3.1 (/docs/api)          │                             │   │
│  │  │ • Field requirement tables         │                             │   │
│  │  │ • Example bodies (stub/full)       │                             │   │
│  │  └─────────────────────────────────────┘                             │   │
│  │         ↓                                                             │   │
│  │  ┌─ A4 ──────────────────────────────┐                             │   │
│  │  │ Staging + Triage Review            │                             │   │
│  │  │ • staging_events table             │                             │   │
│  │  │ • status flow: pending→classified  │                             │   │
│  │  │    →ready→promoted                 │                             │   │
│  │  │ • Triage UI (web)                  │                             │   │
│  │  │ • Human/agent review before write  │                             │   │
│  │  └─────────────────────────────────────┘                             │   │
│  │         ↓                                                             │   │
│  │  ┌─ A5 ──────────────────────────────┐                             │   │
│  │  │ MCP Server (the hands)             │                             │   │
│  │  │ Tools: crm_search, crm_create_*,   │                             │   │
│  │  │ staging_ingest, staging_promote    │                             │   │
│  │  │ Auth: PAT or OAuth 2.1 + PKCE      │                             │   │
│  │  └─────────────────────────────────────┘                             │   │
│  │         ↓                                                             │   │
│  │  ┌─ A6 ──────────────────────────────┐                             │   │
│  │  │ Skill (the playbook)               │                             │   │
│  │  │ • Required field gates             │                             │   │
│  │  │ • Completeness rules               │                             │   │
│  │  │ • Dedupe logic                     │                             │   │
│  │  │ • Tag mapping                      │                             │   │
│  │  │ • Downloadable from app            │                             │   │
│  │  └─────────────────────────────────────┘                             │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────┐                             │   │
│  │  │ Input: Claude/Cowork (interactive) │                             │   │
│  │  │ Output: CRM data (official tables) │                             │   │
│  │  └────────────────────────────────────┘                             │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         ↓ (Triage UI accepts promotions)                                    │
│         │                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         TRACK B (OPTIONAL)                           │   │
│  │              Gmail Ingestion (requires A1–A6 complete)               │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Gmail ──poll──▶ GCP Cloud Scheduler                                │   │
│  │                         │                                            │   │
│  │                         ▼                                            │   │
│  │                 GCP Cloud Run                                        │   │
│  │              (ADK Gemini agent)                                      │   │
│  │           extract→dedupe→classify→stage                             │   │
│  │                         │                                            │   │
│  │                    (uses MCP from A5                                 │   │
│  │                   + rules from A6                                    │   │
│  │                   + PAT from A1)                                     │   │
│  │                         │                                            │   │
│  │                         ▼                                            │   │
│  │              Track A staging_events                                  │   │
│  │                    ↓ (Triage review)                                 │   │
│  │         Official tables + data_status                               │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Build order & dependencies

```
A1: REST API + Auth
 └─→ A2: Schema + Completeness
      └─→ A3: Documentation
           └─→ A4: Staging + Triage UI
                └─→ A5: MCP Server
                     └─→ A6: Skill
                          ✓ TRACK A DONE
                               │
                               ├──→ (Can use interactively now via Cowork)
                               │
                               └──→ B: Gmail Agent (builds on A1–A6)
```

## Key decision points

| Decision | Impact | A affected | B affected |
|----------|--------|-----------|-----------|
| Contact `email` mandatory? (OA-1) | Gates contact creation | A1, A2, A4, A6 | B (instructions) |
| "Desired" field list per entity? (OA-2) | Drives `data_status` computation | A2 | B (what to research) |
| Auto-promote flag default (off/on)? (OA-3) | Controls A4 staging gate | A4, A6 | B (agent behavior) |
| Use Cowork interactively now? (OA-4) | Do we build OAuth in A5? | A5 | None yet |
| Gmail access mode: delegation/per-user? (OB-1) | GCP service account setup | None | B (Gmail credentials) |

**Blocker:** Track B cannot start until Track A is complete (specifically A1, A4, A5, A6 must exist). Track A does not depend on B.

## Data flow example: intro email

```
1. Email arrives in Gmail
   From: alice@startup.com, Subject: "Intro to GG Capital"

2. Cloud Scheduler triggers poller
   └─→ Gemini agent reads email
       extract: {person: "Alice Chen", company: "TechCorp", role: "CEO"}

3. Agent calls crm_search (MCP) → no match (new company)
   └─→ Classify: event_class="new_company+new_contact", confidence=0.92

4. Agent calls staging_ingest (MCP)
   └─→ One staged event created:
       • source: "email", source_ref: "<gmail id>"
       • raw_payload: {full email}
       • extracted: {person, company, role}
       • proposed_links: {company: {name: "TechCorp", ...}, 
                          contacts: [{name: "Alice Chen", ...}]}
       • event_class: "new_company"
       • confidence: 0.92
       • status: "pending"

5. Agent calls staging_classify
   └─→ Runs A6 rules:
       • company name present ✓ (required)
       • contact name, email, company present ✓ (required)
       • data_status: "partial" (missing website, industry, etc.)
       • missing_fields: ["email", "website", "industry", "region"]
       • status: → "ready" (gates pass)

6. Triage UI shows pending event
   Human reviews:
   - raw payload (original email)
   - extracted fields (person/company/role)
   - proposed links + data_status
   - missing_fields list
   
7. Human clicks **Promote**
   └─→ staging_promote (MCP, gated by A4)
       • Create company: TechCorp (data_status="partial")
       • Create contact: Alice Chen (data_status="partial")
       • Both in official tables, missing_fields visible
       • Log: event_promoted_to [{table: companies, id: …}, {table: contacts, id: …}]

8. Done. Alice/TechCorp in the CRM, ready for enrichment later.
   Data is live, human was in the loop.
```

## Stacks & infrastructure

**Track A runs on:**
- Next.js App Router
- Supabase (Postgres + Auth + RLS)
- Vercel

**Track B adds:**
- Google Cloud (Scheduler, Cloud Run, Secret Manager, Firestore/GCS)
- Google ADK (Agent Development Kit)
- Gemini API or Vertex AI (the model)

No Cowork or Claude required for either track to work (though A5 offers the option to connect them).
