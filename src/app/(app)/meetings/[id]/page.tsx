import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createClient } from '@/lib/supabase/server'
import { getMeeting, getMeetingParticipants } from '@/lib/actions/meetings'
import { formatDate } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import SoftDeleteButton from '@/components/SoftDeleteButton'
import ParticipantManager from '@/components/ParticipantManager'
import FlagFollowUpButton from '@/components/FlagFollowUpButton'

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [meeting, participants] = await Promise.all([
    getMeeting(id).catch(() => null),
    getMeetingParticipants(id),
  ])

  if (!meeting) notFound()

  const { data: allContacts } = await supabase
    .from('contacts')
    .select('id, name, role')
    .is('deleted_at', null)
    .order('name')

  return (
    <div className="gg-detail">
      <div className="level mb-4">
        <div className="level-left">
          <div>
            <Link href="/meetings" className="is-size-7 has-text-grey">← Meetings</Link>
            <h1 className="title is-3 mt-1 mb-0">{meeting.title}</h1>
            {meeting.deleted_at && <Badge variant="red" className="mt-1">Deleted</Badge>}
          </div>
        </div>
        <div className="level-right">
          <div className="buttons">
            {meeting.company_id && (
              <FlagFollowUpButton meetingId={id} companyId={meeting.company_id} userId={user!.id} />
            )}
            <Link href={`/meetings/${id}/edit`} className="button is-light is-small">Edit</Link>
            {!meeting.deleted_at && (
              <SoftDeleteButton entityType="meeting" id={id} userId={user!.id} />
            )}
          </div>
        </div>
      </div>

      <div className="columns is-variable is-6">
        <div className="column is-two-thirds">
          <div className="box">
            <div className="columns is-multiline is-size-7">
              <div className="column is-half">
                <span className="has-text-grey">Date: </span>
                <span className="has-text-weight-semibold">{formatDate(meeting.date)}</span>
              </div>
              <div className="column is-half">
                <span className="has-text-grey">Company: </span>
                {meeting.company
                  ? <Link href={`/companies/${(meeting.company as { id: string; name: string }).id}`} className="has-text-link">
                      {(meeting.company as { id: string; name: string }).name}
                    </Link>
                  : <span className="has-text-grey">—</span>}
              </div>
              {(meeting as { meetingType?: { name: string } | null }).meetingType && (
                <div className="column is-half">
                  <span className="has-text-grey">Type: </span>
                  <span className="has-text-weight-semibold">
                    {(meeting as { meetingType: { name: string } }).meetingType.name}
                  </span>
                </div>
              )}
            </div>
            {meeting.notes && (
              <div className="mt-3" style={{ borderTop: '1px solid #f5f5f5', paddingTop: '0.75rem' }}>
                <p className="is-size-7 has-text-grey mb-2">Notes</p>
                <div className="content is-size-6">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{meeting.notes ?? ''}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="column">
          <p className="is-size-6 has-text-weight-semibold mb-3">
            Participants ({participants.length})
          </p>
          <ParticipantManager
            meetingId={id}
            participants={participants}
            allContacts={allContacts ?? []}
          />
        </div>
      </div>
    </div>
  )
}
