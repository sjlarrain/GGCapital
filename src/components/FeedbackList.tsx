'use client'
import { useState, useTransition } from 'react'
import { setFeedbackDone } from '@/lib/actions/interactions'
import { formatDate } from '@/lib/utils'
import type { Feedback } from '@/types'

interface FeedbackListProps {
  feedbackList: Feedback[]
  profileMap: Record<string, string>
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  )
}

function downloadMarkdown(feedbackList: Feedback[], profileMap: Record<string, string>) {
  const lines = ['# Feedback', '']
  for (const f of feedbackList) {
    const author = profileMap[f.created_by] ?? 'Unknown user'
    lines.push(`## ${formatDate(f.created_at)} — ${author}${f.done ? ' (done)' : ''}`)
    lines.push('')
    lines.push(f.description)
    lines.push('')
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `feedback-${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export default function FeedbackList({ feedbackList, profileMap }: FeedbackListProps) {
  const [items, setItems] = useState(feedbackList)
  const [, startTransition] = useTransition()

  const toggleDone = (id: string, done: boolean) => {
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, done } : f)))
    startTransition(() => {
      setFeedbackDone(id, done)
    })
  }

  return (
    <div>
      <div className="mb-4">
        <button
          type="button"
          className="button is-small"
          onClick={() => downloadMarkdown(items, profileMap)}
          disabled={items.length === 0}
        >
          <span className="icon is-small"><DownloadIcon /></span>
          <span>Download all as Markdown</span>
        </button>
      </div>

      {items.length === 0 && (
        <div className="notification is-light">
          No feedback submitted yet.
        </div>
      )}

      <div>
        {items.map((f) => (
          <div key={f.id} className={`box mb-3${f.done ? ' has-background-light' : ''}`}>
            <p className="mb-3" style={{ whiteSpace: 'pre-wrap', opacity: f.done ? 0.6 : 1 }}>
              {f.description}
            </p>
            <div className="level is-mobile">
              <div className="level-left">
                <span className="tag is-light is-size-7 mr-2">
                  {profileMap[f.created_by] ?? 'Unknown user'}
                </span>
                <span className="is-size-7 has-text-grey">{formatDate(f.created_at)}</span>
              </div>
              <div className="level-right">
                <label className="checkbox is-size-7">
                  <input
                    type="checkbox"
                    checked={f.done}
                    onChange={(e) => toggleDone(f.id, e.target.checked)}
                  />
                  {' '}Done
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
