'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Drawer from '@/components/Drawer'
import CompanyForm from '@/components/forms/CompanyForm'
import Badge from '@/components/ui/Badge'
import type { TagCatalogs } from '@/types'

type CompanyRow = {
  id: string
  name: string
  type_id: string | null
  stage_id: string | null
  status_id: string | null
  industry_ids: string[] | null
}

type SortKey = 'name' | 'stage'

interface Props {
  companies: CompanyRow[]
  tags: TagCatalogs
  userId: string
}

export default function CompaniesTable({ companies, tags, userId }: Props) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [stageFilter, setStageFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = companies
    if (stageFilter) list = list.filter((c) => c.stage_id === stageFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      let av = '', bv = ''
      if (sortKey === 'name') { av = a.name; bv = b.name }
      else if (sortKey === 'stage') {
        av = tags.stages.find((t) => t.id === a.stage_id)?.name ?? ''
        bv = tags.stages.find((t) => t.id === b.stage_id)?.name ?? ''
      }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [companies, search, sortKey, sortDir, stageFilter, tags])

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
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="New Company" side="right">
        <CompanyForm
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
            <h1 className="title is-4 mb-0">Companies</h1>
            <p className="is-size-7 has-text-grey">{filtered.length} of {companies.length} records</p>
          </div>
        </div>
        <div className="level-right" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="level-item">
            <div className="field mb-0">
              <div className="control has-icons-left">
                <input
                  className="input is-small"
                  style={{ width: 200 }}
                  placeholder="Search company…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="icon is-small is-left">🔍</span>
              </div>
            </div>
          </div>
          <div className="level-item">
            <div className="field mb-0">
              <div className="control">
                <div className="select is-small">
                  <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                    <option value="">All stages</option>
                    {tags.stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="level-item">
            <button className="button is-primary is-small" onClick={() => setDrawerOpen(true)}>
              + New Company
            </button>
          </div>
        </div>
      </div>

      <div className="gg-table-box">
        <table className="table is-fullwidth is-hoverable mb-0">
          <thead>
            <tr>
              <th className="is-sortable" onClick={() => toggleSort('name')}>
                Name <SortIcon k="name" />
              </th>
              <th>Type</th>
              <th className="is-sortable" onClick={() => toggleSort('stage')}>
                Stage <SortIcon k="stage" />
              </th>
              <th>Status</th>
              <th>Industries</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="has-text-centered has-text-grey py-5">
                  No companies found.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/companies/${c.id}`} className="has-text-link has-text-weight-medium">
                    {c.name}
                  </Link>
                </td>
                <td className="has-text-grey">
                  {c.type_id ? tags.types.find((t) => t.id === c.type_id)?.name : '—'}
                </td>
                <td className="has-text-grey">
                  {c.stage_id ? tags.stages.find((t) => t.id === c.stage_id)?.name : '—'}
                </td>
                <td>
                  {c.status_id ? (
                    <Badge>{tags.statuses.find((t) => t.id === c.status_id)?.name ?? '—'}</Badge>
                  ) : '—'}
                </td>
                <td>
                  <div className="tags">
                    {(c.industry_ids ?? []).map((id) => {
                      const name = tags.industries.find((t) => t.id === id)?.name
                      return name ? <Badge key={id} variant="blue">{name}</Badge> : null
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
