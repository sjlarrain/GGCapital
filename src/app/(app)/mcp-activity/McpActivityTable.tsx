'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import type { McpActivityEntityTable } from '@/lib/mcp/activity'

type ActivityRow = {
  id: string
  tool_name: string
  actor: string
  actor_email: string | null
  auth_type: string
  entity_table: McpActivityEntityTable | null
  entity_id: string | null
  summary: string
  created_at: string
}

const ENTITY_LABEL: Record<McpActivityEntityTable, string> = {
  companies: 'Company', contacts: 'Contact', meetings: 'Meeting', staging_events: 'Staging',
  intros: 'Intro', network_entities: 'Network node', relationship_sources: 'Relationship source',
}

function entityHref(table: McpActivityEntityTable | null, id: string | null): string | null {
  if (!id) return null
  switch (table) {
    case 'companies': return `/companies/${id}`
    case 'contacts': return `/contacts/${id}`
    case 'meetings': return `/meetings/${id}`
    case 'staging_events': return `/triage/${id}`
    case 'intros':
    case 'network_entities':
      return '/network'
    default: return null
  }
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function McpActivityTable({ rows }: { rows: ActivityRow[] }) {
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState<'' | McpActivityEntityTable>('')
  const [infoOpen, setInfoOpen] = useState(false)

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows) if (r.entity_table) c[r.entity_table] = (c[r.entity_table] ?? 0) + 1
    return c
  }, [rows])

  const filtered = useMemo(() => {
    let list = rows
    if (entityFilter) list = list.filter((r) => r.entity_table === entityFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (r) =>
          r.tool_name.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          (r.actor_email ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [rows, search, entityFilter])

  return (
    <>
      <div className="level mb-4">
        <div className="level-left">
          <div>
            <h1 className="title is-4 mb-0">
              MCP Activity
              <button
                className="button is-small is-ghost"
                style={{ verticalAlign: 'middle', marginLeft: 6 }}
                aria-label="What is MCP Activity?"
                title="What is MCP Activity?"
                onClick={() => setInfoOpen(true)}
              >
                ⓘ
              </button>
            </h1>
            <p className="is-size-7 has-text-grey">{filtered.length} of {rows.length} recent writes</p>
          </div>
        </div>
        <div className="level-right" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="level-item">
            <div className="field mb-0">
              <div className="control has-icons-left">
                <input
                  className="input is-small"
                  style={{ width: 240 }}
                  placeholder="Search tool, summary, user…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="icon is-small is-left">🔍</span>
              </div>
            </div>
          </div>
          <div className="level-item">
            <div className="select is-small">
              <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value as '' | McpActivityEntityTable)}>
                <option value="">All records</option>
                {(Object.keys(ENTITY_LABEL) as McpActivityEntityTable[]).map((t) => (
                  <option key={t} value={t}>
                    {ENTITY_LABEL[t]}{counts[t] ? ` (${counts[t]})` : ''}
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
              <th>When</th>
              <th>Tool</th>
              <th>Record</th>
              <th>Summary</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="has-text-centered has-text-grey py-5">
                  No MCP activity yet.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const href = entityHref(r.entity_table, r.entity_id)
              return (
                <tr key={r.id}>
                  <td className="has-text-grey" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.created_at)}</td>
                  <td><code>{r.tool_name}</code></td>
                  <td className="has-text-grey">{r.entity_table ? ENTITY_LABEL[r.entity_table] : '—'}</td>
                  <td>
                    {href ? (
                      <Link href={href} className="has-text-link has-text-weight-medium">{r.summary}</Link>
                    ) : (
                      r.summary
                    )}
                  </td>
                  <td className="has-text-grey">
                    {r.actor_email ?? r.actor}
                    <span className="tag is-light is-small ml-1">{r.auth_type}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title="What is MCP Activity?">
        <p className="mb-3">
          A feed of everything an MCP-connected agent (Claude Desktop skills, PATs, OAuth
          integrations) has written recently — companies, contacts, meetings, network intros, and
          staged events.
        </p>
        <p className="mb-3">
          Unlike <strong>Triage</strong>, which only shows low-confidence events held for review,
          this includes writes that went straight into the live CRM. It is read-only: use it to spot
          what an agent actually did, then edit or delete the record itself if something needs fixing.
        </p>
      </Modal>
    </>
  )
}
