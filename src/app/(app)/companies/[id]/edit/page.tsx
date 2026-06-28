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

  const fundTypeIds = new Set(tags.types.filter((t) => ['VC', 'Fund'].includes(t.name)).map((t) => t.id))
  const companyTypeId = tags.types.find((t) => t.name === 'Company')?.id
  const mode = company.type_id && fundTypeIds.has(company.type_id) ? 'fund' as const
    : company.type_id === companyTypeId ? 'company' as const
    : 'investor' as const
  const editTitle = mode === 'fund' ? 'Edit Fund'
    : mode === 'investor' ? 'Edit Investor'
    : 'Edit Company'

  return (
    <div className="gg-detail">
      <h1 className="title is-3 mb-5">{editTitle}</h1>
      <CompanyForm company={company} tags={tags} userId={user!.id} mode={mode} />
    </div>
  )
}
