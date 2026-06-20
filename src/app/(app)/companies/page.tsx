import { createClient } from '@/lib/supabase/server'
import { getCompanies } from '@/lib/actions/companies'
import { getTagCatalogs } from '@/lib/actions/tags'
import CompaniesTable from './CompaniesTable'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [companies, tags] = await Promise.all([getCompanies(), getTagCatalogs()])

  return (
    <CompaniesTable
      companies={companies as Parameters<typeof CompaniesTable>[0]['companies']}
      tags={tags}
      userId={user!.id}
    />
  )
}
