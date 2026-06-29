/**
 * A4 staging tests — ingest/query schemas + hard-gate / confidence classifier.
 */

import { StagingIngestSchema, StagingListQuerySchema } from '@/lib/schemas/staging'
import { classifyEvent, hardGateReasons, CONFIDENCE_THRESHOLD } from '@/lib/staging/rules'

// ── Ingest schema ─────────────────────────────────────────────────────────────

describe('StagingIngestSchema', () => {
  it('requires source and raw_payload', () => {
    expect(StagingIngestSchema.safeParse({ source: 'agent', raw_payload: { a: 1 } }).success).toBe(true)
    expect(StagingIngestSchema.safeParse({ raw_payload: {} }).success).toBe(false)
    expect(StagingIngestSchema.safeParse({ source: 'agent' }).success).toBe(false)
  })

  it('rejects unknown source', () => {
    expect(StagingIngestSchema.safeParse({ source: 'sms', raw_payload: {} }).success).toBe(false)
  })

  it('rejects extra fields (strict)', () => {
    const r = StagingIngestSchema.safeParse({ source: 'agent', raw_payload: {}, created_by: 'x' })
    expect(r.success).toBe(false)
  })

  it('rejects confidence outside 0..1', () => {
    expect(StagingIngestSchema.safeParse({ source: 'agent', raw_payload: {}, confidence: 1.5 }).success).toBe(false)
    expect(StagingIngestSchema.safeParse({ source: 'agent', raw_payload: {}, confidence: 0.9 }).success).toBe(true)
  })

  it('accepts optional extracted / proposed_links / event_class', () => {
    const r = StagingIngestSchema.safeParse({
      source: 'manual',
      source_ref: 'abc-1',
      raw_payload: { text: 'hi' },
      extracted: { date: '2026-06-28' },
      proposed_links: { company: { name: 'Acme' } },
      event_class: 'new_company',
      confidence: 0.7,
    })
    expect(r.success).toBe(true)
  })
})

describe('StagingListQuerySchema', () => {
  it('defaults limit/offset', () => {
    const r = StagingListQuerySchema.parse({})
    expect(r.limit).toBe(50)
    expect(r.offset).toBe(0)
  })

  it('coerces min_confidence and rejects > 1', () => {
    expect(StagingListQuerySchema.parse({ min_confidence: '0.5' }).min_confidence).toBe(0.5)
    expect(StagingListQuerySchema.safeParse({ min_confidence: '2' }).success).toBe(false)
  })

  it('rejects invalid status', () => {
    expect(StagingListQuerySchema.safeParse({ status: 'bogus' }).success).toBe(false)
  })
})

// ── Hard gates ────────────────────────────────────────────────────────────────

describe('hardGateReasons', () => {
  it('new_contact missing email + company → reasons', () => {
    const reasons = hardGateReasons({
      event_class: 'new_contact',
      proposed_links: { contact: { name: 'Alice' } },
    })
    expect(reasons).toContain('missing_contact_email')
    expect(reasons).toContain('missing_company')
    expect(reasons).not.toContain('missing_contact_name')
  })

  it('new_contact fully specified → no reasons', () => {
    const reasons = hardGateReasons({
      event_class: 'new_contact',
      proposed_links: {
        company: { name: 'Acme' },
        contact: { name: 'Alice', email: 'a@b.com' },
      },
    })
    expect(reasons).toEqual([])
  })

  it('new_company needs a name', () => {
    expect(hardGateReasons({ event_class: 'new_company', proposed_links: { company: {} } }))
      .toContain('missing_company_name')
    expect(hardGateReasons({ event_class: 'new_company', proposed_links: { company: { id: 'x' } } }))
      .toEqual([])
  })

  it('meeting needs company + date', () => {
    const reasons = hardGateReasons({ event_class: 'meeting', proposed_links: { company: { name: 'Acme' } } })
    expect(reasons).toContain('missing_date')
    expect(reasons).not.toContain('missing_company')
  })
})

// ── Classifier ────────────────────────────────────────────────────────────────

describe('classifyEvent', () => {
  const goodContact = {
    event_class: 'new_contact' as const,
    proposed_links: { company: { name: 'Acme' }, contact: { name: 'Alice', email: 'a@b.com' } },
  }

  it('failed hard gate → needs_info, never ready', () => {
    const r = classifyEvent({ event_class: 'new_contact', confidence: 0.99, proposed_links: { contact: { name: 'Alice' } } })
    expect(r.status).toBe('needs_info')
    expect(r.blocking_reasons.length).toBeGreaterThan(0)
  })

  it('gates pass + low confidence → classified', () => {
    const r = classifyEvent({ ...goodContact, confidence: CONFIDENCE_THRESHOLD - 0.01 })
    expect(r.status).toBe('classified')
    expect(r.blocking_reasons).toEqual([])
  })

  it('gates pass + high confidence → ready', () => {
    const r = classifyEvent({ ...goodContact, confidence: CONFIDENCE_THRESHOLD })
    expect(r.status).toBe('ready')
  })

  it('missing confidence treated as 0 → classified (not ready)', () => {
    const r = classifyEvent(goodContact)
    expect(r.confidence).toBe(0)
    expect(r.status).toBe('classified')
  })

  it('infers class from proposed_links when none supplied', () => {
    const r = classifyEvent({ proposed_links: { company: { name: 'Acme' } }, confidence: 0.9 })
    expect(r.event_class).toBe('new_company')
    expect(r.status).toBe('ready')
  })
})
