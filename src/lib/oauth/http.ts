/**
 * Small HTTP helpers shared by the OAuth endpoints: public-origin resolution
 * (respecting proxy headers) and permissive CORS for the metadata/token
 * endpoints, which browser-based MCP clients call cross-origin.
 */

import { getPublicOrigin } from 'mcp-handler'

export function publicOrigin(req: Request): string {
  return getPublicOrigin(req)
}

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-protocol-version',
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function jsonCors(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
  })
}
