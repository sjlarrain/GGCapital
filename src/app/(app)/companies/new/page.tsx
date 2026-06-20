import { createClient } from '@/lib/supabase/server'
import { getTagCatalogs } from '@/lib/actions/tags'
import CompanyForm from '@/components/forms/CompanyForm'

export default async function NewCompanyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tags = await getTagCatalogs()

  return (
    <div className="gg-detail">
      <h1 className="title is-3 mb-5">New Company</h1>
      <CompanyForm tags={tags} userId={user!.id} />
    </div>
  )
}
