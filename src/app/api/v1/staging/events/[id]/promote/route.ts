import type { NextRequest } from 'next/server'
import { authenticate, hasScope, isAgent } from '../../../../_lib/auth'
import { ok, unauthorized, forbidden, notFound, serverError, conflict } from '../../../../_lib/respond'
import { isAutoPromoteEnabled } from '@/lib/staging/config'
import {
  promoteStagingEvent,
  StagingNotReadyError,
  StagingNothingToPromoteError,
} from '@/lib/staging/promote'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ── POST /staging/events/:id/promote ──────────────────────────────────────────
// Blocks (409) when status ≠ ready, or when an agent (PAT) promotes while the
// auto-promote flag is off. Otherwise performs the transactional create + logs.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'staging:promote')) return forbidden()

  const { id } = await params
  const { data: event, error: loadErr } = await supabaseAdmin
    .from('staging_events')
    .select('id, status')
    .eq('id', id)
    .single()

  if (loadErr || !event) return notFound()

  if (event.status !== 'ready') {
    return conflict('Event is not ready for promotion')
  }
  if (isAgent(ctx) && !isAutoPromoteEnabled()) {
    return conflict('Auto-promote is disabled; agent promotion requires human review')
  }

  try {
    const result = await promoteStagingEvent(id, ctx.userId)
    return ok(result)
  } catch (e) {
    if (e instanceof StagingNotReadyError) return conflict(e.message)
    if (e instanceof StagingNothingToPromoteError) return conflict(e.message)
    if (e instanceof Error && e.message === 'STAGING_NOT_FOUND') return notFound()
    return serverError(e instanceof Error ? e.message : 'Promotion failed')
  }
}
