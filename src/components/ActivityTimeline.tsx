'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { createInteractionLog } from '@/lib/actions/interactions'
import { createClient } from '@/lib/supabase/client'
import type { InteractionLog } from '@/types'

interface TimelineEntry {
  type: 'meeting' | 'log'
  date: string
  meetingId?: string
  meetingTitle?: string
  log?: InteractionLog
}

interface Props {
  entityType: 'contact' | 'company'
  entityId: string
  userId: string
  entries: TimelineEntry[]
}

function ClipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

export default function ActivityTimeline({ entityType, entityId, userId, entries }: Props) {
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState(false)
  const [fileUrls, setFileUrls] = useState<string[]>([])
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [links, setLinks] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addLink = () => {
    const url = linkInput.trim()
    if (!url) return
    setLinks((prev) => [...prev, url])
    setLinkInput('')
    setShowLinkInput(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const supabase = createClient()
      const path = `${userId}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('interaction-files').upload(path, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('interaction-files').getPublicUrl(path)
      setFileUrls((prev) => [...prev, publicUrl])
    } catch (err) {
      setError(String(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleAddNote = async () => {
    if (!note.trim()) return
    setSaving(true)
    setError('')
    try {
      await createInteractionLog({
        entity_type: entityType,
        entity_id: entityId,
        note: note.trim(),
        follow_up: followUp,
        meeting_id: null,
        file_urls: fileUrls,
        links,
        created_by: userId,
      })
      setNote('')
      setFollowUp(false)
      setFileUrls([])
      setLinks([])
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Quick note entry */}
      <div className="box mb-4">
        <p className="is-size-6 has-text-weight-semibold mb-3">Add note</p>

        {error && <p className="is-size-7 has-text-danger mb-2">{error}</p>}

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

        {(fileUrls.length > 0 || links.length > 0) && (
          <div className="tags mb-2">
            {fileUrls.map((f, i) => (
              <span key={`f-${i}`} className="tag is-light">
                <ClipIcon /><span className="ml-1">{f.split('/').pop() || f}</span>
                <button type="button" className="delete is-small ml-1" onClick={() => setFileUrls((prev) => prev.filter((_, idx) => idx !== i))} />
              </span>
            ))}
            {links.map((l, i) => (
              <span key={`l-${i}`} className="tag is-light">
                <LinkIcon /><span className="ml-1">{l}</span>
                <button type="button" className="delete is-small ml-1" onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))} />
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label className="checkbox is-size-7">
              <input
                type="checkbox"
                checked={followUp}
                onChange={(e) => setFollowUp(e.target.checked)}
                className="mr-2"
              />
              Flag for follow-up
            </label>

            <label className="has-text-grey" style={{ cursor: uploading ? 'default' : 'pointer', display: 'inline-flex' }} title="Attach a file">
              <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
              <ClipIcon />
            </label>

            {showLinkInput ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  className="input is-small"
                  style={{ width: 180 }}
                  autoFocus
                  placeholder="Paste a link…"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
                />
                <button type="button" className="button is-small is-light" onClick={addLink} disabled={!linkInput.trim()}>✓</button>
              </div>
            ) : (
              <button
                type="button"
                className="has-text-grey"
                style={{ background: 'none', border: 'none', padding: 0, display: 'inline-flex', cursor: 'pointer' }}
                onClick={() => setShowLinkInput(true)}
                title="Add a link"
              >
                <LinkIcon />
              </button>
            )}
          </div>

          <button
            className="button is-primary is-small"
            onClick={handleAddNote}
            disabled={saving || uploading || !note.trim()}
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
                      {((entry.log?.file_urls?.length ?? 0) > 0 || (entry.log?.links?.length ?? 0) > 0) && (
                        <div className="tags mt-1 mb-0">
                          {entry.log?.file_urls.map((f, fi) => (
                            <a key={`f-${fi}`} href={f} target="_blank" rel="noreferrer" className="tag is-light">
                              <ClipIcon /><span className="ml-1">{f.split('/').pop() || f}</span>
                            </a>
                          ))}
                          {entry.log?.links.map((l, li) => (
                            <a key={`l-${li}`} href={l.startsWith('http') ? l : `https://${l}`} target="_blank" rel="noreferrer" className="tag is-light">
                              <LinkIcon /><span className="ml-1">{l}</span>
                            </a>
                          ))}
                        </div>
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
