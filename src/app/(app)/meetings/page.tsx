import { createClient } from '@/lib/supabase/server'
import { getMeetings } from '@/lib/actions/meetings'
import { getCompanies } from '@/lib/actions/companies'
import { getTagCatalogs } from '@/lib/actions/tags'
import MeetingsTable from './MeetingsTable'

export default async function MeetingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [meetings, companies, tags] = await Promise.all([
    getMeetings(),
    getCompanies(),
    getTagCatalogs(),
  ])

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, role')
    .is('deleted_at', null)
    .order('name')

  return (
    <MeetingsTable
      meetings={meetings as Parameters<typeof MeetingsTable>[0]['meetings']}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      contacts={(contacts ?? []).map((c) => ({ id: c.id, name: c.name, role: c.role }))}
      meetingTypes={tags.meetingTypes}
      tags={tags}
      userId={user!.id}
    />
  )
}
