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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Meeting</h1>
      <MeetingForm
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, role: c.role }))}
        meetingTypes={tags.meetingTypes}
        userId={user!.id}
        defaultCompanyId={defaultCompanyId}
      />
    </div>
  )
}
