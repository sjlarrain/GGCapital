import { createClient } from '@/lib/supabase/server'
import { getFollowUpContacts } from '@/lib/actions/interactions'
import { getTagCatalogs } from '@/lib/actions/tags'
import { getCompanies } from '@/lib/actions/companies'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [companyCnt, contactCnt, meetingCnt, followUps, tags, companies] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('meetings').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    getFollowUpContacts(),
    getTagCatalogs(),
    getCompanies(),
  ])

  const { data: contactRows } = await supabase
    .from('contacts')
    .select('id, name, role')
    .is('deleted_at', null)
    .order('name')

  const stats = [
    { label: 'Companies', count: companyCnt.count ?? 0, href: '/companies', icon: '🏢' },
    { label: 'Contacts', count: contactCnt.count ?? 0, href: '/contacts', icon: '👤' },
    { label: 'Meetings', count: meetingCnt.count ?? 0, href: '/meetings', icon: '📅' },
    { label: 'Follow-ups due', count: followUps.length, href: '/contacts?filter=followup', icon: '🔔' },
  ]

  return (
    <DashboardClient
      stats={stats}
      followUps={followUps}
      tags={tags}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      contacts={(contactRows ?? []).map((c) => ({ id: c.id, name: c.name, role: c.role }))}
      userId={user!.id}
    />
  )
}
