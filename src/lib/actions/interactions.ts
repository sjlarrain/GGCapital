'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { InteractionLogInsert } from '@/types'

export async function getInteractionLogs(entityType: 'contact' | 'company', entityId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('interaction_logs')
    .select('*, meeting:meetings(id, title, date)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    // Meeting-linked logs are meeting content (imported meeting notes, or a
    // "flag follow-up from meeting" marker) — the meeting already gets its
    // own title+link row in the timeline, so don't duplicate its content here.
    .is('meeting_id', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createInteractionLog(payload: InteractionLogInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('interaction_logs')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  const basePath = payload.entity_type === 'contact' ? 'contacts' : 'companies'
  revalidatePath(`/${basePath}/${payload.entity_id}`)
  return data
}

export async function getFollowUpContacts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('interaction_logs')
    .select('entity_id, created_at')
    .eq('entity_type', 'contact')
    .eq('follow_up', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  const seen = new Set<string>()
  const ids = (data ?? [])
    .filter((r) => {
      if (seen.has(r.entity_id)) return false
      seen.add(r.entity_id)
      return true
    })
    .map((r) => r.entity_id)
  if (ids.length === 0) return []
  const { data: contacts } = await supabase.from('contacts').select('id, name, email').in('id', ids)
  return ids.map((id) => ({ contact_id: id, contact: contacts?.find((c) => c.id === id) ?? null }))
}

export async function getFollowUps() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('interaction_logs')
    .select('entity_type, entity_id, created_at')
    .eq('follow_up', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  const seen = new Set<string>()
  const rows = (data ?? []).filter((r) => {
    const key = `${r.entity_type}:${r.entity_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const contactIds = rows.filter((r) => r.entity_type === 'contact').map((r) => r.entity_id)
  const companyIds = rows.filter((r) => r.entity_type === 'company').map((r) => r.entity_id)
  const [{ data: contacts }, { data: companies }] = await Promise.all([
    contactIds.length ? supabase.from('contacts').select('id, name').in('id', contactIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    companyIds.length ? supabase.from('companies').select('id, name').in('id', companyIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])
  return rows.map((r) => ({
    entity_type: r.entity_type as 'contact' | 'company',
    entity_id: r.entity_id as string,
    name: (r.entity_type === 'contact' ? contacts : companies)?.find((x) => x.id === r.entity_id)?.name ?? 'Unknown',
  }))
}

export async function flagMeetingFollowUp(meetingId: string, companyId: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('interaction_logs').insert({
    entity_type: 'company',
    entity_id: companyId,
    note: 'Flagged for follow-up from meeting.',
    follow_up: true,
    meeting_id: meetingId,
    file_urls: [],
    links: [],
    created_by: userId,
  })
  if (error) throw error
  revalidatePath(`/meetings/${meetingId}`)
  revalidatePath(`/companies/${companyId}`)
}

export async function getFeedback() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function submitFeedback(description: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('feedback')
    .insert({ description, created_by: userId })
  if (error) throw error
}

export async function setFeedbackDone(id: string, done: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('feedback')
    .update({ done })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/feedback')
}
