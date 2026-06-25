'use client'
import { useState, useRef, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { findNearMatches } from '@/lib/utils'
import type { TagItem } from '@/types'

interface TagPickerProps {
  catalog: TagItem[]
  selected: string[]
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const uid = useId()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const portalEl = document.getElementById(uid)
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        !(portalEl && portalEl.contains(e.target as Node))
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [uid])

  useEffect(() => {
    if (!open) return
    const reposition = () => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: Math.max(rect.width, 240),
        maxHeight: 260,
        overflowY: 'auto',
        zIndex: 9999,
        background: '#fff',
        border: '1px solid #dbdbdb',
        borderRadius: 4,
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      })
    }
    reposition()
    // Keep the fixed-position dropdown anchored to its input while the user
    // scrolls (capture catches nested scroll containers like drawers) or resizes.
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  const filtered = catalog.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) &&
      (multi ? true : !selected.includes(t.id))
  )

  const selectedItems = catalog.filter((t) => selected.includes(t.id))

  const toggle = (id: string) => {
    if (!multi) {
      onChange(selected.includes(id) ? [] : [id])
      setQuery('')
      setNearMatches([])
      setOpen(false)
      return
    }
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
    setQuery('')
    setNearMatches([])
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
    <div className="field" ref={ref}>
      {label && <label className="label">{label}</label>}

      <div
        className="gg-tag-input"
        onClick={() => setOpen(true)}
      >
        {selectedItems.map((t) => (
          <span key={t.id} className="tag is-info is-light">
            {t.name}
            <button
              type="button"
              className="delete is-small ml-1"
              onClick={(e) => { e.stopPropagation(); toggle(t.id) }}
            />
          </span>
        ))}
        {(multi || selected.length === 0) && (
          <input
            style={{ border: 'none', outline: 'none', fontSize: '0.875rem', background: 'transparent', minWidth: 80, flex: 1 }}
            placeholder={selected.length === 0 ? 'Search or create…' : 'Add more…'}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setOpen(true)}
          />
        )}
      </div>

      {typeof document !== 'undefined' && open && createPortal(
        <div id={uid} style={dropdownStyle}>
          {nearMatches.length > 0 && (
            <div className="notification is-warning is-light p-2 m-2 is-size-7" style={{ borderRadius: 4 }}>
              Similar tags exist: {nearMatches.join(', ')}. Create anyway?
            </div>
          )}
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              className="button is-ghost is-small"
              style={{ width: '100%', justifyContent: 'space-between', borderRadius: 0, padding: '0.4rem 0.75rem' }}
              onClick={() => toggle(t.id)}
            >
              <span>{t.name}</span>
              {selected.includes(t.id) && <span className="has-text-primary">✓</span>}
            </button>
          ))}
          {query.trim() && !exactExists && (
            <div style={{ borderTop: '1px solid #f0f0f0', padding: '0.4rem 0.5rem' }}>
              <button
                type="button"
                className="button is-ghost is-small has-text-primary"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? 'Creating…' : `Create "${query.trim()}"`}
              </button>
            </div>
          )}
          {filtered.length === 0 && !query && (
            <p className="has-text-grey is-size-7 px-3 py-2">No tags yet</p>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
