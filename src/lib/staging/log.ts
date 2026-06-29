/**
 * Append-only audit logger for staging transitions.
 *
 * Every status change (and the initial ingest) writes one row to
 * staging_event_log. Both the REST routes (supabaseAdmin) and the Triage
 * server actions (request-scoped client) call this, so it accepts any client
 * exposing `.from(...).insert(...)`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StagingStatus } from '@/lib/schemas/staging'

// Accepts both the service-role client and the request-scoped SSR client.
type InsertableClient = Pick<SupabaseClient, 'from'>

export interface TransitionLog {
  eventId: string
  from: StagingStatus | null
  to: StagingStatus | null
  action: string
  actor: string | null
  detail?: Record<string, unknown> | null
}

export async function logStagingTransition(
  client: InsertableClient,
  { eventId, from, to, action, actor, detail }: TransitionLog
): Promise<void> {
  await client.from('staging_event_log').insert({
    event_id:    eventId,
    from_status: from,
    to_status:   to,
    action,
    detail:      detail ?? null,
    actor,
  })
}
