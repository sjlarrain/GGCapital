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
 * refresh, no materialization. Admin-only (same pattern as /admin) — narrower
 * than network:read/write, which is per-user allowlisted for MCP access.
 */
export default async function NetworkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/not-found')
  }

  const [edgesRes, leaderboardRes] = await Promise.all([
    supabaseAdmin.from('v_constellation_edges').select('source_company_id, target_company_id, weight'),
    supabaseAdmin.from('v_network_leaderboard').select('company_id, name, intros_facilitated, intros_received'),
  ])

  const edges = (edgesRes.data ?? []) as ConstellationEdge[]
  const leaderboard = (leaderboardRes.data ?? []) as LeaderboardRow[]
  const nodes = buildNodes(leaderboard, edges)

  return <NetworkClient nodes={nodes} edges={edges} />
}
