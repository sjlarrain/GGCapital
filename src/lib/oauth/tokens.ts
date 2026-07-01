/**
 * OAuth token / code / client-id minting + PKCE verification.
 *
 * Mirrors the PAT approach in `src/lib/auth/tokens.ts`: only SHA-256 hashes of
 * secrets are ever stored (see 014_oauth.sql); raw values are shown once — in
 * the token response or the authorization redirect — and never persisted.
 *
 *   ggo_  access token   (Bearer, sent to /api/mcp and /api/v1/*)
 *   ggr_  refresh token   (exchanged at /api/oauth/token)
 *   ggcid_ client id      (public; from Dynamic Client Registration)
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { hashToken } from '@/lib/auth/tokens'

export const ACCESS_PREFIX = 'ggo_'
export const REFRESH_PREFIX = 'ggr_'
export const CLIENT_PREFIX = 'ggcid_'

/** Access-token lifetime: short, since refresh is silent. */
export const ACCESS_TTL_SECONDS = 60 * 60          // 1 hour
/** Refresh-token lifetime. */
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
/** Authorization-code lifetime: single-use, seconds. */
export const CODE_TTL_SECONDS = 60

export function isOAuthToken(token: string): boolean {
  return token.startsWith(ACCESS_PREFIX)
}

/** Re-export so callers hash any raw secret with the same function as PATs. */
export { hashToken }

export function mintAccessToken(): { raw: string; hash: string } {
  const raw = ACCESS_PREFIX + randomBytes(32).toString('hex')
  return { raw, hash: hashToken(raw) }
}

export function mintRefreshToken(): { raw: string; hash: string } {
  const raw = REFRESH_PREFIX + randomBytes(32).toString('hex')
  return { raw, hash: hashToken(raw) }
}

/** Authorization code: raw goes in the redirect, only the hash is stored. */
export function mintAuthCode(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url')
  return { raw, hash: hashToken(raw) }
}

export function mintClientId(): string {
  return CLIENT_PREFIX + randomBytes(16).toString('hex')
}

/**
 * PKCE S256 check: SHA-256(verifier), base64url, must equal the stored
 * code_challenge. Constant-time compare. Only S256 is supported (plain is not).
 */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  const computed = createHash('sha256').update(verifier).digest('base64url')
  const a = Buffer.from(computed)
  const b = Buffer.from(challenge)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
