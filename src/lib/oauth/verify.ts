/**
 * Validate an OAuth access token (`ggo_…`) issued by our authorization server.
 *
 * Same shape as PAT validation (see `_lib/auth.ts#verifyPAT`): hash the raw
 * token, look it up, reject revoked/expired, bump `last_used_at`, resolve the
 * user's role. Scopes come from the token row (granted at consent time).
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/auth/tokens'
import type { Scope } from '@/lib/schemas/token'

export interface OAuthIdentity {
  userId: string
  role: 'admin' | 'user'
  scopes: Scope[]
}

export async function verifyOAuthToken(raw: string): Promise<OAuthIdentity | null> {
  const hash = hashToken(raw)
  const { data: tok } = await supabaseAdmin
    .from('oauth_access_tokens')
    .select('user_id, scopes, expires_at, revoked_at')
    .eq('token_hash', hash)
    .single()

  if (!tok || tok.revoked_at) return null
  if (tok.expires_at && new Date(tok.expires_at) < new Date()) return null

  supabaseAdmin
    .from('oauth_access_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token_hash', hash)
    .then(() => {})

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', tok.user_id)
    .single()

  const role = (profile?.role ?? 'user') as 'admin' | 'user'
  return { userId: tok.user_id, role, scopes: tok.scopes as Scope[] }
}
