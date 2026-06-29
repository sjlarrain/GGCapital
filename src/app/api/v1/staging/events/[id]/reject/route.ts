import type { NextRequest } from 'next/server'
import { authenticate, hasScope } from '../../../../_lib/auth'
import { ok, unauthorized, forbidden, notFound, serverError, conflict } from '../../../../_lib/respond'
import { logStagingTransition } from '@/lib/staging/log'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ── POST /staging/events/:id/reject — terminal ────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'staging:write')) return forbidden()

  const { id } = await params

  // Optional rejection note in the body (best-effort; body may be empty).
  let note: string | null = null
  try {
    const body = await req.json()
    if (body && typeof body.note === 'string') note = body.note
  } catch {
    // no body — fine
  }

  const { data: event, error: loadErr } = await supabaseAdmin
    .from('staging_events')
    .select('id, status')
    .eq('id', id)
    .single()

  if (loadErr || !event) return notFound()
  if (event.status === 'promoted' || event.status === 'rejected') {
    return conflict(`Cannot reject a ${event.status} event`)
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('staging_events')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, status')
    .single()

  if (updErr || !updated) return serverError(updErr?.message ?? 'Update failed')

  await logStagingTransition(supabaseAdmin, {
    eventId: id,
    from:    event.status,
    to:      'rejected',
    action:  'reject',
    actor:   ctx.userId,
    detail:  note ? { note } : null,
  })

  return ok(updated)
}
