'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { InteractionLogInsert } from '@/types'

export async function getInteractionLogs(contactId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('interaction_logs')
    .select('*, meeting:meetings(id, title, date)')
    .eq('contact_id', contactId)
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
  revalidatePath(`/contacts/${payload.contact_id}`)
  return data
}

export async function getFollowUpContacts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('interaction_logs')
    .select('contact_id, contact:contacts(id, name, email)')
    .eq('follow_up', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  // dedupe by contact_id
  const seen = new Set<string>()
  return (data ?? []).filter((r) => {
    if (seen.has(r.contact_id)) return false
    seen.add(r.contact_id)
    return true
  })
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
