import { z } from 'zod'

const base = z.object({
  company_id: z.string().uuid(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title:      z.string().min(1),
  notes:      z.string().nullable().optional(),
  type_id:    z.string().uuid().nullable().optional(),
})

export const MeetingCreateSchema = base.strict()
export const MeetingUpdateSchema = base.partial().strict()

export const MeetingListQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
  limit:      z.coerce.number().int().min(1).max(100).default(50),
  offset:     z.coerce.number().int().min(0).default(0),
})

export type MeetingCreate    = z.infer<typeof MeetingCreateSchema>
export type MeetingUpdate    = z.infer<typeof MeetingUpdateSchema>
export type MeetingListQuery = z.infer<typeof MeetingListQuerySchema>
