'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { createInteractionLog, updateInteractionLog, deleteInteractionLog } from '@/lib/actions/interactions'
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

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

export default function ActivityTimeline({ entityType, entityId, userId, entries: initialEntries }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState(false)
  const [fileUrls, setFileUrls] = useState<string[]>([])
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [links, setLinks] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')
  const [editFollowUp, setEditFollowUp] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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
      const created = await createInteractionLog({
        entity_type: entityType,
        entity_id: entityId,
        note: note.trim(),
        follow_up: followUp,
        meeting_id: null,
        file_urls: fileUrls,
        links,
        created_by: userId,
      })
      setEntries((prev) => [{ type: 'log', date: created.created_at, log: created as InteractionLog }, ...prev])
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

  const startEdit = (log: InteractionLog) => {
    setEditingLogId(log.id)
    setEditNote(log.note)
    setEditFollowUp(log.follow_up)
  }

  const cancelEdit = () => {
    setEditingLogId(null)
    setEditNote('')
    setEditFollowUp(false)
  }

  const saveEdit = async (log: InteractionLog) => {
    if (!editNote.trim()) return
    setSavingEdit(true)
    setError('')
    try {
      await updateInteractionLog(
        log.id,
        entityType,
        entityId,
        { note: editNote.trim(), follow_up: editFollowUp },
        userId
      )
      setEntries((prev) =>
        prev.map((e) =>
          e.log?.id === log.id
            ? { ...e, log: { ...log, note: editNote.trim(), follow_up: editFollowUp, updated_by: userId } }
            : e
        )
      )
      cancelEdit()
    } catch (err) {
      setError(String(err))
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (log: InteractionLog) => {
    setDeleting(true)
    setError('')
    try {
      await deleteInteractionLog(log.id, entityType, entityId)
      setEntries((prev) => prev.filter((e) => e.log?.id !== log.id))
      setConfirmingDeleteId(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setDeleting(false)
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

      {/* Notes + meetings list */}
      <div>
        {entries.length === 0 && (
          <p className="has-text-grey has-text-centered py-5 is-size-7">No activity yet.</p>
        )}
        {entries.map((entry, i) => {
          const log = entry.log
          const isEditing = entry.type === 'log' && log && editingLogId === log.id
          const canDelete = entry.type === 'log' && log && log.created_by === userId

          return (
            <div
              key={i}
              style={{
                padding: '0.75rem 0',
                borderBottom: i < entries.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}
            >
              {entry.type === 'meeting' ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <p className="is-size-7">
                    <span className="has-text-weight-semibold has-text-link">Meeting: </span>
                    <Link href={`/meetings/${entry.meetingId}`} className="has-text-link">
                      {entry.meetingTitle}
                    </Link>
                  </p>
                  <span className="is-size-7 has-text-grey" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {formatDate(entry.date)}
                  </span>
                </div>
              ) : log && isEditing ? (
                <div>
                  <div className="field">
                    <div className="control">
                      <textarea
                        className="textarea is-small"
                        rows={2}
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <label className="checkbox is-size-7">
                      <input
                        type="checkbox"
                        checked={editFollowUp}
                        onChange={(e) => setEditFollowUp(e.target.checked)}
                        className="mr-2"
                      />
                      Flag for follow-up
                    </label>
                    <div className="buttons">
                      <button
                        type="button"
                        className="button is-primary is-small"
                        onClick={() => saveEdit(log)}
                        disabled={savingEdit || !editNote.trim()}
                      >
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" className="button is-ghost is-small" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : log ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="is-size-7" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{log.note}</p>
                    {log.follow_up && (
                      <span className="is-size-7 has-text-warning-dark">🔔 Follow-up flagged</span>
                    )}
                    {((log.file_urls?.length ?? 0) > 0 || (log.links?.length ?? 0) > 0) && (
                      <div className="tags mt-1 mb-0">
                        {log.file_urls.map((f, fi) => (
                          <a key={`f-${fi}`} href={f} target="_blank" rel="noreferrer" className="tag is-light">
                            <ClipIcon /><span className="ml-1">{f.split('/').pop() || f}</span>
                          </a>
                        ))}
                        {log.links.map((l, li) => (
                          <a key={`l-${li}`} href={l.startsWith('http') ? l : `https://${l}`} target="_blank" rel="noreferrer" className="tag is-light">
                            <LinkIcon /><span className="ml-1">{l}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    {confirmingDeleteId === log.id && (
                      <div className="mt-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="has-text-danger is-size-7">Delete this note?</span>
                        <button
                          type="button"
                          className="button is-danger is-small"
                          onClick={() => handleDelete(log)}
                          disabled={deleting}
                        >
                          {deleting ? '…' : 'Yes, delete'}
                        </button>
                        <button type="button" className="button is-ghost is-small" onClick={() => setConfirmingDeleteId(null)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span className="is-size-7 has-text-grey" style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(entry.date)}
                    </span>
                    <button
                      type="button"
                      className="has-text-grey"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex' }}
                      title="Edit note"
                      onClick={() => startEdit(log)}
                    >
                      <EditIcon />
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        className="has-text-grey"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex' }}
                        title="Delete note"
                        onClick={() => setConfirmingDeleteId(log.id)}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
