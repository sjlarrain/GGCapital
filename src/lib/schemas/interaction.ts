import { z } from 'zod'

export const InteractionCreateSchema = z.object({
  contact_id: z.string().uuid(),
  note:       z.string().min(1),
  follow_up:  z.boolean().default(false),
  meeting_id: z.string().uuid().nullable().optional(),
}).strict()

export const InteractionListQuerySchema = z.object({
  contact_id: z.string().uuid().optional(),
  follow_up:  z.enum(['true', 'false']).optional(),
  limit:      z.coerce.number().int().min(1).max(100).default(50),
  offset:     z.coerce.number().int().min(0).default(0),
})

export type InteractionCreate    = z.infer<typeof InteractionCreateSchema>
export type InteractionListQuery = z.infer<typeof InteractionListQuerySchema>
