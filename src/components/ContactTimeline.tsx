'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import Button from './ui/Button'
import { createInteractionLog } from '@/lib/actions/interactions'
import type { InteractionLog } from '@/types'

interface TimelineEntry {
  type: 'meeting' | 'log'
  date: string
  meetingId?: string
  meetingTitle?: string
  log?: InteractionLog
}

interface Props {
  contactId: string
  userId: string
  entries: TimelineEntry[]
}

export default function ContactTimeline({ contactId, userId, entries }: Props) {
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleAddNote = async () => {
    if (!note.trim()) return
    setSaving(true)
    try {
      await createInteractionLog({
        contact_id: contactId,
        note: note.trim(),
        follow_up: followUp,
        meeting_id: null,
        created_by: userId,
      })
      setNote('')
      setFollowUp(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Quick note entry */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Add note</h3>
        <textarea
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={2}
          placeholder="Quick note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
              className="rounded"
            />
            Flag for follow-up
          </label>
          <Button size="sm" onClick={handleAddNote} disabled={saving || !note.trim()}>
            {saving ? 'Saving…' : 'Add note'}
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">No activity yet.</p>
        )}
        {entries.map((entry, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${entry.type === 'meeting' ? 'bg-blue-500' : 'bg-gray-400'}`} />
              {i < entries.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  {entry.type === 'meeting' ? (
                    <p className="text-sm">
                      <span className="font-medium text-blue-700">Meeting: </span>
                      <Link href={`/meetings/${entry.meetingId}`} className="text-blue-600 hover:underline">
                        {entry.meetingTitle}
                      </Link>
                    </p>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-800">{entry.log?.note}</p>
                      {entry.log?.follow_up && (
                        <span className="text-xs text-yellow-600 font-medium">🔔 Follow-up flagged</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-2">{formatDate(entry.date)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
