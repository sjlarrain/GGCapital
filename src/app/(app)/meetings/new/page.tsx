import { createClient } from '@/lib/supabase/server'
import { getCompanies } from '@/lib/actions/companies'
import { getContacts } from '@/lib/actions/contacts'
import { getTagCatalogs } from '@/lib/actions/tags'
import MeetingForm from '@/components/forms/MeetingForm'

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>
}) {
  const { company: defaultCompanyId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [companies, contacts, tags] = await Promise.all([
    getCompanies(),
    getContacts(),
    getTagCatalogs(),
  ])

  return (
    <div className="gg-detail">
      <h1 className="title is-3 mb-5">Log Meeting</h1>
      <MeetingForm
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, role: c.role }))}
        meetingTypes={tags.meetingTypes}
        tags={tags}
        userId={user!.id}
        defaultCompanyId={defaultCompanyId}
      />
    </div>
  )
}
