/**
 * Network entity resolution (Phase 2) — the heart of dedup correctness.
 *
 * Resolve a company NAME (and optionally a participant email) against the live
 * CRM using a strict precedence:  exact → alias → domain → fuzzy.  Fuzzy is
 * accepted only above a high trigram threshold AND never for a forbidden pair
 * or a mere internal-substring coincidence.  Anything that does not clear is
 * *no match* — the caller stages it for /triage instead of guessing, because a
 * wrong link silently corrupts the relationship graph (worse than asking).
 *
 * Mirrors `dedupe.ts`: DB access lives here behind a narrow `QueryClient`, but
 * the decision core (subject parsing, trigram scoring, the forbidden-pair and
 * word-boundary guards, the threshold) is PURE and unit-tested. The very same
 * precedence is written in prose in `network-intelligence-skill/SKILL.md` and
 * `reference/forbidden-pairs.md` — keep all three in sync.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { normName } from '@/lib/staging/mappings'

type QueryClient = Pick<SupabaseClient, 'from'>

// ── public shapes ─────────────────────────────────────────────────────────────
export type MatchTier = 'exact' | 'alias' | 'domain' | 'fuzzy'

export interface ResolveMatch {
  company_id: string
  name: string
  match: MatchTier
  score: number // 1 for exact/alias/domain; trigram similarity for fuzzy
}

/**
 * Fuzzy (tier 4) is accepted only at or above this trigram similarity. Deliberately
 * high — a weak fuzzy hit is treated as no match and staged. Exported so any
 * SQL-side variant of the search stays on the same number.
 */
export const FUZZY_MIN_SCORE = 0.3

/**
 * Hard negatives: never resolve `query` (left) to a candidate matching `right`,
 * regardless of fuzzy score. These are known false positives. Kept in sync with
 * SKILL.md and reference/forbidden-pairs.md. The word-boundary guard below
 * already rejects both of these; this list is belt-and-suspenders + documentation.
 */
export const FORBIDDEN_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['amaya', 'maya capital'],
  ['angel ventures', 'maya capital'],
  ['altacima', 'cim'],
]

// ── pure helpers (no DB — unit-tested) ────────────────────────────────────────

/** Tokens of length ≥3 from a normalized name. */
function tokens(s: string): string[] {
  return normName(s)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
}

/**
 * Is a fuzzy match trustworthy on a word-boundary basis? True only when the two
 * names share a token that lines up at a word boundary — a common whole token,
 * or one token being a prefix of the other (`Larrain` ⊂ `LarrainVial`). A merely
 * *internal* shared substring (`maya` inside `amaya`, `cim` inside `altacima`)
 * returns false — that is the classic false positive.
 */
export function sharesWordBoundary(a: string, b: string): boolean {
  const A = tokens(a)
  const B = tokens(b)
  for (const x of A) {
    for (const y of B) {
      if (x === y) return true
      if (x.length >= 4 && y.startsWith(x)) return true
      if (y.length >= 4 && x.startsWith(y)) return true
    }
  }
  return false
}

/** Is (query → candidate) on the explicit forbidden list? */
export function isForbiddenPair(query: string, candidate: string): boolean {
  const q = normName(query)
  const c = normName(candidate)
  return FORBIDDEN_PAIRS.some(([left, right]) => q.includes(left) && c.includes(right))
}

/**
 * Should a fuzzy candidate be accepted? Needs a high enough score, must not be a
 * forbidden pair, and must share a real word boundary (not just an internal
 * substring). Any failure → treat as no match (stage instead).
 */
export function acceptFuzzy(query: string, candidateName: string, score: number): boolean {
  if (score < FUZZY_MIN_SCORE) return false
  if (isForbiddenPair(query, candidateName)) return false
  if (!sharesWordBoundary(query, candidateName)) return false
  return true
}

/**
 * Jaccard similarity over space-padded character trigrams — a close, dependency-free
 * analogue of Postgres `pg_trgm.similarity()`. Each whitespace-split word is padded
 * with two leading spaces and one trailing space before trigram extraction, matching
 * pg_trgm's word handling. Range [0,1].
 */
export function trigramSimilarity(a: string, b: string): number {
  const A = trigrams(a)
  const B = trigrams(b)
  if (A.size === 0 && B.size === 0) return 1
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  const union = A.size + B.size - inter
  return union === 0 ? 0 : inter / union
}

