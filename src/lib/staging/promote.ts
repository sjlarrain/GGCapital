/**
 * Transactional promotion of a staged event into the official CRM tables.
 *
 * The actual multi-table write (company + contact created together, or not at
 * all) lives in the `promote_staging_event` SQL function (012_staging.sql) so
 * it runs inside a single Postgres transaction — any failure rolls back every
 * write. This module is the thin server-side wrapper: it invokes the RPC and
 * normalises the outcome / errors for callers (REST route + Triage action).
 */

import { supabaseAdmin } from '@/lib/supabase/admin'

export interface PromotedRef {
  table: 'companies' | 'contacts'
  id: string
}

export interface PromoteResult {
  id: string
  status: 'promoted'
  promoted_to: PromotedRef[]
}

/** Thrown when the event is not in a promotable state (maps to HTTP 409). */
export class StagingNotReadyError extends Error {
  constructor(message = 'Event is not ready for promotion') {
    super(message)
    this.name = 'StagingNotReadyError'
  }
}

/** Thrown when there is nothing valid to promote (maps to HTTP 409). */
export class StagingNothingToPromoteError extends Error {
  constructor(message = 'Event has no company or contact to promote') {
    super(message)
    this.name = 'StagingNothingToPromoteError'
  }
}

/**
 * Promote `eventId` as `actorId`. The RPC re-checks `status = 'ready'` under a
 * row lock, so this is race-safe even though callers also pre-check status.
 */
export async function promoteStagingEvent(eventId: string, actorId: string): Promise<PromoteResult> {
  const { data, error } = await supabaseAdmin.rpc('promote_staging_event', {
    p_event_id: eventId,
    p_actor:    actorId,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('STAGING_NOT_READY')) throw new StagingNotReadyError()
    if (msg.includes('STAGING_NOTHING_TO_PROMOTE')) throw new StagingNothingToPromoteError()
    if (msg.includes('STAGING_NOT_FOUND')) throw new Error('STAGING_NOT_FOUND')
    throw new Error(msg || 'Promotion failed')
  }

  return data as PromoteResult
}
