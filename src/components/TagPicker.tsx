'use client'
import { useState, useRef, useEffect } from 'react'
import { findNearMatches } from '@/lib/utils'
import type { TagItem } from '@/types'
import Alert from './ui/Alert'
import Button from './ui/Button'

interface TagPickerProps {
  catalog: TagItem[]
  selected: string[] // ids
  onChange: (ids: string[]) => void
  onCreateTag: (name: string) => Promise<TagItem>
  label?: string
  multi?: boolean
}

export default function TagPicker({
  catalog,
  selected,
  onChange,
  onCreateTag,
  label,
  multi = true,
}: TagPickerProps) {
  const [query, setQuery] = useState('')
  const [nearMatches, setNearMatches] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = catalog.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) &&
      (multi ? true : !selected.includes(t.id))
  )

  const selectedItems = catalog.filter((t) => selected.includes(t.id))

  const toggle = (id: string) => {
    if (!multi) {
      onChange(selected.includes(id) ? [] : [id])
      setOpen(false)
      return
    }
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    )
  }

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (val.length >= 2) {
      setNearMatches(findNearMatches(val, catalog.map((t) => t.name)))
    } else {
      setNearMatches([])
    }
  }

  const handleCreate = async () => {
    if (!query.trim()) return
    setCreating(true)
    try {
      const newTag = await onCreateTag(query.trim())
      onChange([...selected, newTag.id])
      setQuery('')
      setNearMatches([])
    } finally {
      setCreating(false)
    }
  }

  const exactExists = catalog.some((t) => t.name.toLowerCase() === query.toLowerCase())

  return (
    <div className="w-full" ref={ref}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

      <div
        className="min-h-9 flex flex-wrap gap-1.5 px-2 py-1.5 border border-gray-300 rounded-md cursor-text"
        onClick={() => setOpen(true)}
      >
        {selectedItems.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs"
          >
            {t.name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(t.id) }}
              className="hover:text-blue-600"
            >
              ×
            </button>
          </span>
        ))}
        {(multi || selected.length === 0) && (
          <input
            className="flex-1 min-w-24 outline-none text-sm bg-transparent"
            placeholder={selected.length === 0 ? 'Search or create…' : 'Add more…'}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setOpen(true)}
          />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto w-72">
          {nearMatches.length > 0 && (
            <Alert type="warning" className="m-2 text-xs">
              Similar tags exist: {nearMatches.join(', ')}. Are you sure you want to create a new one?
            </Alert>
          )}
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
              onClick={() => toggle(t.id)}
            >
              {t.name}
              {selected.includes(t.id) && <span className="text-blue-600 text-xs">✓</span>}
            </button>
          ))}
          {query.trim() && !exactExists && (
            <div className="border-t border-gray-100 px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-left text-blue-600"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? 'Creating…' : `Create "${query.trim()}"`}
              </Button>
            </div>
          )}
          {filtered.length === 0 && !query && (
            <p className="px-3 py-2 text-sm text-gray-400">No tags yet</p>
          )}
        </div>
      )}
    </div>
  )
}
