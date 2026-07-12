import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildNodes, type ConstellationEdge, type LeaderboardRow } from '@/lib/network/roles'
import NetworkClient from './NetworkClient'

export const dynamic = 'force-dynamic'

/**
 * Network Intelligence — the relationship constellation + leaderboard.
 *
 * Two read-only surfaces over the live views (v_constellation_edges,
 * v_network_leaderboard). Correct the instant any intro/company changes — no
 * refresh, no materialization. Read via the service client because these are
 * aggregate dashboard views and the page is already auth-gated by (app)/layout.
 */
export default async function NetworkPage() {
  const [edgesRes, leaderboardRes] = await Promise.all([
    supabaseAdmin.from('v_constellation_edges').select('source_company_id, target_company_id, weight'),
    supabaseAdmin.from('v_network_leaderboard').select('company_id, name, intros_facilitated, intros_received'),
  ])

  const edges = (edgesRes.data ?? []) as ConstellationEdge[]
  const leaderboard = (leaderboardRes.data ?? []) as LeaderboardRow[]
  const nodes = buildNodes(leaderboard, edges)

  return <NetworkClient nodes={nodes} edges={edges} />
}
