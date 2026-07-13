'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { classifyEvent } from '@/lib/staging/rules'
import { logStagingTransition } from '@/lib/staging/log'
import {
  promoteStagingEvent as promoteViaRpc,
  StagingNotReadyError,
  StagingNothingToPromoteError,
} from '@/lib/staging/promote'
import type { StagingStatus } from '@/lib/schemas/staging'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return { supabase, user }
}

export async function getStagingEvents(status?: StagingStatus) {
  const supabase = await createClient()
  let query = supabase
    .from('staging_events')
    .select('*')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getStagingEvent(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staging_events')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getStagingEventLog(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staging_event_log')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Resolve a needs_info event by editing the proposed company/contact, then re-classify. */
export async function updateProposedLinks(
  id: string,
  proposedLinks: Record<string, unknown>
) {
  const { supabase } = await requireUser()
  const { error } = await supabase
    .from('staging_events')
    .update({ proposed_links: proposedLinks })
    .eq('id', id)
  if (error) throw error
  revalidatePath(`/triage/${id}`)
  return classifyStagingEvent(id)
}

/** Run hard gates + confidence rules → classified | needs_info | ready. */
export async function classifyStagingEvent(id: string) {
  const { supabase, user } = await requireUser()

  const { data: event, error: loadErr } = await supabase
    .from('staging_events')
    .select('*')
    .eq('id', id)
    .single()
  if (loadErr || !event) throw new Error('Event not found')
  if (event.status === 'promoted' || event.status === 'rejected') {
    throw new Error(`Cannot classify a ${event.status} event`)
  }

  const result = classifyEvent({
    event_class:    event.event_class,
    confidence:     event.confidence,
    extracted:      event.extracted,
    proposed_links: event.proposed_links,
  })

  const { error: updErr } = await supabase
    .from('staging_events')
    .update({
      status:           result.status,
      event_class:      result.event_class,
      confidence:       result.confidence,
      blocking_reasons: result.blocking_reasons,
      classified_by:    user.id,
    })
    .eq('id', id)
  if (updErr) throw updErr

  await logStagingTransition(supabase, {
    eventId: id,
    from:    event.status,
    to:      result.status,
    action:  'classify',
    actor:   user.id,
    detail:  { blocking_reasons: result.blocking_reasons, confidence: result.confidence },
  })

  revalidatePath('/triage')
  revalidatePath(`/triage/${id}`)
  return result
}

/**
 * Promote from the Triage UI. The reviewer is always human here, so the
 * agent/auto-promote gate does not apply — only the status === 'ready' gate,
 * enforced both here and (race-safely) inside the RPC. Promotion writes into
 * the real CRM tables, so it stays admin-only, mirroring the REST API's
 * staging:promote scope restriction.
 */
export async function promoteStagingEventAction(id: string) {
  const { supabase, user } = await requireUser()
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Admin only')
  try {
    const result = await promoteViaRpc(id, user.id)
    revalidatePath('/triage')
    revalidatePath(`/triage/${id}`)
    return result
  } catch (e) {
    if (e instanceof StagingNotReadyError || e instanceof StagingNothingToPromoteError) {
      throw new Error(e.message)
    }
    throw e
  }
}

export async function rejectStagingEvent(id: string, note?: string) {
  const { supabase, user } = await requireUser()

  const { data: event, error: loadErr } = await supabase
    .from('staging_events')
    .select('id, status')
    .eq('id', id)
    .single()
  if (loadErr || !event) throw new Error('Event not found')
  if (event.status === 'promoted' || event.status === 'rejected') {
    throw new Error(`Cannot reject a ${event.status} event`)
  }

  const { error } = await supabase
    .from('staging_events')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error

  await logStagingTransition(supabase, {
    eventId: id,
    from:    event.status,
    to:      'rejected',
    action:  'reject',
    actor:   user.id,
    detail:  note ? { note } : null,
  })

  revalidatePath('/triage')
  revalidatePath(`/triage/${id}`)
}
