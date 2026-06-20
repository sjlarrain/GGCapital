'use client'
import { useState, useRef, useEffect } from 'react'

export interface AutocompleteOption {
  id: string
  label: string
  sublabel?: string
}

interface Props {
  options: AutocompleteOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  label?: string
  clearLabel?: string
}

export default function Autocomplete({ options, value, onChange, placeholder, label, clearLabel = 'No selection' }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.id === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())).slice(0, 15)
    : options.slice(0, 15)

  const handleSelect = (opt: AutocompleteOption) => {
    onChange(opt.id)
    setQuery('')
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="field" ref={ref} style={{ position: 'relative' }}>
      {label && <label className="label">{label}</label>}
      <div className="control">
        {selected && !open ? (
          <div
            className="input"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => { setQuery(''); setOpen(true) }}
          >
            <span style={{ fontSize: '0.75rem' }}>{selected.label}</span>
            <button type="button" className="delete is-small" onClick={handleClear} />
          </div>
        ) : (
          <input
            className="input"
            placeholder={placeholder ?? 'Type to search…'}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
          />
        )}
      </div>

      {open && (
        <div className="gg-tag-dropdown" style={{ width: '100%' }}>
          <button
            type="button"
            className="button is-ghost is-small"
            style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, borderBottom: '1px solid #f0f0f0', color: '#aaa' }}
            onClick={() => { onChange(''); setQuery(''); setOpen(false) }}
          >
            — {clearLabel}
          </button>
          {filtered.length === 0 && (
            <p className="has-text-grey is-size-7 px-3 py-2">No results found</p>
          )}
          {filtered.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="button is-ghost is-small"
              style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '0.4rem 0.75rem' }}
              onClick={() => handleSelect(opt)}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.75rem' }}>{opt.label}</div>
                {opt.sublabel && (
                  <div style={{ fontSize: '0.7rem', color: '#888' }}>{opt.sublabel}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
