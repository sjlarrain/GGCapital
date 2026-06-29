'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import StatusBadge from '../StatusBadge'
import type { StagingStatus } from '@/lib/schemas/staging'
import {
  classifyStagingEvent,
  promoteStagingEventAction,
  rejectStagingEvent,
  updateProposedLinks,
} from '@/lib/actions/staging'

type Json = Record<string, unknown>

interface StagingEvent {
  id: string
  source: string
  source_ref: string | null
  raw_payload: Json
  extracted: Json | null
  proposed_links: Json | null
  event_class: string | null
  confidence: number | null
  status: StagingStatus
  blocking_reasons: string[]
  promoted_to: { table: string; id: string }[] | null
  created_at: string
  reviewed_at: string | null
}

interface LogRow {
  id: string
  from_status: string | null
  to_status: string | null
  action: string
  detail: Json | null
  created_at: string
}

type FieldDef = { key: string; label: string }
const COMPANY_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name *' },
  { key: 'website', label: 'Website' },
  { key: 'description', label: 'Description' },
  { key: 'country', label: 'Country' },
]
const CONTACT_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name *' },
  { key: 'email', label: 'Email *' },
  { key: 'role', label: 'Role' },
  { key: 'phone', label: 'Phone' },
]

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

function Pre({ value }: { value: unknown }) {
  return (
    <pre style={{ background: '#f5f7fa', padding: '0.75rem', borderRadius: 6, fontSize: '0.8rem', overflowX: 'auto', margin: 0 }}>
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  )
}

