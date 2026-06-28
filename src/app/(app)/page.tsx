import { createClient } from '@/lib/supabase/server'
import { getFollowUpContacts } from '@/lib/actions/interactions'
import { getTagCatalogs } from '@/lib/actions/tags'
import { getCompanies } from '@/lib/actions/companies'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [contactCnt, meetingCnt, followUps, tags, companies] = await Promise.all([
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

  // Split companies by type: Company / Fund (VC, Fund) / Investor (everything else)
  const companyTypeId = tags.types.find((t) => t.name === 'Company')?.id
  const fundTypeIds = new Set(tags.types.filter((t) => ['VC', 'Fund'].includes(t.name)).map((t) => t.id))
  const companiesCount = companies.filter((c) => c.type_id === companyTypeId).length
  const fundsCount = companies.filter((c) => c.type_id != null && fundTypeIds.has(c.type_id)).length
  const investorsCount = companies.filter((c) => !c.type_id || (!fundTypeIds.has(c.type_id) && c.type_id !== companyTypeId)).length

  const stats = [
    { label: 'Companies', count: companiesCount, href: '/companies?view=companies', icon: '🏢' },
    { label: 'Funds', count: fundsCount, href: '/companies?view=funds', icon: '💰' },
    { label: 'Investors & Network', count: investorsCount, href: '/companies?view=investors', icon: '📊' },
    { label: 'Contacts', count: contactCnt.count ?? 0, href: '/contacts', icon: '👤' },
    { label: 'Meetings', count: meetingCnt.count ?? 0, href: '/meetings', icon: '📅' },
    { label: 'Follow-ups due', count: followUps.length, href: '/contacts?filter=followup', icon: '🔔' },
  ]

  return (
    <DashboardClient
      stats={stats}
      followUps={followUps}
      tags={tags}
      companies={companies.map((c) => ({ id: c.id, name: c.name, industry_ids: c.industry_ids ?? [], region_ids: c.region_ids ?? [], stage_ids: c.stage_ids ?? [] }))}
      contacts={(contactRows ?? []).map((c) => ({ id: c.id, name: c.name, role: c.role }))}
      userId={user!.id}
    />
  )
}
