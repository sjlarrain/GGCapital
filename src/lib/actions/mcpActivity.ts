'use server'
import { createClient } from '@/lib/supabase/server'

export async function getMcpActivity(limit = 200) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mcp_activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const rows = data ?? []

  const actorIds = [...new Set(rows.map((r) => r.actor))]
  const actorEmails: Record<string, string> = {}
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from('user_profiles').select('id, email').in('id', actorIds)
    for (const p of profiles ?? []) actorEmails[p.id] = p.email
  }

  return rows.map((r) => ({ ...r, actor_email: actorEmails[r.actor] ?? null }))
}