export default function TriageDetail({ event, log }: { event: StagingEvent; log: LogRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const links = (event.proposed_links ?? {}) as Json
  const initCompany = (links.company as Json) ?? {}
  const initContact = (links.contact as Json) ?? {}
  const [company, setCompany] = useState<Record<string, string>>(
    Object.fromEntries(COMPANY_FIELDS.map((f) => [f.key, str(initCompany[f.key])]))
  )
  const [contact, setContact] = useState<Record<string, string>>(
    Object.fromEntries(CONTACT_FIELDS.map((f) => [f.key, str(initContact[f.key])]))
  )

  const isTerminal = event.status === 'promoted' || event.status === 'rejected'
  const canPromote = event.status === 'ready'
  const hasCompanyId = !!(initCompany as Json).id

  const run = (fn: () => Promise<unknown>) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const saveAndClassify = () => {
    // Merge edits back into proposed_links, preserving any keys (ids, confidences) we don't edit.
    const nextCompany: Json = { ...(initCompany as Json) }
    for (const f of COMPANY_FIELDS) {
      if (company[f.key]) nextCompany[f.key] = company[f.key]
      else delete nextCompany[f.key]
    }
    const nextContact: Json = { ...(initContact as Json) }
    for (const f of CONTACT_FIELDS) {
      if (contact[f.key]) nextContact[f.key] = contact[f.key]
      else delete nextContact[f.key]
    }
    const next: Json = { ...links }
    if (Object.keys(nextCompany).length) next.company = nextCompany
    if (Object.keys(nextContact).length) next.contact = nextContact
    run(() => updateProposedLinks(event.id, next))
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <div className="mb-4">
        <Link href="/triage" className="has-text-link is-size-7">← Back to Triage</Link>
      </div>

      <div className="level mb-4">
        <div className="level-left">
          <div>
            <h1 className="title is-4 mb-1">
              {event.source}{event.source_ref ? ` · ${event.source_ref}` : ''}
            </h1>
            <p className="is-size-7 has-text-grey">
              {event.event_class ?? 'unclassified'} · confidence {event.confidence != null ? event.confidence.toFixed(2) : '—'} · {formatDate(event.created_at)}
            </p>
          </div>
        </div>
        <div className="level-right">
          <StatusBadge status={event.status} />
        </div>
      </div>

      {error && <div className="notification is-danger is-light">{error}</div>}

      {event.blocking_reasons.length > 0 && (
        <div className="notification is-warning is-light">
          <strong>Blocking reasons:</strong>{' '}
          {event.blocking_reasons.map((r) => (
            <span key={r} className="tag is-warning ml-1">{r}</span>
          ))}
        </div>
      )}

      {event.status === 'promoted' && event.promoted_to && (
        <div className="notification is-success is-light">
          <strong>Promoted to:</strong>{' '}
          {event.promoted_to.map((p) => (
            <Link key={p.id} href={`/${p.table === 'companies' ? 'companies' : 'contacts'}/${p.id}`} className="tag is-success ml-1">
              {p.table}/{p.id.slice(0, 8)}
            </Link>
          ))}
        </div>
      )}

      {/* ── Proposed records (editable to resolve needs_info) ── */}
      {!isTerminal && (
        <div className="box">
          <h2 className="title is-6 mb-3">Proposed records</h2>
          <p className="is-size-7 has-text-grey mb-4">
            Fix missing required fields (marked *), then re-classify. Promotion unlocks once status is <em>ready</em>.
          </p>

          <div className="columns">
            <div className="column">
              <p className="has-text-weight-semibold mb-2">
                Company {hasCompanyId && <span className="tag is-light is-small">linking existing</span>}
              </p>
              {COMPANY_FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label className="label is-small">{f.label}</label>
                  <div className="control">
                    <input
                      className="input is-small"
                      value={company[f.key]}
                      disabled={hasCompanyId || isTerminal}
                      onChange={(e) => setCompany((c) => ({ ...c, [f.key]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="column">
              <p className="has-text-weight-semibold mb-2">Contact</p>
              {CONTACT_FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label className="label is-small">{f.label}</label>
                  <div className="control">
                    <input
                      className="input is-small"
                      value={contact[f.key]}
                      disabled={isTerminal}
                      onChange={(e) => setContact((c) => ({ ...c, [f.key]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="button is-small" disabled={pending} onClick={saveAndClassify}>
            Save &amp; re-classify
          </button>
        </div>
      )}

      {/* ── Actions ── */}
      {!isTerminal && (
        <div className="box">
          <h2 className="title is-6 mb-3">Actions</h2>
          <div className="buttons">
            <button
              className="button is-info is-small"
              disabled={pending}
              onClick={() => run(() => classifyStagingEvent(event.id))}
            >
              Re-run classify
            </button>
            <button
              className="button is-success is-small"
              disabled={pending || !canPromote}
              title={canPromote ? '' : 'Event must be "ready" to promote'}
              onClick={() => run(() => promoteStagingEventAction(event.id))}
            >
              Promote
            </button>
          </div>

          <div className="field mt-3">
            <label className="label is-small">Reject (optional note)</label>
            <div className="field has-addons">
              <div className="control is-expanded">
                <input
                  className="input is-small"
                  placeholder="Reason for rejection…"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                />
              </div>
              <div className="control">
                <button
                  className="button is-danger is-small is-outlined"
                  disabled={pending}
                  onClick={() => run(() => rejectStagingEvent(event.id, rejectNote || undefined))}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payloads ── */}
      <div className="box">
        <h2 className="title is-6 mb-3">Payloads</h2>
        <p className="has-text-weight-semibold is-size-7 mb-1">Proposed links</p>
        <Pre value={event.proposed_links} />
        <p className="has-text-weight-semibold is-size-7 mt-4 mb-1">Extracted</p>
        <Pre value={event.extracted} />
        <p className="has-text-weight-semibold is-size-7 mt-4 mb-1">Raw payload</p>
        <Pre value={event.raw_payload} />
      </div>

      {/* ── Audit log ── */}
      <div className="box">
        <h2 className="title is-6 mb-3">History</h2>
        {log.length === 0 ? (
          <p className="has-text-grey is-size-7">No transitions yet.</p>
        ) : (
          <table className="table is-fullwidth is-narrow is-size-7">
            <thead>
              <tr><th>When</th><th>Action</th><th>Transition</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="has-text-grey">{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.action}</td>
                  <td className="has-text-grey">{(l.from_status ?? '∅')} → {(l.to_status ?? '∅')}</td>
                  <td><code style={{ fontSize: '0.7rem' }}>{l.detail ? JSON.stringify(l.detail) : '—'}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
