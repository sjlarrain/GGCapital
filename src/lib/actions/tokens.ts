'use server'
import { createClient } from '@/lib/supabase/server'
import { mintToken } from '@/lib/auth/tokens'
import { revalidatePath } from 'next/cache'
import type { Scope } from '@/lib/schemas/token'
import { SCOPES } from '@/lib/schemas/token'
import { canUseNetwork, NETWORK_SCOPES } from '@/lib/network/allowlist'

// network:* are intentionally excluded from both role sets: they are granted by
// the per-user allowlist below, not by role. (ADMIN_SCOPES spreads all SCOPES,
// so it would otherwise include them — strip them back out here.)
const ADMIN_SCOPES: Scope[] = SCOPES.filter((s) => !NETWORK_SCOPES.includes(s))
const USER_SCOPES:  Scope[] = ['crm:read', 'crm:write', 'staging:read', 'staging:write']

export async function listApiTokens() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('api_tokens')
    .select('id, name, scopes, last_used_at, expires_at, revoked_at, created_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function createApiToken(
  name: string,
  scopes: Scope[],
  expiresAt: string | null
): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const roleScopes = profile?.role === 'admin' ? ADMIN_SCOPES : USER_SCOPES
  // Admins and allowlisted users may additionally mint tokens carrying network:*.
  const allowed = canUseNetwork(user.id, profile?.role) ? [...roleScopes, ...NETWORK_SCOPES] : roleScopes
  const validScopes = scopes.filter((s) => allowed.includes(s))
  if (validScopes.length === 0) throw new Error('No valid scopes')

  const { raw, hash } = mintToken()

  const { error } = await supabase.from('api_tokens').insert({
    user_id:    user.id,
    name:       name.trim(),
    token_hash: hash,
    scopes:     validScopes,
    expires_at: expiresAt ?? null,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/settings/tokens')
  return raw
}

export async function revokeApiToken(tokenId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/settings/tokens')
}
