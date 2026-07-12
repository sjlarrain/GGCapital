import { z } from 'zod'

export const SCOPES = [
  'crm:read',
  'crm:write',
  'staging:read',
  'staging:write',
  'staging:promote',
  // Network Intelligence. Grantable only to allowlisted users (isNetworkUser),
  // never by role — see src/lib/network/allowlist.ts. Flows into OAUTH_SCOPES
  // automatically (only staging:promote is filtered out of OAuth).
  'network:read',
  'network:write',
] as const

export type Scope = (typeof SCOPES)[number]

export const TokenCreateSchema = z.object({
  name:       z.string().min(1).max(100),
  scopes:     z.array(z.enum(SCOPES)).min(1),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
}).strict()

export type TokenCreate = z.infer<typeof TokenCreateSchema>
