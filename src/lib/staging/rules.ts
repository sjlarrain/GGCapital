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

/** Below this, an event stays in staging for review (never auto-`ready`). */
export const CONFIDENCE_THRESHOLD = 0.85

export interface ClassifyInput {
  event_class?: EventClass | null
  confidence?: number | null
  extracted?: Record<string, unknown> | null
  proposed_links?: Record<string, unknown> | null
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

  // TODO(A6): dedupe (ambiguous_contact / ambiguous_company) and tag mapping
  // (unmapped_tag) gates once mappings.ts and crm_search are wired in.

  return reasons
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
