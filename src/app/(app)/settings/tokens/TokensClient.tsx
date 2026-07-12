'use client'
import Link from 'next/link'
import { useActionState, useRef } from 'react'
import { createApiToken, revokeApiToken } from '@/lib/actions/tokens'
import type { Scope } from '@/lib/schemas/token'
import { SCOPES } from '@/lib/schemas/token'

type Token = {
  id: string
  name: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

type CreateState = { raw?: string; error?: string } | null
type RevokeState = { error?: string } | null

const SCOPE_LABELS: Record<Scope, string> = {
  'crm:read':          'CRM Read',
  'crm:write':         'CRM Write',
  'staging:read':      'Staging Read',
  'staging:write':     'Staging Write',
  'staging:promote':   'Staging Promote',
  'network:read':      'Network Read',
  'network:write':     'Network Write',
}

function fmt(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function TokensClient({
  initialTokens,
  userRole,
  canGrantNetwork,
}: {
  initialTokens: Token[]
  userRole: 'admin' | 'user'
  canGrantNetwork: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)

  // network:* are shown only to allowlisted users (canGrantNetwork), never by
  // role; staging:promote stays admin-only. Both are stripped for everyone else.
  const allowedScopes = SCOPES.filter((s) => {
    if (s === 'staging:promote') return userRole === 'admin'
    if (s === 'network:read' || s === 'network:write') return canGrantNetwork
    return true
  })

  const [createState, createAction, creating] = useActionState(
    async (_prev: CreateState, formData: FormData): Promise<CreateState> => {
      const name     = (formData.get('name') as string ?? '').trim()
      const scopes   = formData.getAll('scopes') as Scope[]
      const expiresAt = (formData.get('expires_at') as string || null)
      if (!name) return { error: 'Name is required.' }
      if (scopes.length === 0) return { error: 'Select at least one scope.' }
      try {
        const raw = await createApiToken(name, scopes, expiresAt ? new Date(expiresAt).toISOString() : null)
        formRef.current?.reset()
        return { raw }
      } catch (e) {
        return { error: String(e) }
      }
    },
    null
  )

  const [revokeState, revokeAction] = useActionState(
    async (_prev: RevokeState, formData: FormData): Promise<RevokeState> => {
      const id = formData.get('id') as string
      try {
        await revokeApiToken(id)
        return null
      } catch (e) {
        return { error: String(e) }
      }
    },
    null
  )

  return (
    <div className="container" style={{ maxWidth: 800, padding: '2rem 1rem' }}>
      <Link href="/settings" className="has-text-grey is-size-7" style={{ textDecoration: 'none' }}>
        ← Settings
      </Link>
      <h1 className="title is-4 mt-3">API Tokens</h1>
      <p className="subtitle is-6 mb-5">
        Tokens authenticate programmatic access to <code>/api/v1/*</code>.
        Send <code>Authorization: Bearer ggc_…</code>. The raw token is shown once — store it securely.
        {userRole === 'admin' && (
          <> Need to connect an AI agent instead? See <Link href="/settings/mcp">AI Agent (MCP)</Link>.</>
        )}
      </p>

      {/* ── Create form ── */}
      <div className="box mb-5">
        <h2 className="title is-6 mb-3">New token</h2>
        <form action={createAction} ref={formRef}>
          <div className="field">
            <label className="label">Name</label>
            <div className="control">
              <input className="input" name="name" type="text" placeholder="e.g. Cowork – read/write" required maxLength={100} />
            </div>
          </div>

          <div className="field">
            <label className="label">Scopes</label>
            <div className="control">
              {allowedScopes.map((scope) => (
                <label key={scope} className="checkbox mr-4">
                  <input type="checkbox" name="scopes" value={scope} />{' '}
                  {SCOPE_LABELS[scope]}
                </label>
              ))}
            </div>
            <p className="help">
              Admin tokens can also be granted <code>staging:promote</code>.
              {canGrantNetwork && <> You can grant <code>network:read</code>/<code>network:write</code> for intro bulk-loading.</>}
              {' '}Token scopes cannot exceed your own role permissions.
            </p>
          </div>

          <div className="field">
            <label className="label">Expires (optional)</label>
            <div className="control">
              <input className="input" name="expires_at" type="date" style={{ maxWidth: 200 }} />
            </div>
          </div>

          <div className="field">
            <div className="control">
              <button className="button is-primary" type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create token'}
              </button>
            </div>
          </div>
        </form>

        {createState?.error && (
          <div className="notification is-danger is-light mt-3">{createState.error}</div>
        )}

        {createState?.raw && (
          <div className="notification is-warning mt-3">
            <p className="mb-2"><strong>Copy this token now — it will not be shown again.</strong></p>
            <code style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>{createState.raw}</code>
          </div>
        )}
      </div>

      {/* ── Token list ── */}
      <h2 className="title is-6">Active tokens</h2>
      {revokeState?.error && (
        <div className="notification is-danger is-light mb-3">{revokeState.error}</div>
      )}

      {initialTokens.length === 0 ? (
        <p className="has-text-grey">No active tokens.</p>
      ) : (
        <table className="table is-fullwidth is-striped is-hoverable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Scopes</th>
              <th>Last used</th>
              <th>Expires</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initialTokens.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {t.scopes.map((s) => (
                      <span key={s} className="tag is-light is-small">{s}</span>
                    ))}
                  </div>
                </td>
                <td>{fmt(t.last_used_at)}</td>
                <td>{fmt(t.expires_at)}</td>
                <td>{fmt(t.created_at)}</td>
                <td>
                  <form action={revokeAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      className="button is-danger is-small is-outlined"
                      type="submit"
                      onClick={(e) => { if (!confirm('Revoke this token?')) e.preventDefault() }}
                    >
                      Revoke
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
