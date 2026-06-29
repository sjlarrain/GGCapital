import type { NextRequest } from 'next/server'
import { authenticate, hasScope } from '../_lib/auth'
import { ok, created, unauthorized, forbidden, serverError, badRequest } from '../_lib/respond'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const CATALOG_TABLES = {
  industries:  'tag_industries',
  regions:     'tag_regions',
  stages:      'tag_stages',
  types:       'tag_types',
  statuses:    'tag_statuses',
  meetingTypes: 'tag_meeting_types',
} as const

type CatalogKey = keyof typeof CATALOG_TABLES

const TagCreateSchema = z.object({
  catalog: z.enum(['industries', 'regions', 'stages', 'types', 'statuses', 'meetingTypes']),
  name:    z.string().min(1).max(100),
}).strict()

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'crm:read')) return forbidden()

  const catalogParam = req.nextUrl.searchParams.get('catalog') as CatalogKey | null
  if (catalogParam && !(catalogParam in CATALOG_TABLES)) return badRequest('Unknown catalog')

  if (catalogParam) {
    const { data, error } = await supabaseAdmin
      .from(CATALOG_TABLES[catalogParam])
      .select('*')
      .order('name')
    if (error) return serverError(error.message)
    return ok({ [catalogParam]: data })
  }

  const [industries, regions, stages, types, statuses, meetingTypes] = await Promise.all([
    supabaseAdmin.from('tag_industries').select('*').order('name'),
    supabaseAdmin.from('tag_regions').select('*').order('name'),
    supabaseAdmin.from('tag_stages').select('*').order('name'),
    supabaseAdmin.from('tag_types').select('*').order('name'),
    supabaseAdmin.from('tag_statuses').select('*').order('name'),
    supabaseAdmin.from('tag_meeting_types').select('*').order('name'),
  ])

  return ok({
    industries:   industries.data ?? [],
    regions:      regions.data ?? [],
    stages:       stages.data ?? [],
    types:        types.data ?? [],
    statuses:     statuses.data ?? [],
    meetingTypes: meetingTypes.data ?? [],
  })
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'crm:write')) return forbidden()

  let body: unknown
  try { body = await req.json() } catch { return badRequest('Invalid JSON') }
  const parsed = TagCreateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const { catalog, name } = parsed.data
  const { data, error } = await supabaseAdmin
    .from(CATALOG_TABLES[catalog as CatalogKey])
    .insert({ name })
    .select()
    .single()

  if (error) return serverError(error.message)
  return created({ ...data, catalog })
}
