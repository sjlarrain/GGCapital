import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompany } from '@/lib/actions/companies'
import { getTagCatalogs } from '@/lib/actions/tags'
import CompanyForm from '@/components/forms/CompanyForm'

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [company, tags] = await Promise.all([
    getCompany(id).catch(() => null),
    getTagCatalogs(),
  ])

  if (!company) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Company</h1>
      <CompanyForm company={company} tags={tags} userId={user!.id} />
    </div>
  )
}
