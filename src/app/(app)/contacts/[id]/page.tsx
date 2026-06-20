import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContact } from '@/lib/actions/contacts'
import { getContactMeetings } from '@/lib/actions/contacts'
import { getInteractionLogs } from '@/lib/actions/interactions'
import Badge from '@/components/ui/Badge'
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
    <div className="gg-detail">
      <div className="level mb-4">
        <div className="level-left">
          <div>
            <Link href="/contacts" className="is-size-7 has-text-grey">← Contacts</Link>
            <h1 className="title is-3 mt-1 mb-0">{contact.name}</h1>
            {contact.deleted_at && <Badge variant="red" className="mt-1">Deleted</Badge>}
          </div>
        </div>
        <div className="level-right">
          <div className="buttons">
            <Link href={`/contacts/${id}/edit`} className="button is-light is-small">Edit</Link>
            {!contact.deleted_at && (
              <SoftDeleteButton entityType="contact" id={id} userId={user!.id} />
            )}
          </div>
        </div>
      </div>

      <div className="box mb-5">
        <div className="columns is-multiline">
          {contact.role && (
            <div className="column is-half">
              <p className="is-size-7 has-text-grey mb-1">Role</p>
              <p className="is-size-6">{contact.role}</p>
            </div>
          )}
          {contact.employer && (
            <div className="column is-half">
              <p className="is-size-7 has-text-grey mb-1">Employer</p>
              <p className="is-size-6">{contact.employer}</p>
            </div>
          )}
          {contact.email && (
            <div className="column is-half">
              <p className="is-size-7 has-text-grey mb-1">Email</p>
              <a href={`mailto:${contact.email}`} className="has-text-link is-size-6">{contact.email}</a>
            </div>
          )}
          {contact.phone && (
            <div className="column is-half">
              <p className="is-size-7 has-text-grey mb-1">Phone</p>
              <a href={`tel:${contact.phone}`} className="has-text-link is-size-6">{contact.phone}</a>
            </div>
          )}
          {contact.expertise && (
            <div className="column is-half">
              <p className="is-size-7 has-text-grey mb-1">Expertise</p>
              <p className="is-size-6">{contact.expertise}</p>
            </div>
          )}
          {contact.company && (
            <div className="column is-half">
              <p className="is-size-7 has-text-grey mb-1">Company</p>
              <Link
                href={`/companies/${(contact.company as { id: string; name: string }).id}`}
                className="has-text-link is-size-6"
              >
                {(contact.company as { id: string; name: string }).name}
              </Link>
            </div>
          )}
        </div>
        {(contact.investment_focus ?? []).length > 0 && (
          <div className="mt-4" style={{ borderTop: '1px solid #f5f5f5', paddingTop: '1rem' }}>
            <p className="is-size-7 has-text-grey mb-2">Investment Focus</p>
            <div className="tags">
              {(contact.investment_focus as string[]).map((f: string) => (
                <Badge key={f} variant="blue">{f}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="is-size-6 has-text-weight-semibold mb-3">Activity timeline</p>
        <ContactTimeline contactId={id} userId={user!.id} entries={entries} />
      </div>
    </div>
  )
}
