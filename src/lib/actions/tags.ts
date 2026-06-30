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
  meetingTypes: 'tag_meeting_types',
} as const

type CatalogKey = keyof typeof TABLES

export async function getTagCatalogs() {
  const supabase = await createClient()
  const [industries, regions, stages, types, statuses, meetingTypes] = await Promise.all([
    supabase.from('tag_industries').select('*').order('name'),
    supabase.from('tag_regions').select('*').order('name'),
    supabase.from('tag_stages').select('*').order('name'),
    supabase.from('tag_types').select('*').order('name'),
    supabase.from('tag_statuses').select('*').order('name'),
    supabase.from('tag_meeting_types').select('*').order('name'),
  ])
  return {
    industries: industries.data ?? [],
    regions: regions.data ?? [],
    stages: stages.data ?? [],
    types: types.data ?? [],
    statuses: statuses.data ?? [],
    meetingTypes: meetingTypes.data ?? [],
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

const PROTECTED_TAGS: Partial<Record<CatalogKey, string[]>> = {
  types: ['VC', 'Fund', 'Company'],
}

export async function deleteTag(catalog: CatalogKey, id: string) {
  const supabase = await createClient()

  if (PROTECTED_TAGS[catalog]) {
    const { data } = await supabase.from(TABLES[catalog]).select('name').eq('id', id).single()
    if (data && PROTECTED_TAGS[catalog]!.includes(data.name)) {
      throw new Error(`"${data.name}" is required by the app and cannot be deleted.`)
    }
  }

  const { error, count } = await supabase
    .from(TABLES[catalog])
    .delete({ count: 'exact' })
    .eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Delete was blocked — tag may still be in use or permissions are missing.')
  revalidatePath('/tags')
}
