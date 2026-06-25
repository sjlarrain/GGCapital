'use client'
import { useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}

type ToolbarAction = {
  label: string
  title: string
  prefix: string
  suffix: string
  block?: boolean
}

const TOOLBAR: ToolbarAction[] = [
  { label: 'B', title: 'Bold', prefix: '**', suffix: '**' },
  { label: 'I', title: 'Italic', prefix: '*', suffix: '*' },
  { label: 'S', title: 'Strikethrough', prefix: '~~', suffix: '~~' },
  { label: '##', title: 'Heading', prefix: '## ', suffix: '', block: true },
  { label: '•', title: 'Bullet list', prefix: '- ', suffix: '', block: true },
  { label: '1.', title: 'Numbered list', prefix: '1. ', suffix: '', block: true },
]

export default function MarkdownEditor({ value, onChange, rows = 4, placeholder }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [expanded, setExpanded] = useState(false)

  // Insert markdown at the cursor/selection of the given textarea element.
  const insertMarkdown = (
    el: HTMLTextAreaElement | null,
    prefix: string,
    suffix: string,
    block?: boolean
  ) => {
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)

    let newValue: string
    let cursorStart: number
    let cursorEnd: number

    if (block) {
      // Insert on a new line if not already at start of line
      const before = value.slice(0, start)
      const needsNewline = before.length > 0 && !before.endsWith('\n')
      const insert = (needsNewline ? '\n' : '') + prefix + (selected || '')
      newValue = before + insert + value.slice(end)
      cursorStart = start + (needsNewline ? 1 : 0) + prefix.length + (selected ? selected.length : 0)
      cursorEnd = cursorStart
    } else {
      newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end)
      cursorStart = start + prefix.length
      cursorEnd = cursorStart + selected.length
    }

    onChange(newValue)
    // Restore focus and selection after React re-render
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursorStart, cursorEnd)
    })
  }

  const renderToolbar = (
    targetRef: React.RefObject<HTMLTextAreaElement | null>,
    showExpand: boolean
  ) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showExpand ? 4 : 8 }}>
      <div className="buttons mb-0" style={{ gap: 2 }}>
        {TOOLBAR.map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.title}
            className="button is-ghost is-small"
            style={{ fontWeight: action.label === 'B' ? 700 : undefined, fontStyle: action.label === 'I' ? 'italic' : undefined, minWidth: 28, padding: '0 6px' }}
            onMouseDown={(e) => {
              e.preventDefault()
              insertMarkdown(targetRef.current, action.prefix, action.suffix, action.block)
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      {showExpand && (
        <button
          type="button"
          title="Expand editor"
          className="button is-ghost is-small"
          style={{ color: '#aaa' }}
          onClick={() => setExpanded(true)}
        >
          ↗
        </button>
      )}
    </div>
  )

  return (
    <div>
      {renderToolbar(textareaRef, true)}
      <textarea
        ref={textareaRef}
        className="textarea"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <Modal open={expanded} onClose={() => setExpanded(false)} title="Edit note" wide>
        {renderToolbar(modalTextareaRef, false)}
        <textarea
          ref={modalTextareaRef}
          className="textarea"
          rows={16}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ resize: 'vertical' }}
          autoFocus
        />
        <div className="field mt-3">
          <button type="button" className="button is-primary is-small" onClick={() => setExpanded(false)}>
            Done
          </button>
        </div>
      </Modal>
    </div>
  )
}
