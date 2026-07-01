import type { NextRequest } from 'next/server'
import { authenticate, hasScope } from '../../../../_lib/auth'
import { ok, unauthorized, forbidden, notFound, serverError, conflict } from '../../../../_lib/respond'
import { classifyEvent } from '@/lib/staging/rules'
import { computeDedupe } from '@/lib/staging/dedupe'
import { logStagingTransition } from '@/lib/staging/log'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ── POST /staging/events/:id/classify ─────────────────────────────────────────
// Runs the hard gates + confidence rules → classified | needs_info | ready.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'staging:write')) return forbidden()

  const { id } = await params
  const { data: event, error: loadErr } = await supabaseAdmin
    .from('staging_events')
    .select('*')
    .eq('id', id)
    .single()

  if (loadErr || !event) return notFound()

  // Terminal states cannot be reclassified.
  if (event.status === 'promoted' || event.status === 'rejected') {
    return conflict(`Cannot classify a ${event.status} event`)
  }

  const dedupe = await computeDedupe(supabaseAdmin, {
    event_class:    event.event_class,
    proposed_links: event.proposed_links,
  })

  const result = classifyEvent({
    event_class:    event.event_class,
    confidence:     event.confidence,
    extracted:      event.extracted,
    proposed_links: event.proposed_links,
    dedupe,
  })

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('staging_events')
    .update({
      status:           result.status,
      event_class:      result.event_class,
      confidence:       result.confidence,
      blocking_reasons: result.blocking_reasons,
      classified_by:    ctx.userId,
    })
    .eq('id', id)
    .select('id, status, event_class, confidence, blocking_reasons')
    .single()

  if (updErr || !updated) return serverError(updErr?.message ?? 'Update failed')

  await logStagingTransition(supabaseAdmin, {
    eventId: id,
    from:    event.status,
    to:      result.status,
    action:  'classify',
    actor:   ctx.userId,
    detail:  { blocking_reasons: result.blocking_reasons, confidence: result.confidence },
  })

  return ok(updated)
}
