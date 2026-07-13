/**
 * Network role + degree computation (Phase 2) — pure TS, no DB.
 *
 * Turns the two live views (`v_network_leaderboard`, `v_constellation_edges`)
 * into the derived quantities the constellation UI needs: each org's role (how
 * it colors a node) and its degree (how many distinct companies it connects to,
 * how it sizes a node). Kept pure so it's unit-testable and identical whether
 * called from the page or a test.
 */

// ── shapes (mirror the two views) ─────────────────────────────────────────────

/** One row of `v_network_leaderboard`. Keyed on the graph NODE (entity), which
 *  may or may not be backed by a CRM company (`is_company` / `company_id`). */
export interface LeaderboardRow {
  entity_id: string
  name: string
  company_id: string | null
  is_company: boolean
  intros_facilitated: number
  intros_received: number
}

/** One row of `v_constellation_edges` (undirected; source < target). */
export interface ConstellationEdge {
  source_entity_id: string
  target_entity_id: string
  weight: number
}

/**
 * A company's role in the network:
 *  - `connector`   — both facilitates *and* receives intros (a two-way hub)
 *  - `facilitator` — makes intros for others but receives none
 *  - `beneficiary` — receives intros but makes none
 *  - `peripheral`  — neither (present in the graph only as a party, e.g. isolated)
 */
export type NetworkRole = 'connector' | 'facilitator' | 'beneficiary' | 'peripheral'

/** Classify a single company's role from its leaderboard counts. */
export function classifyRole(input: { intros_facilitated: number; intros_received: number }): NetworkRole {
  const facilitates = input.intros_facilitated > 0
  const receives = input.intros_received > 0
  if (facilitates && receives) return 'connector'
  if (facilitates) return 'facilitator'
  if (receives) return 'beneficiary'
  return 'peripheral'
}

/**
 * Degree = number of *distinct* companies each company is connected to via
 * intros. Built from the constellation edges (which are already deduped pairs).
 * Every company id appearing on either end of an edge gets an entry.
 */
export function computeDegrees(edges: ConstellationEdge[]): Map<string, number> {
  const neighbors = new Map<string, Set<string>>()
  const add = (a: string, b: string) => {
    let set = neighbors.get(a)
    if (!set) neighbors.set(a, (set = new Set()))
    set.add(b)
  }
  for (const e of edges) {
    if (e.source_entity_id === e.target_entity_id) continue
    add(e.source_entity_id, e.target_entity_id)
    add(e.target_entity_id, e.source_entity_id)
  }
  const degrees = new Map<string, number>()
  for (const [id, set] of neighbors) degrees.set(id, set.size)
  return degrees
}

/**
 * Weighted degree = total intro weight incident on each company (a node's total
 * "traffic", distinct from its neighbor count). Useful for sizing hubs.
 */
export function computeWeightedDegrees(edges: ConstellationEdge[]): Map<string, number> {
  const totals = new Map<string, number>()
  const add = (id: string, w: number) => totals.set(id, (totals.get(id) ?? 0) + w)
  for (const e of edges) {
    if (e.source_entity_id === e.target_entity_id) continue
    add(e.source_entity_id, e.weight)
    add(e.target_entity_id, e.weight)
  }
  return totals
}

/** A leaderboard row enriched with its role + graph degree, ready for the UI. */
export interface NetworkNode extends LeaderboardRow {
  role: NetworkRole
  degree: number
}

/**
 * Join the leaderboard with the edge-derived degrees into renderable nodes,
 * sorted for the leaderboard surface: most intros facilitated first, then most
 * received, then by name for a stable order.
 */
export function buildNodes(leaderboard: LeaderboardRow[], edges: ConstellationEdge[]): NetworkNode[] {
  const degrees = computeDegrees(edges)
  return leaderboard
    .map((row) => ({
      ...row,
      role: classifyRole(row),
      degree: degrees.get(row.entity_id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.intros_facilitated - a.intros_facilitated ||
        b.intros_received - a.intros_received ||
        a.name.localeCompare(b.name)
    )
}
