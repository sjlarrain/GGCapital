import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { registerCrmTools, registerNetworkTools } from '@/lib/mcp/tools'
import { authenticate } from '@/app/api/v1/_lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// The MCP "hands": streamable-HTTP transport at /api/mcp. Tools are registered
// once per server init; auth is enforced by withMcpAuth via verifyBearer, which
// reuses the same PAT/OAuth verification as the REST API.
const base = createMcpHandler(
  (server) => {
    registerCrmTools(server)
    registerNetworkTools(server)
  },
  { serverInfo: { name: 'gg-capital-crm', version: '1.0.0' } },
  { basePath: '/api', disableSse: true, maxDuration: 60 }
)

// Accepts either a human OAuth token (ggo_) or a server-to-server PAT (ggc_).
// The identity is carried into tool handlers via AuthInfo.extra.
async function verifyBearer(req: Request, token?: string): Promise<AuthInfo | undefined> {
  const ctx = await authenticate(req)
  if (!ctx || !token) return undefined
  return {
    token,
    clientId: ctx.authType, // informational; PAT/OAuth are the "clients" here
    scopes: ctx.scopes,
    extra: { userId: ctx.userId, role: ctx.role, authType: ctx.authType },
  }
}

const handler = withMcpAuth(base, verifyBearer, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export { handler as GET, handler as POST, handler as DELETE }
