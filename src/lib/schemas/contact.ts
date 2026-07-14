import { z } from 'zod'

const base = z.object({
  name:             z.string().min(1),
  email:            z.string().email(),       // required per A2 spec
  company_id:       z.string().uuid(),        // required per A2 spec
  role:             z.string().nullable().optional(),
  employer:         z.string().nullable().optional(),
  phone:            z.string().nullable().optional(),
  expertise:        z.string().nullable().optional(),
  industry_ids:     z.array(z.string().uuid()).optional(),
  region_ids:       z.array(z.string().uuid()).optional(),
  investment_focus_ids: z.array(z.string().uuid()).optional(),
  linkedin:         z.string().url().nullable().optional(),
  location:         z.string().nullable().optional(),
  stage_ids:        z.array(z.string().uuid()).optional(),
})

export const ContactCreateSchema = base.strict()
export const ContactUpdateSchema = base.partial().strict()

export const ContactListQuerySchema = z.object({
  q:           z.string().optional(),
  company_id:  z.string().uuid().optional(),
  data_status: z.enum(['stub', 'partial', 'complete']).optional(),
  limit:       z.coerce.number().int().min(1).max(100).default(50),
  offset:      z.coerce.number().int().min(0).default(0),
})

export type ContactCreate    = z.infer<typeof ContactCreateSchema>
export type ContactUpdate    = z.infer<typeof ContactUpdateSchema>
export type ContactListQuery = z.infer<typeof ContactListQuerySchema>
