import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMeeting, getMeetingParticipants } from '@/lib/actions/meetings'
import { getCompanies } from '@/lib/actions/companies'
import { getContacts } from '@/lib/actions/contacts'
import { getTagCatalogs } from '@/lib/actions/tags'
import MeetingForm from '@/components/forms/MeetingForm'

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [meeting, participants, companies, contacts, tags] = await Promise.all([
    getMeeting(id).catch(() => null),
    getMeetingParticipants(id),
    getCompanies(),
    getContacts(),
    getTagCatalogs(),
  ])

  if (!meeting) notFound()

  return (
    <div className="gg-detail">
      <h1 className="title is-3 mb-5">Edit Meeting</h1>
      <MeetingForm
        meeting={meeting}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, role: c.role }))}
        meetingTypes={tags.meetingTypes}
        tags={tags}
        userId={user!.id}
        defaultTypeId={meeting.type_id ?? undefined}
        initialParticipantIds={participants.map((p) => p.contact_id)}
      />
    </div>
  )
}
