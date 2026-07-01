import { protectedResourceHandler, metadataCorsOptionsRequestHandler, getPublicOrigin } from 'mcp-handler'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// RFC 9728 — points MCP clients at our authorization server (this app) so they
// can run the OAuth flow to obtain a token for the /api/mcp resource.
export function GET(req: NextRequest) {
  return protectedResourceHandler({ authServerUrls: [getPublicOrigin(req)] })(req)
}

export const OPTIONS = metadataCorsOptionsRequestHandler()
