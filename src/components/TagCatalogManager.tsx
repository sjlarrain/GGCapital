'use client'
import { useState } from 'react'
import { createTag, updateTag, deleteTag } from '@/lib/actions/tags'
import { findNearMatches } from '@/lib/utils'
import type { TagItem } from '@/types'
import Alert from './ui/Alert'

type CatalogKey = 'industries' | 'regions' | 'stages' | 'types' | 'statuses' | 'meetingTypes'

interface Props {
  catalog: CatalogKey
  label: string
  items: TagItem[]
}

export default function TagCatalogManager({ catalog, label, items: initial }: Props) {
  const [items, setItems] = useState(initial)
  const [newName, setNewName] = useState('')
  const [nearMatches, setNearMatches] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleNewNameChange = (val: string) => {
    setNewName(val)
    if (val.length >= 2) {
      setNearMatches(findNearMatches(val, items.map((t) => t.name)))
    } else {
      setNearMatches([])
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      const tag = await createTag(catalog, newName.trim())
      setItems((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNearMatches([])
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    await updateTag(catalog, id, editName.trim())
    setItems((prev) => prev.map((t) => t.id === id ? { ...t, name: editName.trim() } : t))
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    setDeleteError('')
    try {
      await deleteTag(catalog, id)
      setItems((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setDeleteError(String(err))
    }
  }

  return (
    <div className="box">
      <p className="is-size-6 has-text-weight-semibold mb-3">{label}</p>

      {deleteError && (
        <Alert type="error" className="mb-2">
          <span className="is-size-7">Could not delete tag: {deleteError}</span>
        </Alert>
      )}

      <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: '1rem' }}>
        {items.length === 0 && (
          <p className="is-size-7 has-text-grey py-2">No tags yet.</p>
        )}
        {items.map((t) => (
          <div
            key={t.id}
            className="level is-mobile"
            style={{ padding: '0.35rem 0', borderBottom: '1px solid #f5f5f5', margin: 0 }}
          >
            {editingId === t.id ? (
              <>
                <div className="level-left" style={{ flex: 1 }}>
                  <div className="field mb-0" style={{ flex: 1 }}>
                    <div className="control">
                      <input
                        className="input is-small"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="level-right">
                  <div className="buttons ml-2">
                    <button className="button is-primary is-small" onClick={() => handleUpdate(t.id)}>Save</button>
                    <button className="button is-ghost is-small" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="level-left">
                  <span className="is-size-7">{t.name}</span>
                </div>
                <div className="level-right">
                  <div className="buttons ml-2">
                    <button
                      className="button is-ghost is-small"
                      onClick={() => { setEditingId(t.id); setEditName(t.name) }}
                    >
                      Edit
                    </button>
                    <button
                      className="button is-ghost is-small has-text-danger"
                      onClick={() => handleDelete(t.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {nearMatches.length > 0 && (
        <Alert type="warning" className="mb-2">
          <span className="is-size-7">Similar tags: {nearMatches.join(', ')}</span>
        </Alert>
      )}

      <div className="field has-addons mb-0">
        <div className="control is-expanded">
          <input
            className="input is-small"
            value={newName}
            onChange={(e) => handleNewNameChange(e.target.value)}
            placeholder="New tag name…"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreate())}
          />
        </div>
        <div className="control">
          <button
            className="button is-primary is-small"
            onClick={handleCreate}
            disabled={loading || !newName.trim()}
          >
            {loading ? '…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
