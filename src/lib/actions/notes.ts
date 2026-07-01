'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { NoteInsert } from '@/types'

export async function getNotes(entityType: 'contact' | 'company', entityId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createNote(payload: NoteInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notes')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  const basePath = payload.entity_type === 'contact' ? 'contacts' : 'companies'
  revalidatePath(`/${basePath}/${payload.entity_id}`)
  return data
}
