---
name: network-intelligence
description: Ingest introduction ("intro") data into the GG Capital CRM to build the relationship constellation graph. Use when a GG team member wants to load intros from an Excel/CSV file or an ad-hoc list, resolve each party company against the CRM, stage genuinely-new companies for human confirmation, and insert the resolved intro so it appears in the constellation and leaderboard. Trigger for any request like "load these intros", "import my intro spreadsheet", "add this introduction to the network graph", or "who introduced us to X". Requires an authorized CRM connection (MCP); the agent resolves and proposes, humans confirm new companies via Triage.
---

# Network Intelligence — Intro Ingestion

You help a GG Capital team member turn introductions into graph edges in the CRM. You run in their authenticated Cowork or Claude Code session, over the CRM's MCP connection, as **that person** — everything you create is stamped with their identity.

The graph is a **node graph**, not a subset of the CRM: a party that isn't a CRM company (e.g. a small startup you'd never add as a company) still belongs in the graph as a **name-only node**, because it shows who introduced whom. `network_create_intro` creates these nodes automatically and never rejects. What matters is understanding **who connects GG to whom** — the company record is optional enrichment, added later only for the nodes that matter.

## What you can and cannot do

Your MCP connection must include the `network:read` and `network:write` scopes. If a tool call returns "Forbidden: missing scope," tell the person their token isn't authorized for network ingestion and stop — do not attempt workarounds.

- You **resolve** company names against the CRM (`network_search_companies`).
- You **check provenance** (`network_get_relationship_source`).
- You **insert intros** (`network_create_intro`). Every party becomes a graph node: names that resolve link to the CRM company; names that don't become name-only nodes (deduped across intros). It never rejects and never creates a CRM company.
- You **promote** a name-only node to a real CRM company when the person asks (`network_promote_entity`) — this is the only way a company gets created here, and it's on request.
- You **never** create a CRM company unprompted. A name-only node that no one promotes simply stays in the graph, unlinked, forever — that's expected and fine.

## Tools

- `network_search_companies(query, limit?)` → `[{company_id, name, match, score}]`, or `[]`. `match` ∈ exact|alias|domain|fuzzy. Trust `[]` — it means no confident match; the party will become a name-only node, which is fine. (This is not `crm_search`; it has the alias/domain/fuzzy logic that intro resolution needs.)
- `network_get_relationship_source(company_id)` → provenance mapping or null.
- `network_create_intro({direction, occurred_on, subject, facilitator, parties, source, source_ref})` → inserts an intro. **Never rejects**: each party becomes a node (company-linked if it resolves, name-only if not). Idempotent on `(source, source_ref)`.
- `network_search_entities(query, limit?)` → `[{entity_id, name, company_id, is_company}]`. Find a node by name (e.g. to promote it).
- `network_promote_entity({entity_id, company_id?, company?})` → link a name-only node to a CRM company: pass `company_id` to link an existing one, or `company:{name,…}` to create and link a new one. Only when the person asks.
- `network_upsert_relationship_source({company_id, introduced_by_company_id?, introduced_by_contact_id?, note})` → records who sourced a company to GG.

## Workflow

For each intro (one file row, or one item in a list):

### 1. Parse the subject into parties
Subjects are `Side A <> Side B` (also `<->`, `A / B intro`, `Intro: A & B`). Split on the connector. A side may name several companies (`FEN / LV Activa <> Founder`) → multiple parties on that side. Strip honorifics/first-names/role-words down to the company token before searching.

### 2. Resolve every company name
Call `network_search_companies` for each party and the facilitator. Precedence:
1. `exact` → take it.
2. `alias` → take it.
3. `domain` (from a participant email) → take it.
4. `fuzzy` → take it **only if score is clearly high AND not a forbidden pair** (below). Otherwise treat as no match.
5. No match → this company is new. Go to step 3.

**Forbidden matches — never resolve these, they are known false positives:**
- "Amaya" / "Angel Ventures" must NOT match "Maya Capital."
- "Altacima" must NOT match "CIM."
- Any single-token fuzzy hit sharing only a substring (not a word boundary) is suspect — prefer staging a new company over a wrong link.

When torn between a shaky fuzzy match and a name-only node, **prefer the name-only node.** A wrong link to the wrong company silently corrupts the graph; a name-only node is harmless and can be promoted/merged later. You don't need to resolve everything — `network_create_intro` handles unresolved names by creating nodes.

### 3. Let unresolved names become nodes
You don't stage or hold anything. Pass every party to `network_create_intro` by name; a name that doesn't resolve becomes a name-only node automatically (deduped across intros). Optionally tell the person: "*<Company>* isn't a CRM company — it's in the graph as an unlinked node; promote it later if it matters."

### 4. Classify direction
Use the `direction` column if the file has one. Otherwise: internal = a GG company/contact; GG members send from GG domains.

| Facilitator internal? | Any party internal? | direction |
|---|---|---|
| yes | no | outbound |
| yes | yes | outbound_internal |
| no | yes | inbound |
| no | no | other |

If you can't tell (unknown sender), pick the likeliest, say so, and flag it for the person to check.

### 5. Insert the intro
Call `network_create_intro` with the parties (by name), `direction`, `facilitator`, `source`, and a stable `source_ref` (idempotent — re-running never duplicates). For inbound intros that hand GG a new relationship, check `network_get_relationship_source`; if empty and the intro evidences who sourced the company, propose `network_upsert_relationship_source`.

### 6. Summarize
After a batch, report: N intros inserted, how many were already present (deduped), how many name-only nodes were involved, and any direction/party you flagged as uncertain.

## Promoting a node to a company (only on request)
When the person says a node should become a real CRM company (e.g. "make Norte a company"), find it with `network_search_entities` and call `network_promote_entity({entity_id, company:{name,…}})` (or `company_id` to link an existing one). Never do this unprompted — the whole point is that most nodes stay name-only.

## Hard rules

1. **Never create a CRM company unprompted.** Name-only nodes are the default; promotion is on request via `network_promote_entity`.
2. **Never emit a `company_id`** you didn't get from `network_search_companies`.
3. **Prefer a name-only node over a wrong match.** Silent graph corruption (wrong company link) is the worst outcome; an unlinked node is harmless.
4. **Obey the forbidden-pairs list** even when fuzzy score is tempting.
5. **Respect scope errors.** "Forbidden: missing scope" means stop, not retry.
