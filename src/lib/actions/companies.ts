'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CompanyInsert, CompanyUpdate } from '@/types'

export async function getCompanies(includeDeleted = false) {
  const supabase = await createClient()
  let query = supabase
    .from('companies')
    .select('*')
    .order('name')

  if (!includeDeleted) query = query.is('deleted_at', null)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getCompany(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createCompany(payload: CompanyInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  revalidatePath('/companies')
  return data
}

export async function updateCompany(id: string, payload: CompanyUpdate) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  revalidatePath('/companies')
  revalidatePath(`/companies/${id}`)
  return data
}

export async function softDeleteCompany(id: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('companies')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/companies')
}

export async function restoreCompany(id: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('companies')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/companies')
}

export async function checkCompanyDuplicate(name: string, excludeId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('companies')
    .select('id, name')
    .ilike('name', name)
    .is('deleted_at', null)
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query
  return data ?? []
}
