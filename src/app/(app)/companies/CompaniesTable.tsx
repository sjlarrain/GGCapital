'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Drawer from '@/components/Drawer'
import CompanyForm from '@/components/forms/CompanyForm'
import Badge from '@/components/ui/Badge'
import SearchableSelect from '@/components/SearchableSelect'
import type { TagCatalogs } from '@/types'

type CompanyRow = {
  id: string
  name: string
  type_id: string | null
  stage_ids: string[]
  status_id: string | null
  industry_ids: string[] | null
  region_ids: string[] | null
  round_size_musd?: number | null
  website?: string | null
  country?: string | null
}

const effStageIds = (c: CompanyRow): string[] => c.stage_ids

type SortKey = 'name' | 'stage' | 'country' | 'status'

interface Props {
  companies: CompanyRow[]
  tags: TagCatalogs
  userId: string
  defaultView?: string
}

const VIEW_LABELS: Record<string, string> = {
  companies: 'Companies',
  funds: 'Funds',
  investors: 'Investors & Network',
}

export default function CompaniesTable({ companies, tags, userId, defaultView }: Props) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [stageFilter, setStageFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isFundsView = defaultView === 'funds'
  const drawerTitle = isFundsView ? 'New Fund'
    : defaultView === 'investors' ? 'New Investor & Network'
    : 'New Company'
  const newButtonLabel = isFundsView ? '+ New Fund'
    : defaultView === 'investors' ? '+ New Investor & Network'
    : '+ New Company'
  const formMode: 'fund' | 'investor' | 'company' = isFundsView ? 'fund'
    : defaultView === 'investors' ? 'investor'
    : 'company'

  const countryOptions = useMemo(() => {
    const names = Array.from(new Set(companies.map((c) => c.country).filter((c): c is string => !!c)))
    return names.sort((a, b) => a.localeCompare(b)).map((c) => ({ id: c, label: c }))
  }, [companies])

  const filtered = useMemo(() => {
    // Compute type-based view filter
    const companyTypeId = tags.types.find((t) => t.name === 'Company')?.id
    const fundTypeIds = new Set(tags.types.filter((t) => ['VC', 'Fund'].includes(t.name)).map((t) => t.id))

    let list = companies
    if (defaultView === 'companies') {
      list = list.filter((c) => c.type_id === companyTypeId)
    } else if (defaultView === 'funds') {
      list = list.filter((c) => c.type_id != null && fundTypeIds.has(c.type_id))
    } else if (defaultView === 'investors') {
      list = list.filter((c) => !c.type_id || (!fundTypeIds.has(c.type_id) && c.type_id !== companyTypeId))
    }

    if (stageFilter) list = list.filter((c) => effStageIds(c).includes(stageFilter))
    if (statusFilter) list = list.filter((c) => c.status_id === statusFilter)
    if (regionFilter) list = list.filter((c) => (c.region_ids ?? []).includes(regionFilter))
    if (countryFilter) list = list.filter((c) => c.country === countryFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      let av = '', bv = ''
      if (sortKey === 'name') { av = a.name; bv = b.name }
      else if (sortKey === 'stage') {
        av = effStageIds(a).map(id => tags.stages.find((t) => t.id === id)?.name ?? '').join(',')
        bv = effStageIds(b).map(id => tags.stages.find((t) => t.id === id)?.name ?? '').join(',')
      } else if (sortKey === 'country') {
        av = a.country ?? ''; bv = b.country ?? ''
      } else if (sortKey === 'status') {
        av = tags.statuses.find((t) => t.id === a.status_id)?.name ?? ''
        bv = tags.statuses.find((t) => t.id === b.status_id)?.name ?? ''
      }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [companies, search, sortKey, sortDir, stageFilter, statusFilter, regionFilter, countryFilter, tags, defaultView])

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
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={drawerTitle} side="right">
        <CompanyForm
          tags={tags}
          userId={userId}
          mode={formMode}
          onSuccess={() => {
            setDrawerOpen(false)
            router.refresh()
          }}
        />
      </Drawer>

      <div className="level mb-4">
        <div className="level-left">
          <div>
            <h1 className="title is-4 mb-0">{defaultView ? VIEW_LABELS[defaultView] : 'All Companies'}</h1>
            <p className="is-size-7 has-text-grey">{filtered.length} records</p>
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
            <SearchableSelect
              options={tags.stages.map((s) => ({ id: s.id, label: s.name }))}
              value={stageFilter}
              onChange={setStageFilter}
              placeholder={isFundsView ? 'All investment stages' : 'All stages'}
              clearLabel={isFundsView ? 'All investment stages' : 'All stages'}
              size="small"
            />
          </div>
          {isFundsView && (
            <div className="level-item">
              <SearchableSelect
                options={tags.regions.map((s) => ({ id: s.id, label: s.name }))}
                value={regionFilter}
                onChange={setRegionFilter}
                placeholder="All geographies"
                clearLabel="All geographies"
                size="small"
              />
            </div>
          )}
          {isFundsView && (
            <div className="level-item">
              <SearchableSelect
                options={countryOptions}
                value={countryFilter}
                onChange={setCountryFilter}
                placeholder="All countries"
                clearLabel="All countries"
                size="small"
              />
            </div>
          )}
          <div className="level-item">
            <SearchableSelect
              options={tags.statuses.map((s) => ({ id: s.id, label: s.name }))}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All statuses"
              clearLabel="All statuses"
              size="small"
            />
          </div>
          <div className="level-item">
            <button className="button is-primary is-small" onClick={() => setDrawerOpen(true)}>
              {newButtonLabel}
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
              {isFundsView ? (
                <th className="is-sortable" onClick={() => toggleSort('country')}>
                  Country <SortIcon k="country" />
                </th>
              ) : (
                <th>Type</th>
              )}
              {isFundsView && <th>Thesis</th>}
              {isFundsView && <th>Fund Size</th>}
              <th className="is-sortable" onClick={() => toggleSort('stage')}>
                {isFundsView ? 'Investment Stage' : 'Stage'} <SortIcon k="stage" />
              </th>
              {isFundsView && <th>Investment Geography</th>}
              <th className="is-sortable" onClick={() => toggleSort('status')}>
                Status <SortIcon k="status" />
              </th>
              {!isFundsView && <th>Industries</th>}
              {isFundsView && <th>Website</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isFundsView ? 8 : 5} className="has-text-centered has-text-grey py-5">
                  No {isFundsView ? 'funds' : defaultView === 'investors' ? 'investors' : 'companies'} found.
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
                {isFundsView ? (
                  <td className="has-text-grey">{c.country ?? '—'}</td>
                ) : (
                  <td className="has-text-grey">
                    {c.type_id ? tags.types.find((t) => t.id === c.type_id)?.name : '—'}
                  </td>
                )}
                {isFundsView && (
                  <td>
                    <div className="tags">
                      {(c.industry_ids ?? []).map((id) => {
                        const name = tags.industries.find((t) => t.id === id)?.name
                        return name ? <Badge key={id} variant="blue">{name}</Badge> : null
                      })}
                    </div>
                  </td>
                )}
                {isFundsView && (
                  <td className="has-text-grey is-size-7">
                    {c.round_size_musd != null ? `US$ ${c.round_size_musd}M` : '—'}
                  </td>
                )}
                <td>
                  {effStageIds(c).length > 0 ? (
                    <div className="tags">
                      {effStageIds(c).map((id) => {
                        const name = tags.stages.find((t) => t.id === id)?.name
                        return name ? <Badge key={id} variant="yellow">{name}</Badge> : null
                      })}
                    </div>
                  ) : <span className="has-text-grey">—</span>}
                </td>
                {isFundsView && (
                  <td>
                    <div className="tags">
                      {(c.region_ids ?? []).map((id) => {
                        const name = tags.regions.find((t) => t.id === id)?.name
                        return name ? <Badge key={id} variant="green">{name}</Badge> : null
                      })}
                    </div>
                  </td>
                )}
                <td>
                  {c.status_id ? (
                    <Badge>{tags.statuses.find((t) => t.id === c.status_id)?.name ?? '—'}</Badge>
                  ) : '—'}
                </td>
                {!isFundsView && (
                  <td>
                    <div className="tags">
                      {(c.industry_ids ?? []).map((id) => {
                        const name = tags.industries.find((t) => t.id === id)?.name
                        return name ? <Badge key={id} variant="blue">{name}</Badge> : null
                      })}
                    </div>
                  </td>
                )}
                {isFundsView && (
                  <td>
                    {c.website ? (
                      <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="is-size-7 has-text-link">
                        {c.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : <span className="has-text-grey">—</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
