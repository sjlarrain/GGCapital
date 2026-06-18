import { createClient } from '@/lib/supabase/server'
import { getTagCatalogs } from '@/lib/actions/tags'
import CompanyForm from '@/components/forms/CompanyForm'

export default async function NewCompanyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tags = await getTagCatalogs()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Company</h1>
      <CompanyForm tags={tags} userId={user!.id} />
    </div>
  )
}
