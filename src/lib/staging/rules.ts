/**
 * Staging hard gates + classification.
 *
 * This is the *server-side* enforcement of the same rules the A6 Skill teaches
 * the agent. The advanced pieces (dedupe against existing records, tag mapping
 * ambiguity) are stubbed and marked TODO(A6); the hard gates and the confidence
 * threshold are enforced now so failed-gate / low-confidence events never reach
 * `ready` and therefore can never be promoted.
 *
 * One source of truth: keep these gates in sync with
 * `gg-crm-skill/reference/verification-rules.md` (A6).
 */

import type { EventClass, StagingStatus } from '@/lib/schemas/staging'
import { mapTagName, FREE_TEXT_TAG_FIELDS, splitComma } from '@/lib/staging/mappings'

/** Below this, an event stays in staging for review (never auto-`ready`). */
export const CONFIDENCE_THRESHOLD = 0.85

/**
 * Result of searching existing records for a would-be new company/contact.
 * Computed with DB access (see `dedupe.ts`) and injected so `classifyEvent`
 * stays pure/testable.
 */
export interface DedupeSignal {
  /** id of a confident single match → link instead of creating a duplicate. */
  strongMatchId?: string | null
  /** How many existing records plausibly match (for ambiguity). */
  candidateCount?: number
}

export interface DedupeInput {
  company?: DedupeSignal
  contact?: DedupeSignal
}

export interface ClassifyInput {
  event_class?: EventClass | null
  confidence?: number | null
  extracted?: Record<string, unknown> | null
  proposed_links?: Record<string, unknown> | null
  /** Optional dedupe signals; when absent, dedupe gates are skipped. */
  dedupe?: DedupeInput | null
}

export interface ClassifyResult {
  event_class: EventClass
  confidence: number
  blocking_reasons: string[]
  status: Extract<StagingStatus, 'classified' | 'needs_info' | 'ready'>
}

type Obj = Record<string, unknown>

function asObj(v: unknown): Obj | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null
}

function present(o: Obj | null, key: string): boolean {
  if (!o) return false
  const v = o[key]
  return v !== null && v !== undefined && v !== ''
}

/** company is satisfied if we either link an existing id or have a name to create. */
function hasCompany(company: Obj | null): boolean {
  return present(company, 'id') || present(company, 'name')
}

/**
 * Hard required-field gates (A6). Missing required fields → the event must go to
 * `needs_info` and can never be promoted.
 *   - company  needs: name (or existing id)
 *   - contact  needs: name + email + company
 *   - meeting  needs: company + date
 */
export function hardGateReasons(input: ClassifyInput): string[] {
  const links = asObj(input.proposed_links) ?? {}
  const extracted = asObj(input.extracted) ?? {}
  const company = asObj(links.company)
  const contact = asObj(links.contact)
  const reasons: string[] = []

  const cls = input.event_class ?? inferClass(input)

  if (cls === 'new_company') {
    if (!hasCompany(company)) reasons.push('missing_company_name')
  }

  if (cls === 'new_contact') {
    if (!present(contact, 'name')) reasons.push('missing_contact_name')
    if (!present(contact, 'email')) reasons.push('missing_contact_email')
    if (!hasCompany(company) && !present(contact, 'company_id')) reasons.push('missing_company')
  }

  if (cls === 'meeting') {
    if (!hasCompany(company)) reasons.push('missing_company')
    if (!present(extracted, 'date') && !present(asObj(links.meeting), 'date')) reasons.push('missing_date')
  }

  // ── Dedupe gate (A6): only when dedupe signals were supplied ────────────────
  // A confident existing match must be linked (not duplicated); several weak
  // candidates are ambiguous and need a human/agent to pick.
  const dedupe = input.dedupe ?? undefined
  if (cls === 'new_company' && dedupe?.company) {
    if (dedupe.company.strongMatchId) reasons.push('duplicate_company')
    else if ((dedupe.company.candidateCount ?? 0) > 1) reasons.push('ambiguous_company')
  }
  if (cls === 'new_contact' && dedupe?.contact) {
    if (dedupe.contact.strongMatchId) reasons.push('duplicate_contact')
    else if ((dedupe.contact.candidateCount ?? 0) > 1) reasons.push('ambiguous_contact')
  }

  // ── Tag-mapping gate (A6): free-text tags must map to a known catalog ───────
  if (unmappedTags(extracted, company, contact)) reasons.push('unmapped_tag')

  return reasons
}

/**
 * True if any free-text tag field (on `extracted`, or on the proposed company /
 * contact) carries a value that doesn't map to a known catalog name. Resolved
 * tag *ids* (`*_ids`) are ignored here — this only guards free text.
 */
function unmappedTags(...sources: (Obj | null)[]): boolean {
  for (const src of sources) {
    if (!src) continue
    for (const [field, catalog] of Object.entries(FREE_TEXT_TAG_FIELDS)) {
      const raw = src[field]
      if (raw === null || raw === undefined || raw === '') continue
      const values = Array.isArray(raw)
        ? raw.map((v) => String(v))
        : splitComma(String(raw))
      for (const v of values) {
        if (!mapTagName(catalog, v).resolved) return true
      }
    }
  }
  return false
}

/** Best-effort class inference from the proposed links when none was supplied. */
export function inferClass(input: ClassifyInput): EventClass {
  if (input.event_class) return input.event_class
  const links = asObj(input.proposed_links)
  if (links) {
    if (asObj(links.meeting)) return 'meeting'
    if (asObj(links.contact)) return 'new_contact'
    if (asObj(links.company)) return 'new_company'
  }
  return 'unknown'
}

/**
 * Classify a staged event into its next status:
 *   - any hard-gate failure        → needs_info (with blocking_reasons)
 *   - gates pass, confidence < 0.85 → classified (awaiting review)
 *   - gates pass, confidence ≥ 0.85 → ready (eligible for promotion)
 */
export function classifyEvent(input: ClassifyInput): ClassifyResult {
  const event_class = inferClass(input)
  const confidence = input.confidence ?? 0
  const blocking_reasons = hardGateReasons(input)

  if (blocking_reasons.length > 0) {
    return { event_class, confidence, blocking_reasons, status: 'needs_info' }
  }
  if (confidence < CONFIDENCE_THRESHOLD) {
    return { event_class, confidence, blocking_reasons: [], status: 'classified' }
  }
  return { event_class, confidence, blocking_reasons: [], status: 'ready' }
}
