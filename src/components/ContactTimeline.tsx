'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
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
    <div>
      {/* Quick note entry */}
      <div className="box mb-4">
        <p className="is-size-6 has-text-weight-semibold mb-3">Add note</p>
        <div className="field">
          <div className="control">
            <textarea
              className="textarea is-small"
              rows={2}
              placeholder="Quick note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <label className="checkbox is-size-7">
            <input
              type="checkbox"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
              className="mr-2"
            />
            Flag for follow-up
          </label>
          <button
            className="button is-primary is-small"
            onClick={handleAddNote}
            disabled={saving || !note.trim()}
          >
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div>
        {entries.length === 0 && (
          <p className="has-text-grey has-text-centered py-5 is-size-7">No activity yet.</p>
        )}
        {entries.map((entry, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
              <div
                className="gg-timeline-dot"
                style={{ background: entry.type === 'meeting' ? '#3273dc' : '#a0aec0' }}
              />
              {i < entries.length - 1 && <div className="gg-timeline-line" />}
            </div>
            <div style={{ flex: 1, paddingBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {entry.type === 'meeting' ? (
                    <p className="is-size-7">
                      <span className="has-text-weight-semibold has-text-link">Meeting: </span>
                      <Link href={`/meetings/${entry.meetingId}`} className="has-text-link">
                        {entry.meetingTitle}
                      </Link>
                    </p>
                  ) : (
                    <div>
                      <p className="is-size-7" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{entry.log?.note}</p>
                      {entry.log?.follow_up && (
                        <span className="is-size-7 has-text-warning-dark">🔔 Follow-up flagged</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="is-size-7 has-text-grey" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {formatDate(entry.date)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
