import { z } from 'zod'
import { registerClient, OAuthError } from '@/lib/oauth/store'
import { jsonCors, corsPreflight } from '@/lib/oauth/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// RFC 7591 — Dynamic Client Registration. Public clients only (PKCE), so no
// secret is issued. MCP clients POST their redirect URIs and get a client_id.
const RegisterSchema = z.object({
  client_name: z.string().max(200).optional(),
  redirect_uris: z.array(z.string().url()).min(1),
  // Accept-and-ignore the rest of the RFC 7591 body MCP clients may send.
}).passthrough()

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonCors({ error: 'invalid_client_metadata', error_description: 'invalid JSON' }, 400)
  }

  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return jsonCors(
      { error: 'invalid_client_metadata', error_description: 'redirect_uris (array of URLs) required' },
      400
    )
  }

  try {
    const client = await registerClient({
      client_name: parsed.data.client_name ?? null,
      redirect_uris: parsed.data.redirect_uris,
    })

    return jsonCors(
      {
        client_id: client.client_id,
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        grant_types: client.grant_types,
        token_endpoint_auth_method: client.token_endpoint_auth_method,
        client_id_issued_at: Math.floor(Date.now() / 1000),
      },
      201
    )
  } catch (e) {
    if (e instanceof OAuthError) {
      return jsonCors({ error: e.code, error_description: e.message }, 500)
    }
    return jsonCors({ error: 'server_error', error_description: 'client registration failed' }, 500)
  }
}

export function OPTIONS() {
  return corsPreflight()
}
