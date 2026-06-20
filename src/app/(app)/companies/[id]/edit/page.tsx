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
    <div className="gg-detail">
      <h1 className="title is-3 mb-5">Edit Company</h1>
      <CompanyForm company={company} tags={tags} userId={user!.id} />
    </div>
  )
}
