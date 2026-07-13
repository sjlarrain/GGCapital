'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import StatusBadge from './StatusBadge'
import Modal from '@/components/ui/Modal'
import { STAGING_STATUSES, type StagingStatus } from '@/lib/schemas/staging'

type EventRow = {
  id: string
  source: string
  source_ref: string | null
  event_class: string | null
  confidence: number | null
  status: StagingStatus
  blocking_reasons: string[]
  created_at: string
}

const STATUS_LABEL: Record<StagingStatus, string> = {
  pending: 'Pending', classified: 'Classified', needs_info: 'Needs info',
  ready: 'Ready', promoted: 'Promoted', rejected: 'Rejected',
}

export default function TriageTable({ events }: { events: EventRow[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | StagingStatus>('')
  const [infoOpen, setInfoOpen] = useState(false)

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of events) c[e.status] = (c[e.status] ?? 0) + 1
    return c
  }, [events])

  const filtered = useMemo(() => {
    let list = events
    if (statusFilter) list = list.filter((e) => e.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (e) =>
          e.source.toLowerCase().includes(q) ||
          (e.source_ref ?? '').toLowerCase().includes(q) ||
          (e.event_class ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [events, search, statusFilter])

  return (
    <>
      <div className="level mb-4">
        <div className="level-left">
          <div>
            <h1 className="title is-4 mb-0">
              Triage
              <button
                className="button is-small is-ghost"
                style={{ verticalAlign: 'middle', marginLeft: 6 }}
                aria-label="What is Triage?"
                title="What is Triage?"
                onClick={() => setInfoOpen(true)}
              >
                ⓘ
              </button>
            </h1>
            <p className="is-size-7 has-text-grey">{filtered.length} of {events.length} staged events</p>
          </div>
        </div>
        <div className="level-right" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="level-item">
            <div className="field mb-0">
              <div className="control has-icons-left">
                <input
                  className="input is-small"
                  style={{ width: 220 }}
                  placeholder="Search source, ref, class…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="icon is-small is-left">🔍</span>
              </div>
            </div>
          </div>
          <div className="level-item">
            <div className="select is-small">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | StagingStatus)}>
                <option value="">All statuses</option>
                {STAGING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}{counts[s] ? ` (${counts[s]})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="gg-table-box">
        <table className="table is-fullwidth is-hoverable mb-0">
          <thead>
            <tr>
              <th>Source</th>
              <th>Class</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>Blocking</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="has-text-centered has-text-grey py-5">
                  No staged events.
                </td>
              </tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/triage/${e.id}`} className="has-text-link has-text-weight-medium">
                    {e.source}{e.source_ref ? ` · ${e.source_ref}` : ''}
                  </Link>
                </td>
                <td className="has-text-grey">{e.event_class ?? '—'}</td>
                <td className="has-text-grey">{e.confidence != null ? e.confidence.toFixed(2) : '—'}</td>
                <td><StatusBadge status={e.status} /></td>
                <td>
                  {e.blocking_reasons.length === 0 ? (
                    <span className="has-text-grey">—</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {e.blocking_reasons.map((r) => (
                        <span key={r} className="tag is-warning is-light is-small">{r}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="has-text-grey">{formatDate(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title="What is Triage?">
        <p className="mb-3">
          Triage is the review queue for events an AI agent has extracted from Gmail —
          proposed new contacts, companies, or meetings — before anything touches the real CRM.
        </p>
        <p className="mb-3">
          Each row is a staged event. Open one to check or edit the extracted fields, then either:
        </p>
        <ul className="mb-3" style={{ paddingLeft: '1.25rem', listStyle: 'disc' }}>
          <li><strong>Promote</strong> — writes it into Contacts/Companies/Meetings (admin only).</li>
          <li><strong>Reject</strong> — discards it, with an optional note explaining why.</li>
        </ul>
        <p className="has-text-grey is-size-7">
          Status moves through Pending → Classified → Ready (or Needs info) → Promoted/Rejected.
        </p>
      </Modal>
    </>
  )
}
