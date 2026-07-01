'use client'
import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

/** Only allow same-origin relative paths as a post-login destination. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/'
}

// useSearchParams() forces client rendering, so the form lives in its own
// component wrapped in <Suspense> (Next's CSR-bailout requirement at build).
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Honour ?next= so the OAuth "Connect" flow returns to the consent screen.
      const next = safeNext(searchParams.get('next'))
      router.push(next)
      router.refresh()
    }
  }

  return (
    <div className="gg-login-page">
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div className="has-text-centered mb-6">
          <h1 className="title is-3">GG Capital</h1>
          <p className="subtitle is-6 has-text-grey">Sign in to your account</p>
        </div>

        <div className="box">
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="notification is-danger is-light mb-4">
                {error}
              </div>
            )}

            <div className="field">
              <label className="label">Email</label>
              <div className="control has-icons-left">
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
                <span className="icon is-small is-left">✉</span>
              </div>
            </div>

            <div className="field">
              <label className="label">Password</label>
              <div className="control has-icons-left">
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <span className="icon is-small is-left">🔒</span>
              </div>
            </div>

            <div className="field mt-5">
              <div className="control">
                <button
                  type="submit"
                  className={`button is-primary is-fullwidth${loading ? ' is-loading' : ''}`}
                  disabled={loading}
                >
                  Sign in
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
