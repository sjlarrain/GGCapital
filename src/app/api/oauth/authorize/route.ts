import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClient, isRegisteredRedirect, createAuthCode, OAUTH_SCOPES, type OAuthClient } from '@/lib/oauth/store'
import { ROLE_SCOPES } from '@/app/api/v1/_lib/auth'
import type { Scope } from '@/lib/schemas/token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Bad request we can't safely redirect (unknown client / bad redirect_uri). */
function errorPage(message: string, status = 400): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Authorization error</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">
<h1 style="font-size:1.25rem">Authorization error</h1><p>${message}</p></body></html>`
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

/**
 * Redirect back to the client with an OAuth error (client+redirect validated).
 * 303 (not the NextResponse.redirect default of 307) so a POST-triggered call
 * (e.g. the consent form's "Deny" button) always follows up with GET, not POST.
 */
function errorRedirect(redirectUri: string, error: string, state: string | null, description?: string): Response {
  const url = new URL(redirectUri)
  url.searchParams.set('error', error)
  if (description) url.searchParams.set('error_description', description)
  if (state) url.searchParams.set('state', state)
  return NextResponse.redirect(url.toString(), 303)
}

/** Requested scopes ∩ (role defaults ∩ OAUTH_SCOPES); empty request → all eligible defaults. */
function grantedScopes(requested: string | null, role: 'admin' | 'user'): Scope[] {
  const roleScopes = (ROLE_SCOPES[role] ?? ROLE_SCOPES.user).filter((s) => OAUTH_SCOPES.includes(s))
  if (!requested?.trim()) return roleScopes
  const req = requested.split(/\s+/).filter(Boolean)
  return roleScopes.filter((s) => req.includes(s))
}

function consentPage(params: {
  client: OAuthClient
  email: string
  scopes: Scope[]
  redirectUri: string
  state: string | null
  codeChallenge: string
  codeChallengeMethod: string
  scope: string | null
}): Response {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
  const name = esc(params.client.client_name || 'An application')
  const scopeItems = params.scopes.map((s) => `<li><code>${esc(s)}</code></li>`).join('')
  const hidden = (n: string, v: string) => `<input type="hidden" name="${n}" value="${esc(v)}">`

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Connect ${name}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;max-width:26rem;margin:3rem auto;padding:0 1rem;color:#1f2933">
  <h1 style="font-size:1.35rem;margin-bottom:.25rem">Connect to GG Capital CRM</h1>
  <p style="color:#52606d;margin-top:0"><strong>${name}</strong> wants to access your CRM as
     <strong>${esc(params.email)}</strong>.</p>
  <p style="color:#52606d">It will be able to:</p>
  <ul style="line-height:1.8">${scopeItems}</ul>
  <form method="post" action="/api/oauth/authorize" style="display:flex;gap:.75rem;margin-top:1.5rem">
    ${hidden('client_id', params.client.client_id)}
    ${hidden('redirect_uri', params.redirectUri)}
    ${hidden('scope', params.scope ?? '')}
    ${hidden('state', params.state ?? '')}
    ${hidden('code_challenge', params.codeChallenge)}
    ${hidden('code_challenge_method', params.codeChallengeMethod)}
    <button name="decision" value="approve" type="submit"
      style="flex:1;padding:.6rem;border:0;border-radius:.5rem;background:#3d5afe;color:#fff;font-size:1rem;cursor:pointer">Approve</button>
    <button name="decision" value="deny" type="submit"
      style="flex:1;padding:.6rem;border:1px solid #cbd2d9;border-radius:.5rem;background:#fff;color:#1f2933;font-size:1rem;cursor:pointer">Deny</button>
  </form>
</body></html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// ── GET: validate + login gate + consent ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const clientId = sp.get('client_id')
  const redirectUri = sp.get('redirect_uri')
  const responseType = sp.get('response_type')
  const state = sp.get('state')
  const scope = sp.get('scope')
  const codeChallenge = sp.get('code_challenge')
  const codeChallengeMethod = sp.get('code_challenge_method') ?? 'S256'

  if (!clientId || !redirectUri) return errorPage('Missing client_id or redirect_uri.')
  const client = await getClient(clientId)
  if (!client) return errorPage('Unknown client_id.')
  if (!isRegisteredRedirect(client, redirectUri)) return errorPage('redirect_uri is not registered for this client.')

  // From here the redirect_uri is trusted, so protocol errors go back to it.
  if (responseType !== 'code') return errorRedirect(redirectUri, 'unsupported_response_type', state)
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return errorRedirect(redirectUri, 'invalid_request', state, 'PKCE S256 code_challenge required')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const next = req.nextUrl.pathname + req.nextUrl.search
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.url))
  }

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  const role = (profile?.role ?? 'user') as 'admin' | 'user'

  return consentPage({
    client,
    email: user.email ?? user.id,
    scopes: grantedScopes(scope, role),
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod,
    scope,
  })
}

// ── POST: consent decision → mint code + redirect ─────────────────────────────
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const clientId = String(form.get('client_id') ?? '')
  const redirectUri = String(form.get('redirect_uri') ?? '')
  const state = (form.get('state') as string) || null
  const scope = (form.get('scope') as string) || null
  const codeChallenge = String(form.get('code_challenge') ?? '')
  const codeChallengeMethod = String(form.get('code_challenge_method') ?? 'S256')
  const decision = String(form.get('decision') ?? '')

  if (!clientId || !redirectUri) return errorPage('Missing client_id or redirect_uri.')
  const client = await getClient(clientId)
  if (!client) return errorPage('Unknown client_id.')
  if (!isRegisteredRedirect(client, redirectUri)) return errorPage('redirect_uri is not registered for this client.')

  if (decision !== 'approve') return errorRedirect(redirectUri, 'access_denied', state)
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return errorRedirect(redirectUri, 'invalid_request', state, 'PKCE S256 code_challenge required')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const next = '/api/oauth/authorize'
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.url), 303)
  }

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  const role = (profile?.role ?? 'user') as 'admin' | 'user'
  const scopes = grantedScopes(scope, role)

  const code = await createAuthCode({
    clientId,
    userId: user.id,
    redirectUri,
    scopes,
    codeChallenge,
    codeChallengeMethod,
  })

  const url = new URL(redirectUri)
  url.searchParams.set('code', code)
  if (state) url.searchParams.set('state', state)
  // 303, not the NextResponse.redirect default of 307: this POST handler must
  // hand off to the client's redirect_uri via GET, never re-POST the form data.
  return NextResponse.redirect(url.toString(), 303)
}
