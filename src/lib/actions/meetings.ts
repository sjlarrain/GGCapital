'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { MeetingInsert, MeetingUpdate } from '@/types'

export async function getMeetings(includeDeleted = false) {
  const supabase = await createClient()
  let query = supabase
    .from('meetings')
    .select('*, company:companies(id, name), meetingType:tag_meeting_types(id, name)')
    .order('date', { ascending: false })

  if (!includeDeleted) query = query.is('deleted_at', null)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getMeeting(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meetings')
    .select('*, company:companies(id, name), meetingType:tag_meeting_types(id, name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getMeetingParticipants(meetingId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meeting_participants')
    .select('*, contact:contacts(id, name, role, email)')
    .eq('meeting_id', meetingId)
  if (error) throw error
  return data ?? []
}

export async function getCompanyMeetings(companyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createMeeting(payload: MeetingInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meetings')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  revalidatePath('/meetings')
  return data
}

export async function updateMeeting(id: string, payload: MeetingUpdate) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meetings')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  revalidatePath('/meetings')
  revalidatePath(`/meetings/${id}`)
  return data
}

export async function softDeleteMeeting(id: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('meetings')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/meetings')
}

export async function restoreMeeting(id: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('meetings')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/meetings')
}

export async function hardDeleteMeeting(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Admin only')

  const { error } = await supabase.from('meetings').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/meetings')
  revalidatePath('/trash')
}

export async function setMeetingParticipants(meetingId: string, contactIds: string[]) {
  const supabase = await createClient()
  await supabase.from('meeting_participants').delete().eq('meeting_id', meetingId)
  if (contactIds.length === 0) return
  const { error } = await supabase.from('meeting_participants').insert(
    contactIds.map((contact_id) => ({ meeting_id: meetingId, contact_id }))
  )
  if (error) throw error
  revalidatePath(`/meetings/${meetingId}`)
}

export async function addParticipant(meetingId: string, contactId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('meeting_participants')
    .insert({ meeting_id: meetingId, contact_id: contactId })
  if (error && !error.message.includes('duplicate')) throw error
  revalidatePath(`/meetings/${meetingId}`)
}

export async function removeParticipant(meetingId: string, contactId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('meeting_participants')
    .delete()
    .eq('meeting_id', meetingId)
    .eq('contact_id', contactId)
  if (error) throw error
  revalidatePath(`/meetings/${meetingId}`)
}
