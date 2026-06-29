import type { NextRequest } from 'next/server'
import { authenticate, hasScope } from '../../_lib/auth'
import { ok, noContent, unauthorized, forbidden, notFound, serverError } from '../../_lib/respond'
import { parseBody, isResponse } from '../../_lib/validate'
import { MeetingUpdateSchema } from '@/lib/schemas/meeting'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'crm:read')) return forbidden()

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('meetings')
    .select('*, company:companies(id, name), meetingType:tag_meeting_types(id, name), participants:meeting_participants(contact:contacts(id, name, email))')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) return notFound()
  return ok(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'crm:write')) return forbidden()

  const { id } = await params
  const body = await parseBody(req, MeetingUpdateSchema)
  if (isResponse(body)) return body

  const { data, error } = await supabaseAdmin
    .from('meetings')
    .update({ ...body, updated_by: ctx.userId })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error || !data) return notFound()
  return ok(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (ctx.role !== 'admin') return forbidden()

  const { id } = await params
  const { error } = await supabaseAdmin
    .from('meetings')
    .update({ deleted_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return serverError(error.message)
  return noContent()
}
