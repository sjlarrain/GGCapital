'use client'
import { useState } from 'react'
import { submitFeedback } from '@/lib/actions/interactions'
import Alert from './ui/Alert'

interface FeedbackFormProps {
  userId: string
  onSuccess?: () => void
}

export default function FeedbackForm({ userId, onSuccess }: FeedbackFormProps) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    await submitFeedback(text.trim(), userId)
    setText('')
    setDone(true)
    setSaving(false)
    setTimeout(() => {
      setDone(false)
      onSuccess?.()
    }, 1500)
  }

  return (
    <form onSubmit={handleSubmit}>
      {done && <Alert type="success" className="mb-4">Feedback submitted — thank you!</Alert>}
      <div className="field">
        <label className="label">Your message</label>
        <div className="control">
          <textarea
            className="textarea"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe an issue, idea, or anything you'd like to see improved…"
          />
        </div>
      </div>
      <div className="field">
        <div className="control">
          <button type="submit" className="button is-primary" disabled={saving || !text.trim()}>
            {saving ? 'Submitting…' : 'Submit feedback'}
          </button>
        </div>
      </div>
    </form>
  )
}
