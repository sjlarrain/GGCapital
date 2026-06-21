'use client'
import { useState } from 'react'
import Link from 'next/link'
import { addParticipant, removeParticipant } from '@/lib/actions/meetings'
import SearchableSelect from '@/components/SearchableSelect'

interface Participant {
  id: string
  contact_id: string
  contact: { id: string; name: string; role: string | null; email: string | null } | null
}

interface Props {
  meetingId: string
  participants: Participant[]
  allContacts: { id: string; name: string; role: string | null }[]
}

export default function ParticipantManager({ meetingId, participants, allContacts }: Props) {
  const [list, setList] = useState(participants)
  const [adding, setAdding] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState('')
  const [loading, setLoading] = useState(false)

  const participantContactIds = new Set(list.map((p) => p.contact_id))
  const available = allContacts.filter((c) => !participantContactIds.has(c.id))

  const handleAdd = async () => {
    if (!selectedContactId) return
    setLoading(true)
    await addParticipant(meetingId, selectedContactId)
    const contact = allContacts.find((c) => c.id === selectedContactId)!
    setList((prev) => [
      ...prev,
      {
        id: `${meetingId}-${selectedContactId}`,
        contact_id: selectedContactId,
        contact: { id: contact.id, name: contact.name, role: contact.role, email: null },
      },
    ])
    setSelectedContactId('')
    setAdding(false)
    setLoading(false)
  }

  const handleRemove = async (contactId: string) => {
    await removeParticipant(meetingId, contactId)
    setList((prev) => prev.filter((p) => p.contact_id !== contactId))
  }

  return (
    <div className="box p-0" style={{ overflow: 'visible' }}>
      {list.length === 0 && !adding && (
        <p className="px-4 py-3 is-size-7 has-text-grey" style={{ padding: '0.75rem 1rem' }}>
          No participants added.
        </p>
      )}
      {list.map((p) => (
        <div
          key={p.id}
          className="level"
          style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #f0f0f0', margin: 0 }}
        >
          <div className="level-left">
            <div>
              {p.contact ? (
                <Link href={`/contacts/${p.contact.id}`} className="has-text-link is-size-7 has-text-weight-medium">
                  {p.contact.name}
                </Link>
              ) : (
                <span className="is-size-7 has-text-grey">Unknown contact</span>
              )}
              {p.contact?.role && (
                <p className="is-size-7 has-text-grey">{p.contact.role}</p>
              )}
            </div>
          </div>
          <div className="level-right">
            <button
              className="button is-ghost is-small has-text-danger"
              onClick={() => handleRemove(p.contact_id)}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #f0f0f0' }}>
        {adding ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <SearchableSelect
              options={available.map((c) => ({ id: c.id, label: c.name, sublabel: c.role ?? undefined }))}
              value={selectedContactId}
              onChange={setSelectedContactId}
              placeholder="Search contact…"
              size="small"
            />
            <button
              className="button is-primary is-small"
              onClick={handleAdd}
              disabled={!selectedContactId || loading}
            >
              {loading ? '…' : 'Add'}
            </button>
            <button className="button is-ghost is-small" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="button is-light is-small" onClick={() => setAdding(true)}>
            + Add participant
          </button>
        )}
      </div>
    </div>
  )
}
