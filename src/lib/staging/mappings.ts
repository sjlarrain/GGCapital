/**
 * Free-text → canonical tag-name mapping (A6).
 *
 * Ported from the alias maps proven in `scripts/import_bbdd.mjs` so the agent
 * (via the Skill), the import script, and the server gates all normalise free
 * text the same way. This module is intentionally *pure* (no DB): it maps a raw
 * string to the canonical catalog **name**. Resolving that name to a catalog
 * **id** is a DB lookup done at the call site (see `dedupe.ts` / the tools),
 * against the live catalog from `tags_list`.
 *
 * Conservative by design: anything not in a map is `resolved: false`, which the
 * classifier turns into a `needs_info: unmapped_tag` reason — tags are never
 * invented.
 *
 * One source of truth: keep these maps aligned with
 * `gg-crm-skill/reference/verification-rules.md` (A6).
 */

export type TagCatalog = 'industry' | 'region' | 'stage' | 'type' | 'status' | 'meeting_type'

export interface TagMatch {
  /** Canonical catalog name when the value maps to a known tag, else null. */
  canonical: string | null
  /** Best-effort near match to show the reviewer when unresolved. */
  nearest: string | null
  /** True only when the value maps to a known catalog value. */
  resolved: boolean
}

// ── normalisers (verbatim from import_bbdd.mjs) ───────────────────────────────
export function normName(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim()
}
export function splitComma(s: string): string[] {
  return !s ? [] : s.split(',').map((v) => v.trim()).filter(Boolean)
}

// ── alias maps (keyed by normName) ────────────────────────────────────────────
const TYPE_MAP: Record<string, string> = {
  'vc': 'VC', 'ffoo': 'Family Office', 'cvc': 'Corporate VC', 'network': 'Network', 'fund': 'Fund', 'company': 'Company',
}

const STATUS_MAP: Record<string, string> = {
  'approved': 'Approved', 'contact': 'Active', 'funnel': 'Watch', 'meeting': 'Active',
  'miss': 'Rejected', 'rejected': 'Rejected', 'stand-by': 'Watch',
}

const INDUSTRY_MAP: Record<string, string> = {
  'ai': 'AI', 'agnostic': 'Agnostic', 'b2b': 'Agnostic', 'climate tech': 'Climate Tech', 'data': 'Data',
  'e-commerce': 'E-Commerce', 'ecommerce': 'E-Commerce', 'fintech': 'Fintech', 'foodtech': 'Foodtech',
  'gaming': 'Gaming', 'healthtech': 'Healthtech', 'insurtech': 'Insurtech', 'life science': 'Life Science',
  'logistic': 'Logistic', 'logistics': 'Logistic', 'marketplace': 'Marketplace', 'mobility': 'Mobility',
  'pet tech': 'Pet Tech', 'proptech': 'Proptech', 'retail': 'Retailtech', 'retailtech': 'Retailtech',
  'saas': 'SaaS', 'secondaries': 'Secondaries', 'traveltech': 'Traveltech', 'wellness': 'Wellness',
}

const REGION_NAME_MAP: Record<string, string> = {
  'ee.uu.': 'United States', 'eeuu': 'United States', 'estados unidos': 'United States', 'usa': 'United States', 'us': 'United States',
  'latam': 'Latin America', 'latinoamerica': 'Latin America', 'latin america': 'Latin America',
  'brasil': 'Brazil', 'brazil': 'Brazil', 'chile': 'Chile', 'argentina': 'Argentina',
  'colombia': 'Colombia', 'mexico': 'Mexico', 'méxico': 'Mexico', 'peru': 'Peru', 'perú': 'Peru',
  'espana': 'Spain', 'españa': 'Spain', 'spain': 'Spain', 'world': 'Global', 'global': 'Global',
  'europa': 'Europe', 'europe': 'Europe', 'asia': 'Asia', 'africa': 'Africa', 'china': 'China', 'india': 'India',
  'canada': 'Canada', 'uk': 'United Kingdom', 'reino unido': 'United Kingdom', 'singapore': 'Singapore',
  'hong kong': 'Hong Kong', 'japan': 'Japan', 'south korea': 'South Korea', 'southeast asia': 'Southeast Asia',
  'middle east': 'Middle East', 'australia': 'Australia', 'new zealand': 'New Zealand', 'oceania': 'Australia', 'paraguay': 'Paraguay',
}

const STAGE_MAP: Record<string, string> = {
  'non deal roadshow': 'Non Deal Roadshow', 'vc fundraising': 'VC Fundraising', 'venturedebt': 'Venture Debt', 'venture debt': 'Venture Debt',
  'pre-seed': 'Pre-Seed', 'seed': 'Seed', 'series a': 'Series A', 'series b': 'Series B', 'series c': 'Series C',
  'series d+': 'Series D+', 'growth': 'Growth', 'pre-ipo': 'Pre-IPO', 'listed': 'Listed', 'mature': 'Mature', 'late stage': 'Late Stage',
}

const MEETING_TYPE_MAP: Record<string, string> = {
  'meeting': 'Meeting', 'pitch': 'Pitch', 'network': 'Network', 'update': 'Update', 'legal': 'Legal',
}

const MAPS: Record<TagCatalog, Record<string, string>> = {
  industry: INDUSTRY_MAP,
  region: REGION_NAME_MAP,
  stage: STAGE_MAP,
  type: TYPE_MAP,
  status: STATUS_MAP,
  meeting_type: MEETING_TYPE_MAP,
}

/** Free-text tag fields (singular) that may appear on staged payloads. */
export const FREE_TEXT_TAG_FIELDS: Record<string, TagCatalog> = {
  industry: 'industry',
  region: 'region',
  stage: 'stage',
  type: 'type',
  status: 'status',
  meeting_type: 'meeting_type',
}

/** Best-effort near match for the reviewer when the value doesn't map exactly. */
function nearestOf(map: Record<string, string>, key: string): string | null {
  if (!key) return null
  for (const [alias, canonical] of Object.entries(map)) {
    if (alias.startsWith(key) || key.startsWith(alias) || alias.includes(key)) return canonical
  }
  return null
}

/**
 * Map a single free-text value to its canonical catalog name.
 * Takes the first comma-separated token (matching the import script), which is
 * how multi-value cells were authored.
 */
export function mapTagName(catalog: TagCatalog, value: string): TagMatch {
  const map = MAPS[catalog]
  const first = splitComma(value)[0] ?? value
  const key = normName(first)
  if (!key) return { canonical: null, nearest: null, resolved: false }
  const canonical = map[key]
  if (canonical) return { canonical, nearest: canonical, resolved: true }
  return { canonical: null, nearest: nearestOf(map, key), resolved: false }
}
