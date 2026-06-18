'use client'
import { useState } from 'react'
import Input from './ui/Input'
import Button from './ui/Button'
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
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      {result?.error && <Alert type="error">{result.error}</Alert>}
      {result?.success && <Alert type="success">Invite sent! The user will receive an email to set their password.</Alert>}
      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Invite'}
        </Button>
      </div>
    </form>
  )
}
