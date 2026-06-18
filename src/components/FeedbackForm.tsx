'use client'
import { useState } from 'react'
import { submitFeedback } from '@/lib/actions/interactions'
import Textarea from './ui/Textarea'
import Button from './ui/Button'
import Alert from './ui/Alert'

export default function FeedbackForm({ userId }: { userId: string }) {
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
    setTimeout(() => setDone(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">Submit feedback</h2>
      {done && <Alert type="success">Feedback submitted!</Alert>}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe the issue or suggestion…"
        rows={3}
      />
      <Button type="submit" disabled={saving || !text.trim()}>
        {saving ? 'Submitting…' : 'Submit'}
      </Button>
    </form>
  )
}
