'use client'
import { useState } from 'react'
import { createTag, updateTag, deleteTag } from '@/lib/actions/tags'
import { findNearMatches } from '@/lib/utils'
import type { TagItem } from '@/types'
import Button from './ui/Button'
import Input from './ui/Input'
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
    await deleteTag(catalog, id)
    setItems((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-base font-semibold text-gray-800 mb-3">{label}</h2>

      <div className="space-y-1 mb-4 max-h-56 overflow-y-auto divide-y divide-gray-100">
        {items.length === 0 && <p className="text-sm text-gray-400 py-2">No tags yet.</p>}
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-2 py-1.5">
            {editingId === t.id ? (
              <>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 text-sm" />
                <Button size="sm" onClick={() => handleUpdate(t.id)}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{t.name}</span>
                <Button variant="ghost" size="sm" onClick={() => { setEditingId(t.id); setEditName(t.name) }}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(t.id)}>×</Button>
              </>
            )}
          </div>
        ))}
      </div>

      {nearMatches.length > 0 && (
        <Alert type="warning" className="mb-2 text-xs">
          Similar tags: {nearMatches.join(', ')}
        </Alert>
      )}

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => handleNewNameChange(e.target.value)}
          placeholder="New tag name…"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreate())}
        />
        <Button size="sm" onClick={handleCreate} disabled={loading || !newName.trim()}>
          {loading ? '…' : 'Add'}
        </Button>
      </div>
    </div>
  )
}
