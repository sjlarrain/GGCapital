import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContacts } from '@/lib/actions/contacts'
import { getCompanies } from '@/lib/actions/companies'
import { getMeetings } from '@/lib/actions/meetings'
import TrashTable from '@/components/TrashTable'

export const dynamic = 'force-dynamic'

export default async function TrashPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'

  const [contacts, companies, meetings] = await Promise.all([
    getContacts(true),
    getCompanies(true),
    getMeetings(true),
  ])

  return (
    <TrashTable
      contacts={contacts.filter((c) => c.deleted_at).map((c) => ({ id: c.id, label: c.name, deleted_at: c.deleted_at! }))}
      companies={companies.filter((c) => c.deleted_at).map((c) => ({ id: c.id, label: c.name, deleted_at: c.deleted_at! }))}
      meetings={meetings.filter((m) => m.deleted_at).map((m) => ({ id: m.id, label: m.title, deleted_at: m.deleted_at! }))}
      userId={user.id}
      isAdmin={isAdmin}
    />
  )
}
