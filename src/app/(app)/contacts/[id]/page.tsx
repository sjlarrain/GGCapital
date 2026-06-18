import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContact, softDeleteContact } from '@/lib/actions/contacts'
import { getContactMeetings } from '@/lib/actions/contacts'
import { getInteractionLogs } from '@/lib/actions/interactions'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import SoftDeleteButton from '@/components/SoftDeleteButton'
import ContactTimeline from '@/components/ContactTimeline'

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [contact, meetings, logs] = await Promise.all([
    getContact(id).catch(() => null),
    getContactMeetings(id),
    getInteractionLogs(id),
  ])

  if (!contact) notFound()

  type MeetingRow = { id: string; title: string; date: string }
  // Build combined chronological timeline
  const entries = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(meetings as any[]).map((m: MeetingRow) => ({
      type: 'meeting' as const,
      date: m.date,
      meetingId: m.id,
      meetingTitle: m.title,
    })),
    ...logs.map((l) => ({
      type: 'log' as const,
      date: l.created_at,
      log: l,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/contacts" className="text-sm text-gray-500 hover:underline">← Contacts</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{contact.name}</h1>
          {contact.deleted_at && <Badge variant="red" className="mt-1">Deleted</Badge>}
        </div>
        <div className="flex gap-2">
          <Link href={`/contacts/${id}/edit`}>
            <Button variant="secondary" size="sm">Edit</Button>
          </Link>
          {!contact.deleted_at && (
            <SoftDeleteButton entityType="contact" id={id} userId={user!.id} />
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {contact.role && (
            <><dt className="text-gray-500">Role</dt><dd>{contact.role}</dd></>
          )}
          {contact.employer && (
            <><dt className="text-gray-500">Employer</dt><dd>{contact.employer}</dd></>
          )}
          {contact.email && (
            <><dt className="text-gray-500">Email</dt><dd><a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a></dd></>
          )}
          {contact.phone && (
            <><dt className="text-gray-500">Phone</dt><dd><a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">{contact.phone}</a></dd></>
          )}
          {contact.expertise && (
            <><dt className="text-gray-500">Expertise</dt><dd>{contact.expertise}</dd></>
          )}
          {contact.company && (
            <><dt className="text-gray-500">Company</dt>
            <dd>
              <Link href={`/companies/${(contact.company as { id: string; name: string }).id}`} className="text-blue-600 hover:underline">
                {(contact.company as { id: string; name: string }).name}
              </Link>
            </dd></>
          )}
        </dl>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Activity timeline</h2>
        <ContactTimeline
          contactId={id}
          userId={user!.id}
          entries={entries}
        />
      </div>
    </div>
  )
}
