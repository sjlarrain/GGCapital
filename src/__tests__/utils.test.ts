import { levenshtein, findNearMatches, formatDate } from '../lib/utils'

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('fintech', 'fintech')).toBe(0)
  })

  it('detects single character change', () => {
    expect(levenshtein('Fintech', 'fintech')).toBe(1)
  })

  it('detects transposition', () => {
    expect(levenshtein('FinTech', 'Fintech')).toBe(1)
  })
})

describe('findNearMatches', () => {
  const catalog = ['Fintech', 'Healthcare', 'Technology', 'SaaS', 'Energy']

  it('finds near-match with one missing character (Fintch vs Fintech)', () => {
    const matches = findNearMatches('Fintch', catalog)
    expect(matches).toContain('Fintech')
  })

  it('finds near-match with one extra character (Fintechs vs Fintech)', () => {
    const matches = findNearMatches('Fintechs', catalog)
    expect(matches).toContain('Fintech')
  })

  it('does not return case-insensitive exact match (FinTech = Fintech after lowercase)', () => {
    // 'FinTech'.toLowerCase() === 'Fintech'.toLowerCase() → distance 0 → excluded
    const matches = findNearMatches('FinTech', catalog)
    expect(matches).not.toContain('Fintech')
  })

  it('does not return exact match', () => {
    const matches = findNearMatches('Fintech', catalog)
    expect(matches).not.toContain('Fintech')
  })

  it('returns empty array for no near-matches', () => {
    const matches = findNearMatches('Blockchain', catalog)
    expect(matches).toHaveLength(0)
  })

  it('returns empty for short input', () => {
    const matches = findNearMatches('a', catalog)
    expect(matches).toHaveLength(0)
  })
})

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2024-01-15T00:00:00Z')
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/2024/)
  })
})
