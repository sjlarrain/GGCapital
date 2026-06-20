import { createClient } from '@/lib/supabase/server'
import { getContacts } from '@/lib/actions/contacts'
import { getFollowUpContacts } from '@/lib/actions/interactions'
import { getTagCatalogs } from '@/lib/actions/tags'
import { getCompanies } from '@/lib/actions/companies'
import ContactsTable from './ContactsTable'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [contacts, followUps, tags, companies] = await Promise.all([
    getContacts(),
    getFollowUpContacts(),
    getTagCatalogs(),
    getCompanies(),
  ])

  return (
    <ContactsTable
      contacts={contacts as Parameters<typeof ContactsTable>[0]['contacts']}
      followUpContactIds={followUps.map((f) => f.contact_id)}
      tags={tags}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      userId={user!.id}
    />
  )
}
