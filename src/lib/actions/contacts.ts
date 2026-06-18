'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ContactInsert, ContactUpdate } from '@/types'

export async function getContacts(includeDeleted = false) {
  const supabase = await createClient()
  let query = supabase
    .from('contacts')
    .select('*, company:companies(id, name)')
    .order('name')

  if (!includeDeleted) query = query.is('deleted_at', null)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getContact(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contacts')
    .select('*, company:companies(id, name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getContactMeetings(contactId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meeting_participants')
    .select('meeting:meetings(*, company:companies(id, name))')
    .eq('contact_id', contactId)
    .is('meeting.deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => r.meeting).filter(Boolean)
}

export async function createContact(payload: ContactInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contacts')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  revalidatePath('/contacts')
  return data
}

export async function updateContact(id: string, payload: ContactUpdate) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contacts')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  revalidatePath('/contacts')
  revalidatePath(`/contacts/${id}`)
  return data
}

export async function softDeleteContact(id: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('contacts')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/contacts')
}

export async function restoreContact(id: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('contacts')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/contacts')
}

export async function checkContactDuplicate(name: string, excludeId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('contacts')
    .select('id, name')
    .ilike('name', name)
    .is('deleted_at', null)
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query
  return data ?? []
}
