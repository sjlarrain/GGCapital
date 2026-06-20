'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Alert from '@/components/ui/Alert'
import Modal from '@/components/ui/Modal'
import Autocomplete from '@/components/Autocomplete'
import { createMeeting, updateMeeting, setMeetingParticipants } from '@/lib/actions/meetings'
import type { Meeting, TagCatalogs } from '@/types'

// Lazy-loaded to avoid circular deps at module level
type CompanyFormType = React.ComponentType<{
  tags: TagCatalogs
  userId: string
  onSuccess?: (created?: { id: string; name: string }) => void
}>
type ContactFormType = React.ComponentType<{
  tags: TagCatalogs
  companies: { id: string; name: string }[]
  userId: string
  onSuccess?: () => void
}>

interface MeetingFormProps {
  meeting?: Meeting
  companies: { id: string; name: string }[]
  contacts: { id: string; name: string; role: string | null }[]
  meetingTypes: { id: string; name: string }[]
  tags: TagCatalogs
  userId: string
  defaultCompanyId?: string
  defaultTypeId?: string
  initialParticipantIds?: string[]
  onSuccess?: () => void
}

export default function MeetingForm({
  meeting,
  companies,
  contacts,
  meetingTypes,
  tags,
  userId,
  defaultCompanyId,
  defaultTypeId,
  initialParticipantIds = [],
  onSuccess,
}: MeetingFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState(meeting?.title ?? '')
  const [date, setDate] = useState(meeting?.date ?? new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState(meeting?.notes ?? '')
  const [companyId, setCompanyId] = useState(meeting?.company_id ?? defaultCompanyId ?? '')
  const [typeId, setTypeId] = useState(meeting?.type_id ?? defaultTypeId ?? '')
  const [participantIds, setParticipantIds] = useState<string[]>(initialParticipantIds)
  const [companyList, setCompanyList] = useState(companies)
  const [contactList, setContactList] = useState(contacts)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Participants search
  const [participantQuery, setParticipantQuery] = useState('')
  const [participantDropOpen, setParticipantDropOpen] = useState(false)
  const participantRef = useRef<HTMLDivElement>(null)

  // Sub-create modals
  const [newCompanyOpen, setNewCompanyOpen] = useState(false)
  const [newContactOpen, setNewContactOpen] = useState(false)
  const [CompanyForm, setCompanyForm] = useState<CompanyFormType | null>(null)
  const [ContactForm, setContactForm] = useState<ContactFormType | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (participantRef.current && !participantRef.current.contains(e.target as Node)) {
        setParticipantDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openNewCompany = async () => {
    if (!CompanyForm) {
      const mod = await import('./CompanyForm')
      setCompanyForm(() => mod.default as CompanyFormType)
    }
    setNewCompanyOpen(true)
  }

  const openNewContact = async () => {
    if (!ContactForm) {
      const mod = await import('./ContactForm')
      setContactForm(() => mod.default as ContactFormType)
    }
    setNewContactOpen(true)
  }

  const handleCompanyCreated = (created?: { id: string; name: string }) => {
    if (created) {
      setCompanyList((prev) => [...prev, created])
      setCompanyId(created.id)
    }
    setNewCompanyOpen(false)
  }

  const handleContactCreated = () => {
    setNewContactOpen(false)
    // contacts list will refresh on page reload; optimistically no-op here
  }

  const toggleParticipant = (id: string) => {
    setParticipantIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])
  }

  const removeParticipant = (id: string) => {
    setParticipantIds((prev) => prev.filter((p) => p !== id))
  }

  const filteredContacts = participantQuery
    ? contactList.filter(
        (c) =>
          !participantIds.includes(c.id) &&
          (c.name.toLowerCase().includes(participantQuery.toLowerCase()) ||
            (c.role ?? '').toLowerCase().includes(participantQuery.toLowerCase()))
      ).slice(0, 12)
    : contactList.filter((c) => !participantIds.includes(c.id)).slice(0, 12)

  const selectedContacts = contactList.filter((c) => participantIds.includes(c.id))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
          company_id: companyId || null,
          type_id: typeId || null,
          updated_by: userId,
        })
        meetingId = meeting.id
      } else {
        const created = await createMeeting({
          title: title.trim(),
          date,
          notes: notes.trim() || null,
          company_id: companyId || null,
          type_id: typeId || null,
          created_by: userId,
          updated_by: userId,
          deleted_at: null,
        })
        meetingId = created.id
      }
      await setMeetingParticipants(meetingId, participantIds)
      if (onSuccess) onSuccess()
      else router.push(`/meetings/${meetingId}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const companyOptions = companyList.map((c) => ({ id: c.id, label: c.name }))
  const typeOptions = meetingTypes.map((t) => ({ id: t.id, label: t.name }))

  return (
    <>
      <form onSubmit={handleSubmit}>
        {error && <Alert type="error" className="mb-4">{error}</Alert>}

        <div className="field">
          <label className="label">Meeting title *</label>
          <div className="control">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
        </div>

        <div className="columns">
          <div className="column">
            <div className="field">
              <label className="label">Date *</label>
              <div className="control">
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>
          </div>
          <div className="column">
            <div className="field">
              <label className="label">Type</label>
              <Autocomplete
                options={typeOptions}
                value={typeId}
                onChange={setTypeId}
                placeholder="Select type…"
                clearLabel="No type"
              />
            </div>
          </div>
        </div>

        <div className="field">
          <label className="label">Company</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Autocomplete
                options={companyOptions}
                value={companyId}
                onChange={setCompanyId}
                placeholder="Search companies…"
                clearLabel="No company"
              />
            </div>
            <button type="button" className="button is-light is-small" style={{ marginBottom: 0 }} onClick={openNewCompany}>
              + New
            </button>
          </div>
        </div>

        {/* Participants */}
        <div className="field">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label className="label mb-0">Participants</label>
            <button type="button" className="button is-ghost is-small" onClick={openNewContact}>
              + New Contact
            </button>
          </div>

          {/* Selected tags */}
          {selectedContacts.length > 0 && (
            <div className="tags mb-2">
              {selectedContacts.map((c) => (
                <span key={c.id} className="tag is-info is-light">
                  {c.name}
                  <button type="button" className="delete is-small" onClick={() => removeParticipant(c.id)} />
                </span>
              ))}
            </div>
          )}

          {/* Search input + dropdown */}
          <div ref={participantRef} style={{ position: 'relative' }}>
            <div className="control">
              <input
                className="input"
                placeholder="Search contacts to add…"
                value={participantQuery}
                onChange={(e) => { setParticipantQuery(e.target.value); setParticipantDropOpen(true) }}
                onFocus={() => setParticipantDropOpen(true)}
                autoComplete="off"
              />
            </div>
            {participantDropOpen && (
              <div className="gg-tag-dropdown" style={{ width: '100%' }}>
                {filteredContacts.length === 0 && (
                  <p className="has-text-grey is-size-7 px-3 py-2">
                    {participantQuery ? 'No results' : 'All contacts already added'}
                  </p>
                )}
                {filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="button is-ghost is-small"
                    style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '0.35rem 0.75rem' }}
                    onClick={() => { toggleParticipant(c.id); setParticipantQuery(''); setParticipantDropOpen(false) }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.75rem' }}>{c.name}</div>
                      {c.role && <div style={{ fontSize: '0.7rem', color: '#888' }}>{c.role}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {participantIds.length > 0 && (
            <p className="help">{participantIds.length} participant{participantIds.length > 1 ? 's' : ''} selected</p>
          )}
        </div>

        <div className="field">
          <label className="label">Notes</label>
          <div className="control">
            <textarea className="textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="field mt-4">
          <div className="buttons">
            <button type="submit" className="button is-primary" disabled={saving}>
              {saving ? 'Saving…' : meeting ? 'Update Meeting' : 'Log Meeting'}
            </button>
            <button type="button" className="button is-light" onClick={() => onSuccess ? onSuccess() : router.back()}>
              Cancel
            </button>
          </div>
        </div>
      </form>

      <Modal open={newCompanyOpen} onClose={() => setNewCompanyOpen(false)} title="New Company" wide>
        {CompanyForm && (
          <CompanyForm tags={tags} userId={userId} onSuccess={handleCompanyCreated} />
        )}
      </Modal>

      <Modal open={newContactOpen} onClose={() => setNewContactOpen(false)} title="New Contact" wide>
        {ContactForm && (
          <ContactForm tags={tags} companies={companyList} userId={userId} onSuccess={handleContactCreated} />
        )}
      </Modal>
    </>
  )
}
