import { createClient } from '@/lib/supabase/server'
import { getCompanies } from '@/lib/actions/companies'
import { getContacts } from '@/lib/actions/contacts'
import MeetingForm from '@/components/forms/MeetingForm'

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>
}) {
  const { company: defaultCompanyId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [companies, contacts] = await Promise.all([
    getCompanies(),
    getContacts(),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Meeting</h1>
      <MeetingForm
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, role: c.role }))}
        userId={user!.id}
        defaultCompanyId={defaultCompanyId}
      />
    </div>
  )
}
