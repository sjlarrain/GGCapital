import { createClient } from '@/lib/supabase/server'
import { getTagCatalogs } from '@/lib/actions/tags'
import { getCompanies } from '@/lib/actions/companies'
import ContactForm from '@/components/forms/ContactForm'

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>
}) {
  const { company: defaultCompanyId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [tags, companies] = await Promise.all([
    getTagCatalogs(),
    getCompanies(),
  ])

  return (
    <div className="gg-detail">
      <h1 className="title is-3 mb-5">New Contact</h1>
      <ContactForm
        tags={tags}
        companies={companies.map((c) => ({ id: c.id, name: c.name, industry_ids: c.industry_ids ?? [], region_ids: c.region_ids ?? [], stage_ids: c.stage_ids ?? [] }))}
        userId={user!.id}
        defaultCompanyId={defaultCompanyId}
      />
    </div>
  )
}
