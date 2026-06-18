'use client'
import { useState } from 'react'
import Link from 'next/link'
import { addParticipant, removeParticipant } from '@/lib/actions/meetings'
import Button from './ui/Button'

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
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="divide-y divide-gray-100">
        {list.length === 0 && !adding && (
          <p className="px-4 py-3 text-sm text-gray-400">No participants added.</p>
        )}
        {list.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              {p.contact ? (
                <Link href={`/contacts/${p.contact.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                  {p.contact.name}
                </Link>
              ) : (
                <span className="text-sm text-gray-400">Unknown contact</span>
              )}
              {p.contact?.role && (
                <p className="text-xs text-gray-400">{p.contact.role}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleRemove(p.contact_id)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 px-4 py-3">
        {adding ? (
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
            >
              <option value="">Select contact…</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.role ? ` · ${c.role}` : ''}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={handleAdd} disabled={!selectedContactId || loading}>
              {loading ? '…' : 'Add'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            + Add participant
          </Button>
        )}
      </div>
    </div>
  )
}
