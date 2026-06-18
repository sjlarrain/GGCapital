'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import { createMeeting, updateMeeting, setMeetingParticipants } from '@/lib/actions/meetings'
import { createCompany } from '@/lib/actions/companies'
import { createContact } from '@/lib/actions/contacts'
import type { Meeting } from '@/types'

interface MeetingFormProps {
  meeting?: Meeting
  companies: { id: string; name: string }[]
  contacts: { id: string; name: string; role: string | null }[]
  userId: string
  defaultCompanyId?: string
  initialParticipantIds?: string[]
}

export default function MeetingForm({
  meeting,
  companies,
  contacts,
  userId,
  defaultCompanyId,
  initialParticipantIds = [],
}: MeetingFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState(meeting?.title ?? '')
  const [date, setDate] = useState(meeting?.date ?? new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState(meeting?.notes ?? '')
  const [companyId, setCompanyId] = useState(meeting?.company_id ?? defaultCompanyId ?? '')
  const [participantIds, setParticipantIds] = useState<string[]>(initialParticipantIds)
  const [companyList, setCompanyList] = useState(companies)
  const [contactList, setContactList] = useState(contacts)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Quick-create state
  const [newCompanyName, setNewCompanyName] = useState('')
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [creatingContact, setCreatingContact] = useState(false)

  const toggleParticipant = (id: string) =>
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )

  const handleQuickCreateCompany = async () => {
    if (!newCompanyName.trim()) return
    const c = await createCompany({
      name: newCompanyName.trim(),
      description: null,
      industry_ids: [],
      region_ids: [],
      stage_id: null,
      type_id: null,
      status_id: null,
      created_by: userId,
      updated_by: userId,
      deleted_at: null,
    })
    setCompanyList((prev) => [...prev, { id: c.id, name: c.name }])
    setCompanyId(c.id)
    setNewCompanyName('')
    setCreatingCompany(false)
  }

  const handleQuickCreateContact = async () => {
    if (!newContactName.trim()) return
    const c = await createContact({
      name: newContactName.trim(),
      role: null,
      employer: null,
      phone: null,
      email: null,
      expertise: null,
      company_id: companyId || null,
      industry_ids: [],
      region_ids: [],
      created_by: userId,
      updated_by: userId,
      deleted_at: null,
    })
    setContactList((prev) => [...prev, { id: c.id, name: c.name, role: null }])
    setParticipantIds((prev) => [...prev, c.id])
    setNewContactName('')
    setCreatingContact(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) { setError('A company is required for every meeting.'); return }
    if (!title.trim()) { setError('Meeting title is required.'); return }
    setSaving(true)
    setError('')
    try {
      let meetingId: string
      if (meeting) {
        await updateMeeting(meeting.id, {
          title: title.trim(),
          date,
          notes: notes.trim() || null,
          company_id: companyId,
          updated_by: userId,
        })
        meetingId = meeting.id
      } else {
        const created = await createMeeting({
          title: title.trim(),
          date,
          notes: notes.trim() || null,
          company_id: companyId,
          created_by: userId,
          updated_by: userId,
          deleted_at: null,
        })
        meetingId = created.id
      }
      await setMeetingParticipants(meetingId, participantIds)
      router.push(`/meetings/${meetingId}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      {error && <Alert type="error">{error}</Alert>}

      <Input id="title" label="Meeting title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <Input id="date" label="Date *" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

      {/* Company — mandatory */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <select
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            required
          >
            <option value="">Select company…</option>
            {companyList.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Button type="button" variant="secondary" size="sm" onClick={() => setCreatingCompany(true)}>
            + New
          </Button>
        </div>
        {creatingCompany && (
          <div className="flex gap-2 mt-2">
            <Input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="New company name" />
            <Button type="button" size="sm" onClick={handleQuickCreateCompany}>Create</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingCompany(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {/* Participants */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">Participants</label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingContact(true)}>
            + Quick add contact
          </Button>
        </div>
        {creatingContact && (
          <div className="flex gap-2 mb-2">
            <Input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder="New contact name" />
            <Button type="button" size="sm" onClick={handleQuickCreateContact}>Create</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingContact(false)}>Cancel</Button>
          </div>
        )}
        <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto divide-y divide-gray-100">
          {contactList.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">No contacts yet.</p>
          )}
          {contactList.map((c) => (
            <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={participantIds.includes(c.id)}
                onChange={() => toggleParticipant(c.id)}
                className="rounded"
              />
              <span className="text-sm">
                {c.name}
                {c.role && <span className="text-gray-400 ml-1">· {c.role}</span>}
              </span>
            </label>
          ))}
        </div>
        {participantIds.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">{participantIds.length} selected</p>
        )}
      </div>

      <Textarea id="notes" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : meeting ? 'Update Meeting' : 'Create Meeting'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  )
}
