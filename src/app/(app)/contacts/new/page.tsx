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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Contact</h1>
      <ContactForm
        tags={tags}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        userId={user!.id}
        defaultCompanyId={defaultCompanyId}
      />
    </div>
  )
}
