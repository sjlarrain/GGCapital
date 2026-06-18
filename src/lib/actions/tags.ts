'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TagItem } from '@/types'

const TABLES = {
  industries: 'tag_industries',
  regions: 'tag_regions',
  stages: 'tag_stages',
  types: 'tag_types',
  statuses: 'tag_statuses',
} as const

type CatalogKey = keyof typeof TABLES

export async function getTagCatalogs() {
  const supabase = await createClient()
  const [industries, regions, stages, types, statuses] = await Promise.all([
    supabase.from('tag_industries').select('*').order('name'),
    supabase.from('tag_regions').select('*').order('name'),
    supabase.from('tag_stages').select('*').order('name'),
    supabase.from('tag_types').select('*').order('name'),
    supabase.from('tag_statuses').select('*').order('name'),
  ])
  return {
    industries: industries.data ?? [],
    regions: regions.data ?? [],
    stages: stages.data ?? [],
    types: types.data ?? [],
    statuses: statuses.data ?? [],
  }
}

export async function createTag(catalog: CatalogKey, name: string): Promise<TagItem> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from(TABLES[catalog])
    .insert({ name })
    .select()
    .single()
  if (error) throw error
  revalidatePath('/tags')
  return data as TagItem
}

export async function updateTag(catalog: CatalogKey, id: string, name: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from(TABLES[catalog])
    .update({ name })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/tags')
}

export async function deleteTag(catalog: CatalogKey, id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from(TABLES[catalog])
    .delete()
    .eq('id', id)
  if (error) throw error
  revalidatePath('/tags')
}
