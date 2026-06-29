import { z } from 'zod'

export const SCOPES = [
  'crm:read',
  'crm:write',
  'staging:read',
  'staging:write',
  'staging:promote',
] as const

export type Scope = (typeof SCOPES)[number]

export const TokenCreateSchema = z.object({
  name:       z.string().min(1).max(100),
  scopes:     z.array(z.enum(SCOPES)).min(1),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
}).strict()

export type TokenCreate = z.infer<typeof TokenCreateSchema>
