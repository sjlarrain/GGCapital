'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import Drawer from '@/components/Drawer'
import MeetingForm from '@/components/forms/MeetingForm'
import type { TagCatalogs } from '@/types'

type MeetingRow = {
  id: string
  title: string
  date: string
  company: { id: string; name: string } | null
  meetingType?: { id: string; name: string } | null
}

type SortKey = 'title' | 'date' | 'company'

interface Props {
  meetings: MeetingRow[]
  companies: { id: string; name: string }[]
  contacts: { id: string; name: string; role: string | null }[]
  meetingTypes: { id: string; name: string }[]
  tags: TagCatalogs
  userId: string
}

export default function MeetingsTable({ meetings, companies, contacts, meetingTypes, tags, userId }: Props) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [typeFilter, setTypeFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = meetings
    if (typeFilter) list = list.filter((m) => m.meetingType?.id === typeFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.company?.name ?? '').toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      let av = '', bv = ''
      if (sortKey === 'title') { av = a.title; bv = b.title }
      else if (sortKey === 'date') { av = a.date; bv = b.date }
      else if (sortKey === 'company') { av = a.company?.name ?? ''; bv = b.company?.name ?? '' }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [meetings, search, sortKey, sortDir, typeFilter])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span> : (
      <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
    )

  return (
    <>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Log Meeting" side="right">
        <MeetingForm
          companies={companies}
          contacts={contacts}
          meetingTypes={meetingTypes}
          tags={tags}
          userId={userId}
          onSuccess={() => {
            setDrawerOpen(false)
            router.refresh()
          }}
        />
      </Drawer>

      <div className="level mb-4">
        <div className="level-left">
          <div>
            <h1 className="title is-4 mb-0">Meetings</h1>
            <p className="is-size-7 has-text-grey">{filtered.length} of {meetings.length} records</p>
          </div>
        </div>
        <div className="level-right" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="level-item">
            <div className="field mb-0">
              <div className="control has-icons-left">
                <input
                  className="input is-small"
                  style={{ width: 200 }}
                  placeholder="Search title, company…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="icon is-small is-left">🔍</span>
              </div>
            </div>
          </div>
          {meetingTypes.length > 0 && (
            <div className="level-item">
              <div className="field mb-0">
                <div className="control">
                  <div className="select is-small">
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                      <option value="">All types</option>
                      {meetingTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="level-item">
            <button className="button is-primary is-small" onClick={() => setDrawerOpen(true)}>
              + Log Meeting
            </button>
          </div>
        </div>
      </div>

      <div className="gg-table-box">
        <table className="table is-fullwidth is-hoverable mb-0">
          <thead>
            <tr>
              <th className="is-sortable" onClick={() => toggleSort('title')}>
                Title <SortIcon k="title" />
              </th>
              <th className="is-sortable" onClick={() => toggleSort('date')}>
                Date <SortIcon k="date" />
              </th>
              <th className="is-sortable" onClick={() => toggleSort('company')}>
                Company <SortIcon k="company" />
              </th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="has-text-centered has-text-grey py-5">
                  No meetings found.
                </td>
              </tr>
            )}
            {filtered.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={`/meetings/${m.id}`} className="has-text-link has-text-weight-medium">
                    {m.title}
                  </Link>
                </td>
                <td className="has-text-grey">{formatDate(m.date)}</td>
                <td>
                  {m.company ? (
                    <Link href={`/companies/${m.company.id}`} className="has-text-link">
                      {m.company.name}
                    </Link>
                  ) : '—'}
                </td>
                <td className="has-text-grey">{m.meetingType?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
