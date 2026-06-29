import type { NextRequest } from 'next/server'
import { authenticate, hasScope } from '../_lib/auth'
import { ok, created, unauthorized, forbidden, serverError, badRequest } from '../_lib/respond'
import { parseBody, isResponse } from '../_lib/validate'
import { ContactCreateSchema, ContactListQuerySchema } from '@/lib/schemas/contact'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'crm:read')) return forbidden()

  const raw = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = ContactListQuerySchema.safeParse(raw)
  if (!parsed.success) return badRequest('Invalid query parameters')
  const q = parsed.data

  let query = supabaseAdmin
    .from('contacts')
    .select('*, company:companies(id, name)')
    .is('deleted_at', null)
    .order('name')
    .range(q.offset, q.offset + q.limit - 1)

  if (q.q) query = query.ilike('name', `%${q.q}%`)
  if (q.company_id) query = query.eq('company_id', q.company_id)
  if (q.data_status) query = query.eq('data_status', q.data_status)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return ok(data)
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'crm:write')) return forbidden()

  const body = await parseBody(req, ContactCreateSchema)
  if (isResponse(body)) return body

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({ ...body, created_by: ctx.userId, updated_by: ctx.userId })
    .select()
    .single()

  if (error) return serverError(error.message)
  return created(data)
}
