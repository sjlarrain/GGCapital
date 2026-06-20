'use client'
import { useState } from 'react'
import Alert from './ui/Alert'

export default function InviteForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      setResult(data)
      if (!data.error) setEmail('')
    } catch {
      setResult({ error: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {result?.error && <Alert type="error" className="mb-3">{result.error}</Alert>}
      {result?.success && (
        <Alert type="success" className="mb-3">
          Invite sent! The user will receive an email to set their password.
        </Alert>
      )}
      <div className="field has-addons">
        <div className="control is-expanded">
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
        </div>
        <div className="control">
          <button type="submit" className="button is-primary" disabled={loading}>
            {loading ? 'Sending…' : 'Invite'}
          </button>
        </div>
      </div>
    </form>
  )
}
