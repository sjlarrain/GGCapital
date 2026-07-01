import { supabaseAdmin } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/auth/tokens'
import { isOAuthToken } from '@/lib/oauth/tokens'
import { verifyOAuthToken } from '@/lib/oauth/verify'
import type { Scope } from '@/lib/schemas/token'

export type { Scope }

export interface AuthContext {
  userId: string
  role: 'admin' | 'user'
  scopes: Scope[]
  /**
   * How the caller authenticated:
   *   jwt   — interactive human on a Supabase session
   *   oauth — interactive human who connected an MCP client via the OAuth flow
   *   pat   — non-interactive server-to-server "agent"
   */
  authType: 'jwt' | 'pat' | 'oauth'
}

/**
 * A PAT caller is a server-to-server agent (vs. an interactive human on a JWT
 * or OAuth session). OAuth tokens are issued after a human logs in, so they
 * count as humans — the auto-promote gate only blocks PAT agents.
 */
export function isAgent(ctx: AuthContext): boolean {
  return ctx.authType === 'pat'
}

export const ROLE_SCOPES: Record<string, Scope[]> = {
  admin: ['crm:read', 'crm:write', 'staging:read', 'staging:write', 'staging:promote'],
  user:  ['crm:read', 'crm:write', 'staging:read', 'staging:write'],
}

export async function authenticate(req: Request): Promise<AuthContext | null> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7)
  if (token.startsWith('ggc_')) return verifyPAT(token)
  if (isOAuthToken(token)) return verifyOAuth(token)
  return verifyJWT(token)
}

async function verifyOAuth(raw: string): Promise<AuthContext | null> {
  const id = await verifyOAuthToken(raw)
  if (!id) return null
  return { userId: id.userId, role: id.role, scopes: id.scopes, authType: 'oauth' }
}

async function verifyPAT(raw: string): Promise<AuthContext | null> {
  const hash = hashToken(raw)
  const { data: pat } = await supabaseAdmin
    .from('api_tokens')
    .select('user_id, scopes, expires_at, revoked_at')
    .eq('token_hash', hash)
    .single()

  if (!pat || pat.revoked_at) return null
  if (pat.expires_at && new Date(pat.expires_at) < new Date()) return null

  supabaseAdmin
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token_hash', hash)
    .then(() => {})

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', pat.user_id)
    .single()

  const role = (profile?.role ?? 'user') as 'admin' | 'user'
  return { userId: pat.user_id, role, scopes: pat.scopes as Scope[], authType: 'pat' }
}

async function verifyJWT(jwt: string): Promise<AuthContext | null> {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt)
  if (error || !user) return null

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'user') as 'admin' | 'user'
  return { userId: user.id, role, scopes: ROLE_SCOPES[role], authType: 'jwt' }
}

export function hasScope(ctx: AuthContext, scope: Scope): boolean {
  return ctx.scopes.includes(scope)
}
