import type { NextRequest } from 'next/server'
import { authenticate, hasScope } from '../_lib/auth'
import { ok, created, unauthorized, forbidden, serverError, badRequest } from '../_lib/respond'
import { parseBody, isResponse } from '../_lib/validate'
import { MeetingCreateSchema, MeetingListQuerySchema } from '@/lib/schemas/meeting'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'crm:read')) return forbidden()

  const raw = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = MeetingListQuerySchema.safeParse(raw)
  if (!parsed.success) return badRequest('Invalid query parameters')
  const q = parsed.data

  let query = supabaseAdmin
    .from('meetings')
    .select('*, company:companies(id, name), meetingType:tag_meeting_types(id, name)')
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .range(q.offset, q.offset + q.limit - 1)

  if (q.company_id) query = query.eq('company_id', q.company_id)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return ok(data)
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'crm:write')) return forbidden()

  const body = await parseBody(req, MeetingCreateSchema)
  if (isResponse(body)) return body

  const { data, error } = await supabaseAdmin
    .from('meetings')
    .insert({ ...body, created_by: ctx.userId, updated_by: ctx.userId })
    .select()
    .single()

  if (error) return serverError(error.message)
  return created(data)
}
