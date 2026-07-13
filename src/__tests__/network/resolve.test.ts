/**
 * Phase 2 — network entity resolution.
 *
 * Covers the load-bearing dedup correctness: the exact→alias→domain→fuzzy
 * precedence, the forbidden pairs (Amaya≠Maya, Altacima≠CIM), the word-boundary
 * guard that backs them, and the FEN/LV Activa multi-company subject split.
 */

import {
  resolveCompany,
  acceptFuzzy,
  isForbiddenPair,
  sharesWordBoundary,
  trigramSimilarity,
  splitSideCompanies,
  parseSubject,
  emailDomain,
  FUZZY_MIN_SCORE,
  type MatchTier,
} from '@/lib/network/resolve'
import {
  classifyRole,
  computeDegrees,
  computeWeightedDegrees,
  buildNodes,
  type ConstellationEdge,
  type LeaderboardRow,
} from '@/lib/network/roles'

// ── a minimal fake of the Supabase query builder ─────────────────────────────
interface Fixtures {
  companies: { id: string; name: string }[]
  aliases: { alias: string; company_id: string; name: string }[]
  domains: { domain: string; company_id: string; name: string }[]
}

function makeClient(fx: Fixtures) {
  return {
    from(table: string) {
      const state: { table: string; ilike?: string; eq: Record<string, unknown> } = { table, eq: {} }
      const builder = {
        select: () => builder,
        is: () => builder,
        limit: () => builder,
        ilike: (_col: string, pattern: string) => {
          state.ilike = pattern.replace(/%/g, '').toLowerCase()
          return builder
        },
        eq: (col: string, val: unknown) => {
          state.eq[col] = val
          return builder
        },
        then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
          Promise.resolve({ data: compute(fx, state), error: null }).then(resolve),
      }
      return builder
    },
  }
}

function compute(fx: Fixtures, state: { table: string; ilike?: string; eq: Record<string, unknown> }): unknown {
  if (state.table === 'companies') {
    const needle = state.ilike ?? ''
    return fx.companies.filter((c) => c.name.toLowerCase().includes(needle)).map((c) => ({ id: c.id, name: c.name }))
  }
  if (state.table === 'company_aliases') {
    return fx.aliases
      .filter((a) => a.alias === state.eq.alias)
      .map((a) => ({ company_id: a.company_id, companies: { name: a.name } }))
  }
  if (state.table === 'company_domains') {
    return fx.domains
      .filter((d) => d.domain === state.eq.domain)
      .map((d) => ({ company_id: d.company_id, companies: { name: d.name } }))
  }
  return []
}

const client = (fx: Fixtures) => makeClient(fx) as unknown as Parameters<typeof resolveCompany>[0]

const CRM: Fixtures = {
  companies: [
    { id: 'c-nv', name: 'Norte Ventures' },
    { id: 'c-maya', name: 'Maya Capital' },
    { id: 'c-cim', name: 'CIM' },
    { id: 'c-lv', name: 'LarrainVial' },
  ],
  aliases: [{ alias: 'lv activa', company_id: 'c-lv', name: 'LarrainVial' }],
  domains: [{ domain: 'norteventures.com', company_id: 'c-nv', name: 'Norte Ventures' }],
}

// ── pure guards ───────────────────────────────────────────────────────────────
describe('forbidden pairs + word-boundary guard', () => {
  it('Amaya must never resolve to Maya Capital', () => {
    expect(isForbiddenPair('Amaya', 'Maya Capital')).toBe(true)
    expect(acceptFuzzy('Amaya', 'Maya Capital', 0.9)).toBe(false)
  })

  it('Angel Ventures must never resolve to Maya Capital', () => {
    expect(isForbiddenPair('Angel Ventures', 'Maya Capital')).toBe(true)
    expect(acceptFuzzy('Angel Ventures', 'Maya Capital', 0.9)).toBe(false)
  })

  it('Altacima must never resolve to CIM', () => {
    expect(isForbiddenPair('Altacima', 'CIM')).toBe(true)
    expect(acceptFuzzy('Altacima', 'CIM', 0.9)).toBe(false)
  })

  it('rejects internal-substring coincidences (maya⊂amaya, cim⊂altacima) even off the explicit list', () => {
    expect(sharesWordBoundary('Amaya', 'Maya')).toBe(false)
    expect(sharesWordBoundary('Altacima', 'CIM')).toBe(false)
  })

  it('accepts a real word-boundary overlap (Larrain / LarrainVial, shared FEN token)', () => {
    expect(sharesWordBoundary('Larrain Vial', 'LarrainVial')).toBe(true)
    expect(sharesWordBoundary('FEN', 'FEN Ventures')).toBe(true)
  })
})

