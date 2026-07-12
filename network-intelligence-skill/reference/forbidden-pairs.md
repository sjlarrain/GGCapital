# Forbidden matches (never link these)

These are known false positives. The agent must NEVER resolve the left to the right,
regardless of fuzzy similarity score. Prefer staging a new company over any of these.

- "Amaya" / "Angel Ventures"  →  NEVER "Maya Capital"   (different firm)
- "Altacima"                   →  NEVER "CIM"            (substring coincidence)

General rule: a fuzzy match that shares only a substring (not a whole-word boundary)
is suspect. When in doubt, stage the company for Triage instead of linking.

To add a new forbidden pair: append here AND to the SKILL.md "Forbidden matches" list,
then re-zip and re-upload the Skill. Keep this file and SKILL.md in sync with the
hard negatives in `src/lib/network/resolve.ts` on the server.
