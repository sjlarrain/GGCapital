import { z } from 'zod'

const base = z.object({
  name:                 z.string().min(1),
  description:          z.string().nullable().optional(),
  source:               z.enum(['Direct', 'Fund']).nullable().optional(),
  industry_ids:         z.array(z.string().uuid()).optional(),
  region_ids:           z.array(z.string().uuid()).optional(),
  stage_ids:            z.array(z.string().uuid()).optional(),
  type_id:              z.string().uuid().nullable().optional(),
  status_id:            z.string().uuid().nullable().optional(),
  parent_company_id:    z.string().uuid().nullable().optional(),
  website:              z.string().url().nullable().optional(),
  round_size_musd:      z.number().positive().nullable().optional(),
  valuation_musd:       z.number().positive().nullable().optional(),
  legal:                z.string().nullable().optional(),
  deal_date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  country:              z.string().nullable().optional(),
  founded_year:         z.number().int().min(1800).max(2100).nullable().optional(),
  investment_stage_ids: z.array(z.string().uuid()).optional(),
  files:                z.array(z.string()).optional(),
})

export const CompanyCreateSchema = base.strict()
export const CompanyUpdateSchema = base.partial().strict()

export const CompanyListQuerySchema = z.object({
  q:           z.string().optional(),
  data_status: z.enum(['stub', 'partial', 'complete']).optional(),
  limit:       z.coerce.number().int().min(1).max(100).default(50),
  offset:      z.coerce.number().int().min(0).default(0),
})

export type CompanyCreate    = z.infer<typeof CompanyCreateSchema>
export type CompanyUpdate    = z.infer<typeof CompanyUpdateSchema>
export type CompanyListQuery = z.infer<typeof CompanyListQuerySchema>