describe('trigramSimilarity + acceptFuzzy threshold', () => {
  it('scores identical strings 1 and disjoint strings low', () => {
    expect(trigramSimilarity('Norte Ventures', 'Norte Ventures')).toBe(1)
    expect(trigramSimilarity('Norte Ventures', 'Maya Capital')).toBeLessThan(FUZZY_MIN_SCORE)
  })

  it('a close typo clears the threshold and the guards', () => {
    const score = trigramSimilarity('Norte Ventur', 'Norte Ventures')
    expect(score).toBeGreaterThanOrEqual(FUZZY_MIN_SCORE)
    expect(acceptFuzzy('Norte Ventur', 'Norte Ventures', score)).toBe(true)
  })

  it('a weak fuzzy hit below threshold is not accepted', () => {
    expect(acceptFuzzy('Norte Ventures', 'Maya Capital', 0.1)).toBe(false)
  })
})

// ── subject parsing (FEN / LV Activa multi-company split) ─────────────────────
describe('subject parsing', () => {
  it('splits a side naming several companies', () => {
    expect(splitSideCompanies('FEN / LV Activa')).toEqual(['FEN', 'LV Activa'])
    expect(splitSideCompanies('Acme, Beta & Gamma')).toEqual(['Acme', 'Beta', 'Gamma'])
    expect(splitSideCompanies('Acme and Beta')).toEqual(['Acme', 'Beta'])
  })

  it('parses A <> B into two sides, splitting multi-company sides', () => {
    expect(parseSubject('FEN / LV Activa <> Founder')).toEqual({
      side1: ['FEN', 'LV Activa'],
      side2: ['Founder'],
    })
  })

  it('handles the <-> connector', () => {
    expect(parseSubject('Norte Ventures <-> Maya Capital')).toEqual({
      side1: ['Norte Ventures'],
      side2: ['Maya Capital'],
    })
  })

  it('returns null when there is no connector', () => {
    expect(parseSubject('just a subject with no connector')).toBeNull()
    expect(parseSubject('')).toBeNull()
  })
})

describe('emailDomain', () => {
  it('extracts a lowercased domain', () => {
    expect(emailDomain('gp@NorteVentures.com')).toBe('norteventures.com')
  })
  it('returns null without an @', () => {
    expect(emailDomain('not-an-email')).toBeNull()
    expect(emailDomain(null)).toBeNull()
  })
})

