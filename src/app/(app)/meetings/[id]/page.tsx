import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMeeting, getMeetingParticipants } from '@/lib/actions/meetings'
import { formatDate } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import SoftDeleteButton from '@/components/SoftDeleteButton'
import ParticipantManager from '@/components/ParticipantManager'

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
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/meetings" className="text-sm text-gray-500 hover:underline">← Meetings</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{meeting.title}</h1>
          {meeting.deleted_at && <Badge variant="red" className="mt-1">Deleted</Badge>}
        </div>
        <div className="flex gap-2">
          <Link href={`/meetings/${id}/edit`}>
            <Button variant="secondary" size="sm">Edit</Button>
          </Link>
          {!meeting.deleted_at && (
            <SoftDeleteButton entityType="meeting" id={id} userId={user!.id} />
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Date: </span>
            <span className="font-medium">{formatDate(meeting.date)}</span>
          </div>
          <div>
            <span className="text-gray-500">Company: </span>
            {meeting.company
              ? <Link href={`/companies/${(meeting.company as { id: string; name: string }).id}`} className="text-blue-600 hover:underline">{(meeting.company as { id: string; name: string }).name}</Link>
              : <span className="text-gray-400">—</span>}
          </div>
          {(meeting as { meetingType?: { name: string } | null }).meetingType && (
            <div>
              <span className="text-gray-500">Type: </span>
              <span className="font-medium">{(meeting as { meetingType: { name: string } }).meetingType.name}</span>
            </div>
          )}
        </div>
        {meeting.notes && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-600 mb-1">Notes</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{meeting.notes}</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Participants ({participants.length})
        </h2>
        <ParticipantManager
          meetingId={id}
          participants={participants}
          allContacts={allContacts ?? []}
        />
      </div>
    </div>
  )
}
