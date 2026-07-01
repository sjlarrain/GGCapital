/**
 * A6 — free-text tag mapping + the dedupe / unmapped_tag classifier gates.
 */

import { mapTagName } from '@/lib/staging/mappings'
import { classifyEvent, hardGateReasons } from '@/lib/staging/rules'

describe('mapTagName', () => {
  it('resolves known aliases to canonical names', () => {
    expect(mapTagName('industry', 'fintech').canonical).toBe('Fintech')
    expect(mapTagName('industry', 'ecommerce').canonical).toBe('E-Commerce')
    expect(mapTagName('region', 'EEUU').canonical).toBe('United States')
    expect(mapTagName('stage', 'series a').canonical).toBe('Series A')
    expect(mapTagName('type', 'vc').canonical).toBe('VC')
  })

  it('is case/accent-insensitive and takes the first comma token', () => {
    expect(mapTagName('region', 'México').canonical).toBe('Mexico')
    expect(mapTagName('stage', 'Seed, Series A').canonical).toBe('Seed')
  })

  it('returns unresolved + a nearest hint for unknown values', () => {
    const m = mapTagName('industry', 'fintechh')
    expect(m.resolved).toBe(false)
    expect(m.canonical).toBeNull()
    expect(m.nearest).toBe('Fintech')
  })

  it('unknown with no near match → nothing', () => {
    expect(mapTagName('industry', 'zzz').resolved).toBe(false)
    expect(mapTagName('industry', 'zzz').nearest).toBeNull()
  })
})

describe('unmapped_tag gate', () => {
  it('free-text tag that does not map → unmapped_tag', () => {
    const reasons = hardGateReasons({
      event_class: 'new_company',
      proposed_links: { company: { name: 'Acme', industry: 'wobble' } },
    })
    expect(reasons).toContain('unmapped_tag')
  })

  it('free-text tag that maps cleanly → no unmapped_tag', () => {
    const reasons = hardGateReasons({
      event_class: 'new_company',
      proposed_links: { company: { name: 'Acme', industry: 'fintech' } },
    })
    expect(reasons).not.toContain('unmapped_tag')
  })

  it('resolved *_ids are ignored (not treated as free text)', () => {
    const reasons = hardGateReasons({
      event_class: 'new_company',
      proposed_links: { company: { name: 'Acme', industry_ids: ['00000000-0000-0000-0000-000000000001'] } },
    })
    expect(reasons).not.toContain('unmapped_tag')
  })
})

describe('dedupe gate', () => {
  const base = { event_class: 'new_company' as const, proposed_links: { company: { name: 'Acme' } } }

  it('strong match → duplicate_company (needs_info)', () => {
    const r = classifyEvent({ ...base, confidence: 0.99, dedupe: { company: { strongMatchId: 'c1', candidateCount: 1 } } })
    expect(r.blocking_reasons).toContain('duplicate_company')
    expect(r.status).toBe('needs_info')
  })

  it('several weak candidates → ambiguous_company', () => {
    const r = classifyEvent({ ...base, confidence: 0.99, dedupe: { company: { strongMatchId: null, candidateCount: 3 } } })
    expect(r.blocking_reasons).toContain('ambiguous_company')
    expect(r.status).toBe('needs_info')
  })

  it('no dedupe signal supplied → gate skipped (ready)', () => {
    const r = classifyEvent({ ...base, confidence: 0.99 })
    expect(r.blocking_reasons).toEqual([])
    expect(r.status).toBe('ready')
  })

  it('contact strong match → duplicate_contact', () => {
    const r = classifyEvent({
      event_class: 'new_contact',
      confidence: 0.99,
      proposed_links: { company: { name: 'Acme' }, contact: { name: 'Alice', email: 'a@b.com' } },
      dedupe: { contact: { strongMatchId: 'k1', candidateCount: 1 } },
    })
    expect(r.blocking_reasons).toContain('duplicate_contact')
  })
})
