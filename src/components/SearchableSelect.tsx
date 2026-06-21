'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption {
  id: string
  label: string
  sublabel?: string
}

interface Props {
  options: SelectOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  clearLabel?: string
  size?: 'small' | 'normal'
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  clearLabel,
  size = 'normal',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.id === value)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Also check if click is inside the portal dropdown
        const portal = document.getElementById('searchable-select-portal')
        if (portal && portal.contains(e.target as Node)) return
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Position and focus when opening
  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: 220,
        maxHeight: 280,
        overflowY: 'auto',
        zIndex: 9999,
        background: '#fff',
        border: '1px solid #dbdbdb',
        borderRadius: 4,
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      })
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = query
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : options

  const handleSelect = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  const isSmall = size === 'small'
  const triggerClass = `button is-light${isSmall ? ' is-small' : ''}`

  const dropdown = open ? (
    <div id="searchable-select-portal" style={dropdownStyle}>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>
        <input
          ref={inputRef}
          className="input is-small"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {clearLabel && (
        <button
          type="button"
          className="button is-ghost is-small"
          style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, color: '#aaa', borderBottom: '1px solid #f5f5f5' }}
          onClick={() => handleSelect('')}
        >
          — {clearLabel}
        </button>
      )}

      {filtered.length === 0 && (
        <p className="has-text-grey is-size-7 px-3 py-2">No results</p>
      )}

      {filtered.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`button is-ghost is-small${opt.id === value ? ' has-text-weight-semibold' : ''}`}
          style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '0.4rem 0.75rem' }}
          onClick={() => handleSelect(opt.id)}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.8rem' }}>{opt.label}</div>
            {opt.sublabel && <div style={{ fontSize: '0.7rem', color: '#888' }}>{opt.sublabel}</div>}
          </div>
        </button>
      ))}
    </div>
  ) : null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={triggerClass}
        style={{ fontWeight: 'normal', justifyContent: 'space-between', minWidth: 140 }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ color: selected ? undefined : '#aaa' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ marginLeft: 8, opacity: 0.5, fontSize: '0.7em' }}>{open ? '▲' : '▼'}</span>
      </button>

      {value && (
        <button
          type="button"
          className="delete is-small"
          style={{ position: 'absolute', right: -8, top: -8, zIndex: 1 }}
          onClick={() => { onChange(''); setOpen(false) }}
        />
      )}

      {typeof document !== 'undefined' && dropdown && createPortal(dropdown, document.body)}
    </div>
  )
}
