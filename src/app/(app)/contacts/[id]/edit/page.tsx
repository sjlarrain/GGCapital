import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContact } from '@/lib/actions/contacts'
import { getTagCatalogs } from '@/lib/actions/tags'
import { getCompanies } from '@/lib/actions/companies'
import ContactForm from '@/components/forms/ContactForm'

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [contact, tags, companies] = await Promise.all([
    getContact(id).catch(() => null),
    getTagCatalogs(),
    getCompanies(),
  ])

  if (!contact) notFound()

  return (
    <div className="gg-detail">
      <h1 className="title is-3 mb-5">Edit Contact</h1>
      <ContactForm
        contact={contact}
        tags={tags}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        userId={user!.id}
      />
    </div>
  )
}