// ── resolveCompany: the four tiers over a fake CRM ────────────────────────────
describe('resolveCompany precedence', () => {
  it('tier 1 — exact normalized-name match', async () => {
    const r = await resolveCompany(client(CRM), { name: 'norte ventures' })
    expect(r).toMatchObject({ company_id: 'c-nv', match: 'exact' as MatchTier, score: 1 })
  })

  it('tier 2 — alias match (LV Activa → LarrainVial)', async () => {
    const r = await resolveCompany(client(CRM), { name: 'LV Activa' })
    expect(r).toMatchObject({ company_id: 'c-lv', match: 'alias' as MatchTier })
  })

  it('tier 3 — domain match from a participant email', async () => {
    const r = await resolveCompany(client(CRM), { name: 'unknown co', email: 'gp@norteventures.com' })
    expect(r).toMatchObject({ company_id: 'c-nv', match: 'domain' as MatchTier })
  })

  it('tier 4 — fuzzy accepts a close typo', async () => {
    const r = await resolveCompany(client(CRM), { name: 'Norte Ventur' })
    expect(r).toMatchObject({ company_id: 'c-nv', match: 'fuzzy' as MatchTier })
    expect(r!.score).toBeGreaterThanOrEqual(FUZZY_MIN_SCORE)
  })

  it('no match → null (genuinely new company; caller stages it)', async () => {
    const r = await resolveCompany(client(CRM), { name: 'Totally New Startup' })
    expect(r).toBeNull()
  })

  it('a forbidden/coincidental fuzzy candidate is rejected, not linked (Altacima ↛ CIM)', async () => {
    // A CRM where "CIM" is the only substring-graze for "Altacima": the fuzzy
    // guard must reject it and return null (→ the caller stages Altacima).
    const onlyCim: Fixtures = { companies: [{ id: 'c-cim', name: 'CIM' }], aliases: [], domains: [] }
    expect(await resolveCompany(client(onlyCim), { name: 'Altacima' })).toBeNull()
    // And the reverse direction likewise never links to Maya Capital.
    const onlyMaya: Fixtures = { companies: [{ id: 'c-maya', name: 'Maya Capital' }], aliases: [], domains: [] }
    expect(await resolveCompany(client(onlyMaya), { name: 'Amaya' })).toBeNull()
  })
})

// ── roles.ts ──────────────────────────────────────────────────────────────────
describe('classifyRole', () => {
  it('classifies by facilitate/receive combination', () => {
    expect(classifyRole({ intros_facilitated: 3, intros_received: 2 })).toBe('connector')
    expect(classifyRole({ intros_facilitated: 3, intros_received: 0 })).toBe('facilitator')
    expect(classifyRole({ intros_facilitated: 0, intros_received: 2 })).toBe('beneficiary')
    expect(classifyRole({ intros_facilitated: 0, intros_received: 0 })).toBe('peripheral')
  })
})

describe('degree computation', () => {
  const edges: ConstellationEdge[] = [
    { source_entity_id: 'a', target_entity_id: 'b', weight: 2 },
    { source_entity_id: 'a', target_entity_id: 'c', weight: 1 },
    { source_entity_id: 'b', target_entity_id: 'c', weight: 3 },
  ]

  it('counts distinct neighbors', () => {
    const d = computeDegrees(edges)
    expect(d.get('a')).toBe(2)
    expect(d.get('b')).toBe(2)
    expect(d.get('c')).toBe(2)
  })

  it('sums incident weight', () => {
    const w = computeWeightedDegrees(edges)
    expect(w.get('a')).toBe(3)
    expect(w.get('b')).toBe(5)
    expect(w.get('c')).toBe(4)
  })
})

describe('buildNodes', () => {
  const leaderboard: LeaderboardRow[] = [
    { entity_id: 'a', name: 'Alpha', company_id: 'a', is_company: true, intros_facilitated: 1, intros_received: 1 },
    { entity_id: 'b', name: 'Bravo', company_id: null, is_company: false, intros_facilitated: 5, intros_received: 0 },
    { entity_id: 'c', name: 'Charlie', company_id: 'c', is_company: true, intros_facilitated: 0, intros_received: 2 },
  ]
  const edges: ConstellationEdge[] = [
    { source_entity_id: 'a', target_entity_id: 'b', weight: 1 },
    { source_entity_id: 'a', target_entity_id: 'c', weight: 1 },
  ]

  it('enriches with role + degree and sorts by facilitated desc', () => {
    const nodes = buildNodes(leaderboard, edges)
    expect(nodes.map((n) => n.entity_id)).toEqual(['b', 'a', 'c'])
    expect(nodes.find((n) => n.entity_id === 'a')).toMatchObject({ role: 'connector', degree: 2, is_company: true })
    expect(nodes.find((n) => n.entity_id === 'b')).toMatchObject({ role: 'facilitator', degree: 1, is_company: false })
    expect(nodes.find((n) => n.entity_id === 'c')).toMatchObject({ role: 'beneficiary', degree: 1 })
  })
})
