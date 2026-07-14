import type { NextRequest } from 'next/server'
import { authenticate, hasScope } from '../_lib/auth'
import { ok, created, unauthorized, forbidden, serverError, badRequest } from '../_lib/respond'
import { parseBody, isResponse } from '../_lib/validate'
import { InteractionCreateSchema, InteractionListQuerySchema } from '@/lib/schemas/interaction'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'crm:read')) return forbidden()

  const raw = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = InteractionListQuerySchema.safeParse(raw)
  if (!parsed.success) return badRequest('Invalid query parameters')
  const q = parsed.data

  let query = supabaseAdmin
    .from('interaction_logs')
    .select('*, meeting:meetings(id, title, date)')
    .order('created_at', { ascending: false })
    .range(q.offset, q.offset + q.limit - 1)

  if (q.entity_type) query = query.eq('entity_type', q.entity_type)
  if (q.entity_id) query = query.eq('entity_id', q.entity_id)
  if (q.follow_up !== undefined) query = query.eq('follow_up', q.follow_up === 'true')

  const { data, error } = await query
  if (error) return serverError(error.message)
  return ok(data)
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'crm:write')) return forbidden()

  const body = await parseBody(req, InteractionCreateSchema)
  if (isResponse(body)) return body

  const { data, error } = await supabaseAdmin
    .from('interaction_logs')
    .insert({ ...body, created_by: ctx.userId, updated_by: ctx.userId })
    .select()
    .single()

  if (error) return serverError(error.message)
  return created(data)
}
