'use client'
import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { createNote } from '@/lib/actions/notes'
import { createClient } from '@/lib/supabase/client'
import type { Note } from '@/types'

interface Props {
  entityType: 'contact' | 'company'
  entityId: string
  userId: string
  notes: Note[]
}

export default function QuickNotes({ entityType, entityId, userId, notes }: Props) {
  const [body, setBody] = useState('')
  const [fileUrls, setFileUrls] = useState<string[]>([])
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
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const supabase = createClient()
      const path = `${userId}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('note-files').upload(path, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('note-files').getPublicUrl(path)
      setFileUrls((prev) => [...prev, publicUrl])
    } catch (err) {
      setError(String(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleAddNote = async () => {
    if (!body.trim()) return
    setSaving(true)
    setError('')
    try {
      await createNote({
        entity_type: entityType,
        entity_id: entityId,
        body: body.trim(),
        file_urls: fileUrls,
        links,
        created_by: userId,
      })
      setBody('')
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
      <p className="is-size-6 has-text-weight-semibold mb-3">Quick Notes</p>

      {error && <p className="is-size-7 has-text-danger mb-2">{error}</p>}

      <div className="box mb-4">
        <div className="field">
          <div className="control">
            <textarea
              className="textarea is-small"
              rows={2}
              placeholder="Post a quick note…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>

        {(fileUrls.length > 0 || links.length > 0) && (
          <div className="tags mb-2">
            {fileUrls.map((f, i) => (
              <span key={`f-${i}`} className="tag is-light">
                📎 {f.split('/').pop() || f}
                <button
                  type="button"
                  className="delete is-small ml-1"
                  onClick={() => setFileUrls((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </span>
            ))}
            {links.map((l, i) => (
              <span key={`l-${i}`} className="tag is-light">
                🔗 {l}
                <button
                  type="button"
                  className="delete is-small ml-1"
                  onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="file is-small">
            <label className="file-label">
              <input
                className="file-input"
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <span className="file-cta">
                <span className="file-label">{uploading ? 'Uploading…' : 'Attach file'}</span>
              </span>
            </label>
          </div>
          <input
            className="input is-small"
            style={{ maxWidth: 220 }}
            placeholder="Paste a link…"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
          />
          <button type="button" className="button is-light is-small" onClick={addLink} disabled={!linkInput.trim()}>
            Add link
          </button>
          <button
            type="button"
            className="button is-primary is-small"
            style={{ marginLeft: 'auto' }}
            onClick={handleAddNote}
            disabled={saving || uploading || !body.trim()}
          >
            {saving ? 'Saving…' : 'Post note'}
          </button>
        </div>
      </div>

      <div>
        {notes.length === 0 && (
          <p className="has-text-grey has-text-centered py-5 is-size-7">No notes yet.</p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="box mb-3 py-3">
            <p className="is-size-7" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{n.body}</p>
            {(n.file_urls.length > 0 || n.links.length > 0) && (
              <div className="tags mt-2 mb-0">
                {n.file_urls.map((f, i) => (
                  <a key={`f-${i}`} href={f} target="_blank" rel="noreferrer" className="tag is-light">
                    📎 {f.split('/').pop() || f}
                  </a>
                ))}
                {n.links.map((l, i) => (
                  <a key={`l-${i}`} href={l.startsWith('http') ? l : `https://${l}`} target="_blank" rel="noreferrer" className="tag is-light">
                    🔗 {l}
                  </a>
                ))}
              </div>
            )}
            <p className="is-size-7 has-text-grey mt-2 mb-0">{formatDate(n.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
