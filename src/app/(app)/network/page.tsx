import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildNodes, type ConstellationEdge, type LeaderboardRow } from '@/lib/network/roles'
import NetworkClient from './NetworkClient'

export const dynamic = 'force-dynamic'

/**
 * Network Intelligence — the relationship constellation + leaderboard.
 *
 * Two read-only surfaces over the live views (v_constellation_edges,
 * v_network_leaderboard). Correct the instant any intro/company changes — no
 * refresh, no materialization. Open to any logged-in user — narrower access
 * (network:read/write for MCP) remains per-user allowlisted separately.
 */
export default async function NetworkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [edgesRes, leaderboardRes] = await Promise.all([
    supabaseAdmin.from('v_constellation_edges').select('source_entity_id, target_entity_id, weight'),
    supabaseAdmin.from('v_network_leaderboard').select('entity_id, name, company_id, is_company, intros_facilitated, intros_received'),
  ])

  const edges = (edgesRes.data ?? []) as ConstellationEdge[]
  const leaderboard = (leaderboardRes.data ?? []) as LeaderboardRow[]
  const nodes = buildNodes(leaderboard, edges)

  // Per-node "flow" for graph coloring: does this org feed GG intros (inbound),
  // get connected by GG (outbound), or both? Far more legible than the role
  // colouring, which collapses almost everything to "beneficiary".
  const partiesRes = await supabaseAdmin
    .from('intro_parties')
    .select('entity_id, intros(direction, deleted_at)')
  // intro_parties → intros is many-to-one (one object at runtime), though the
  // untyped PostgREST client infers an array — normalize defensively.
  type FlowRow = { entity_id: string; intros: { direction: string; deleted_at: string | null } | { direction: string; deleted_at: string | null }[] | null }
  const flowCounts = new Map<string, { in: number; out: number }>()
  for (const row of (partiesRes.data ?? []) as unknown as FlowRow[]) {
    const intro = Array.isArray(row.intros) ? row.intros[0] : row.intros
    if (!intro || intro.deleted_at) continue
    const f = flowCounts.get(row.entity_id) ?? { in: 0, out: 0 }
    if (intro.direction === 'inbound') f.in++
    else if (intro.direction === 'outbound' || intro.direction === 'outbound_internal') f.out++
    flowCounts.set(row.entity_id, f)
  }
  const flowById: Record<string, 'both' | 'in' | 'out' | 'peripheral'> = {}
  for (const [id, f] of flowCounts) {
    flowById[id] = f.in > 0 && f.out > 0 ? 'both' : f.in > 0 ? 'in' : f.out > 0 ? 'out' : 'peripheral'
  }

  return <NetworkClient nodes={nodes} edges={edges} flowById={flowById} />
}
