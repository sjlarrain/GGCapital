import type { NextRequest } from 'next/server'
import { OAUTH_SCOPES } from '@/lib/oauth/store'
import { publicOrigin, jsonCors, corsPreflight } from '@/lib/oauth/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// RFC 8414 — OAuth 2.0 Authorization Server Metadata. Public + CORS so MCP
// clients (Claude / Cowork) can discover our endpoints before any login.
export function GET(req: NextRequest) {
  const origin = publicOrigin(req)
  return jsonCors({
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: OAUTH_SCOPES,
  })
}

export function OPTIONS() {
  return corsPreflight()
}
