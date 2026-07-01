/**
 * Server-side persistence for the OAuth authorization server.
 *
 * Keeps the route handlers (register / authorize / token) thin: they parse and
 * redirect, this module owns every read/write against the `oauth_*` tables
 * (014_oauth.sql) via the service-role client. Only hashes of codes/tokens are
 * stored; raw secrets are returned here once and never re-read.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Scope } from '@/lib/schemas/token'
import {
  hashToken,
  mintAccessToken,
  mintRefreshToken,
  mintAuthCode,
  mintClientId,
  verifyPkceS256,
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  CODE_TTL_SECONDS,
} from './tokens'

export interface OAuthClient {
  client_id: string
  client_name: string | null
  redirect_uris: string[]
  grant_types: string[]
  token_endpoint_auth_method: string
}

export interface TokenGrant {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

/** OAuth error surfaced to the token endpoint (maps to a 400 with this code). */
export class OAuthError extends Error {
  constructor(public code: string, description?: string) {
    super(description ?? code)
    this.name = 'OAuthError'
  }
}

// ── Dynamic Client Registration ───────────────────────────────────────────────
export async function registerClient(input: {
  client_name?: string | null
  redirect_uris: string[]
}): Promise<OAuthClient> {
  const client_id = mintClientId()
  const { data, error } = await supabaseAdmin
    .from('oauth_clients')
    .insert({
      client_id,
      client_name: input.client_name ?? null,
      redirect_uris: input.redirect_uris,
    })
    .select('client_id, client_name, redirect_uris, grant_types, token_endpoint_auth_method')
    .single()

  if (error || !data) throw new OAuthError('server_error', error?.message ?? 'registration failed')
  return data as OAuthClient
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const { data } = await supabaseAdmin
    .from('oauth_clients')
    .select('client_id, client_name, redirect_uris, grant_types, token_endpoint_auth_method')
    .eq('client_id', clientId)
    .single()
  return (data as OAuthClient) ?? null
}

/** Exact-match check — the redirect_uri must be one the client registered. */
export function isRegisteredRedirect(client: OAuthClient, uri: string): boolean {
  return client.redirect_uris.includes(uri)
}

// ── Authorization code (single-use, PKCE-bound) ───────────────────────────────
export async function createAuthCode(input: {
  clientId: string
  userId: string
  redirectUri: string
  scopes: Scope[]
  codeChallenge: string
  codeChallengeMethod: string
}): Promise<string> {
  const { raw, hash } = mintAuthCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString()
  const { error } = await supabaseAdmin.from('oauth_auth_codes').insert({
    code_hash: hash,
    client_id: input.clientId,
    user_id: input.userId,
    redirect_uri: input.redirectUri,
    scopes: input.scopes,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
    expires_at: expiresAt,
  })
  if (error) throw new OAuthError('server_error', error.message)
  return raw
}

// ── Token issuance ────────────────────────────────────────────────────────────
async function issueTokens(input: {
  userId: string
  clientId: string
  scopes: string[]
}): Promise<TokenGrant> {
  const access = mintAccessToken()
  const refresh = mintRefreshToken()
  const now = Date.now()
  const { error } = await supabaseAdmin.from('oauth_access_tokens').insert({
    token_hash: access.hash,
    refresh_token_hash: refresh.hash,
    user_id: input.userId,
    client_id: input.clientId,
    scopes: input.scopes,
    expires_at: new Date(now + ACCESS_TTL_SECONDS * 1000).toISOString(),
    refresh_expires_at: new Date(now + REFRESH_TTL_SECONDS * 1000).toISOString(),
  })
  if (error) throw new OAuthError('server_error', error.message)
  return {
    access_token: access.raw,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: refresh.raw,
    scope: input.scopes.join(' '),
  }
}

/**
 * Exchange an authorization code for tokens (grant_type=authorization_code).
 * Validates PKCE, redirect_uri and client binding, and consumes the code
 * atomically (single-use) via a conditional update.
 */
export async function exchangeAuthCode(input: {
  code: string
  clientId: string
  redirectUri: string
  codeVerifier: string
}): Promise<TokenGrant> {
  const hash = hashToken(input.code)
  const { data: row } = await supabaseAdmin
    .from('oauth_auth_codes')
    .select('client_id, user_id, redirect_uri, scopes, code_challenge, code_challenge_method, expires_at, consumed_at')
    .eq('code_hash', hash)
    .single()

  if (!row) throw new OAuthError('invalid_grant', 'unknown authorization code')
  if (row.consumed_at) throw new OAuthError('invalid_grant', 'authorization code already used')
  if (new Date(row.expires_at) < new Date()) throw new OAuthError('invalid_grant', 'authorization code expired')
  if (row.client_id !== input.clientId) throw new OAuthError('invalid_grant', 'client mismatch')
  if (row.redirect_uri !== input.redirectUri) throw new OAuthError('invalid_grant', 'redirect_uri mismatch')
  if (row.code_challenge_method !== 'S256' || !verifyPkceS256(input.codeVerifier, row.code_challenge)) {
    throw new OAuthError('invalid_grant', 'PKCE verification failed')
  }

  // Single-use: only the first exchange flips consumed_at from null.
  const { data: consumed } = await supabaseAdmin
    .from('oauth_auth_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('code_hash', hash)
    .is('consumed_at', null)
    .select('code_hash')
    .single()
  if (!consumed) throw new OAuthError('invalid_grant', 'authorization code already used')

  return issueTokens({ userId: row.user_id, clientId: row.client_id, scopes: row.scopes })
}

/**
 * Refresh an access token (grant_type=refresh_token). Rotates both tokens:
 * the old row is revoked and a new one issued, so a leaked refresh token is
 * usable at most once.
 */
export async function refreshGrant(input: {
  refreshToken: string
  clientId: string
}): Promise<TokenGrant> {
  const hash = hashToken(input.refreshToken)
  const { data: row } = await supabaseAdmin
    .from('oauth_access_tokens')
    .select('id, user_id, client_id, scopes, revoked_at, refresh_expires_at')
    .eq('refresh_token_hash', hash)
    .single()

  if (!row || row.revoked_at) throw new OAuthError('invalid_grant', 'unknown refresh token')
  if (row.client_id !== input.clientId) throw new OAuthError('invalid_grant', 'client mismatch')
  if (row.refresh_expires_at && new Date(row.refresh_expires_at) < new Date()) {
    throw new OAuthError('invalid_grant', 'refresh token expired')
  }

  // Rotate: revoke the old grant, then issue a fresh access + refresh pair.
  const { data: revoked } = await supabaseAdmin
    .from('oauth_access_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('revoked_at', null)
    .select('id')
    .single()
  if (!revoked) throw new OAuthError('invalid_grant', 'refresh token already used')

  return issueTokens({ userId: row.user_id, clientId: row.client_id, scopes: row.scopes })
}
