import { exchangeAuthCode, refreshGrant, OAuthError } from '@/lib/oauth/store'
import { jsonCors, corsPreflight } from '@/lib/oauth/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// RFC 6749 §3.2 token endpoint. Public client (PKCE), so no client auth —
// the code_verifier proves possession. Accepts form-encoded or JSON bodies.
async function readParams(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({}))
    return body as Record<string, string>
  }
  const form = await req.formData()
  const out: Record<string, string> = {}
  for (const [k, v] of form.entries()) out[k] = String(v)
  return out
}

export async function POST(req: Request) {
  let p: Record<string, string>
  try {
    p = await readParams(req)
  } catch {
    return jsonCors({ error: 'invalid_request', error_description: 'unreadable body' }, 400)
  }

  try {
    if (p.grant_type === 'authorization_code') {
      if (!p.code || !p.client_id || !p.redirect_uri || !p.code_verifier) {
        return jsonCors({ error: 'invalid_request', error_description: 'code, client_id, redirect_uri, code_verifier required' }, 400)
      }
      const grant = await exchangeAuthCode({
        code: p.code,
        clientId: p.client_id,
        redirectUri: p.redirect_uri,
        codeVerifier: p.code_verifier,
      })
      return jsonCors(grant)
    }

    if (p.grant_type === 'refresh_token') {
      if (!p.refresh_token || !p.client_id) {
        return jsonCors({ error: 'invalid_request', error_description: 'refresh_token and client_id required' }, 400)
      }
      const grant = await refreshGrant({ refreshToken: p.refresh_token, clientId: p.client_id })
      return jsonCors(grant)
    }

    return jsonCors({ error: 'unsupported_grant_type' }, 400)
  } catch (e) {
    if (e instanceof OAuthError) {
      const status = e.code === 'server_error' ? 500 : 400
      return jsonCors({ error: e.code, error_description: e.message }, status)
    }
    return jsonCors({ error: 'server_error', error_description: 'token issuance failed' }, 500)
  }
}

export function OPTIONS() {
  return corsPreflight()
}
