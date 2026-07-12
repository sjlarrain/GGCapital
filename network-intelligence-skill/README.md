# Network Intelligence Skill

Load introductions into the GG Capital CRM to build the relationship constellation.

## What's in this folder
- `SKILL.md` — the playbook the agent follows (resolution rules, staging, insertion).
- `README.md` — this file.
- `reference/forbidden-pairs.md` — known false-positive company matches to never link.
- `reference/columns.md` — the Excel/CSV column format for bulk files.

## Install (Cowork)
1. In Claude Cowork, open Settings → Skills → Add Skill.
2. Upload this folder (or the `network-intelligence-skill.zip` you downloaded from the CRM's Settings → Tokens page).
3. Make sure the GG Capital CRM connector is added and signed in (Settings → Connectors), with a token that includes the `network:read`, `network:write`, and `staging:write` scopes.

## Use
Say something like: "Load the intros in this file" (attach the Excel), or "Add this intro: Norte <> Shinkansen, facilitated by Hernán, 2026-03-14."

The agent resolves each company, stages any it can't find (for you to confirm in Triage), and inserts the intros whose parties all exist. See `SKILL.md` for the full workflow and the two-pass pattern for bulk files.