function trigrams(s: string): Set<string> {
  const norm = normName(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const set = new Set<string>()
  if (!norm) return set
  for (const word of norm.split(' ')) {
    const w = `  ${word} `
    for (let i = 0; i < w.length - 2; i++) set.add(w.slice(i, i + 3))
  }
  return set
}

/**
 * Split one side of an intro subject into individual company names. A side may
 * name several companies separated by `/`, `,`, `&`, or the word "and"
 * (`FEN / LV Activa` → `['FEN', 'LV Activa']`). Empty tokens are dropped.
 */
export function splitSideCompanies(side: string): string[] {
  return (side || '')
    .split(/\s*(?:\/|,|&|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface ParsedSubject {
  side1: string[]
  side2: string[]
}

/**
 * Parse an intro subject into its two sides. Recognizes the `<>` / `<->` (and
 * unicode `↔`) connectors that dominate real subjects; each side is then split
 * into companies via {@link splitSideCompanies}. Returns null when no connector
 * is present (the caller should fall back to asking / staging). Only the first
 * connector is used, so a stray `<>` inside a side name won't over-split.
 */
export function parseSubject(subject: string): ParsedSubject | null {
  const s = (subject || '').trim()
  if (!s) return null
  const m = s.split(/\s*<->\s*|\s*<>\s*|\s*↔\s*/)
  if (m.length < 2) return null
  const [left, ...rest] = m
  const right = rest.join(' ') // any extra connectors collapse into side 2
  return { side1: splitSideCompanies(left), side2: splitSideCompanies(right) }
}

/** Lowercased domain from an email, or null. */
export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.indexOf('@')
  if (at < 0) return null
  const domain = email.slice(at + 1).trim().toLowerCase()
  return domain || null
}

// ── DB-facing resolver (used by network_search_companies in Phase 3) ──────────

type CompanyRow = { id: string; name: string }
/** PostgREST types a to-one embed as an array without generated types; accept both. */
type Embedded = { name: string } | { name: string }[] | null
type LinkRow = { company_id: string; companies: Embedded }

function embeddedName(companies: Embedded): string | null {
  if (!companies) return null
  return Array.isArray(companies) ? (companies[0]?.name ?? null) : companies.name
}

/**
 * Resolve a single company name (and optional email for the domain tier) to at
 * most one confident CRM match, or null. Runs the four tiers in precedence order
 * and short-circuits on the first confident hit. Never guesses: an ambiguous
 * exact/alias hit, a weak/forbidden fuzzy hit, or nothing at all → null.
 */
export async function resolveCompany(
  client: QueryClient,
  input: { name: string; email?: string | null }
): Promise<ResolveMatch | null> {
  const q = normName(input.name)
  if (!q) return null

  // ── Tier 1: exact (normalized name) ─────────────────────────────────────────
  // Fetch a candidate pool by substring (accelerated by the pg_trgm GIN index),
  // then compare on normName — the same NFD/whitespace normalization used at write.
  const { data: pool } = await client
    .from('companies')
    .select('id, name')
    .ilike('name', `%${input.name}%`)
    .is('deleted_at', null)
    .limit(50)
  const rows = (pool ?? []) as CompanyRow[]

  const exact = rows.filter((r) => normName(r.name) === q)
  if (exact.length === 1) return { company_id: exact[0].id, name: exact[0].name, match: 'exact', score: 1 }
  if (exact.length > 1) return null // ambiguous duplicate names → let a human decide

  // ── Tier 2: alias ───────────────────────────────────────────────────────────
  const { data: aliases } = await client
    .from('company_aliases')
    .select('company_id, companies(name)')
    .eq('alias', q)
    .limit(2)
  const aliasRows = (aliases ?? []) as unknown as LinkRow[]
  if (aliasRows.length === 1) {
    return { company_id: aliasRows[0].company_id, name: embeddedName(aliasRows[0].companies) ?? input.name, match: 'alias', score: 1 }
  }

  // ── Tier 3: domain (from a participant email) ───────────────────────────────
  const domain = emailDomain(input.email)
  if (domain) {
    const { data: domains } = await client
      .from('company_domains')
      .select('company_id, companies(name)')
      .eq('domain', domain)
      .limit(2)
    const domRows = (domains ?? []) as unknown as LinkRow[]
    if (domRows.length === 1) {
      return { company_id: domRows[0].company_id, name: embeddedName(domRows[0].companies) ?? input.name, match: 'domain', score: 1 }
    }
  }

  // ── Tier 4: fuzzy (trigram, guarded) ────────────────────────────────────────
  // Score the same candidate pool; accept the best only if it clears the
  // threshold, the forbidden list, and the word-boundary guard.
  let best: ResolveMatch | null = null
  for (const r of rows) {
    const score = trigramSimilarity(input.name, r.name)
    if (!acceptFuzzy(input.name, r.name, score)) continue
    if (!best || score > best.score) best = { company_id: r.id, name: r.name, match: 'fuzzy', score }
  }
  return best
}
