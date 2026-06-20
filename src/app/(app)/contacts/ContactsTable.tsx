'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Drawer from '@/components/Drawer'
import ContactForm from '@/components/forms/ContactForm'
import Badge from '@/components/ui/Badge'
import type { TagCatalogs } from '@/types'

type ContactRow = {
  id: string
  name: string
  role: string | null
  email: string | null
  company: { id: string; name: string } | null
}

type SortKey = 'name' | 'company' | 'role'

interface Props {
  contacts: ContactRow[]
  followUpContactIds: string[]
  tags: TagCatalogs
  companies: { id: string; name: string }[]
  userId: string
}

export default function ContactsTable({ contacts, followUpContactIds, tags, companies, userId }: Props) {
  const router = useRouter()
  const followUpIds = new Set(followUpContactIds)

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [followUpOnly, setFollowUpOnly] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = contacts
    if (followUpOnly) list = list.filter((c) => followUpIds.has(c.id))
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.role ?? '').toLowerCase().includes(q) ||
          (c.company?.name ?? '').toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      let av = '', bv = ''
      if (sortKey === 'name') { av = a.name; bv = b.name }
      else if (sortKey === 'company') { av = a.company?.name ?? ''; bv = b.company?.name ?? '' }
      else if (sortKey === 'role') { av = a.role ?? ''; bv = b.role ?? '' }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [contacts, search, sortKey, sortDir, followUpOnly, followUpIds])

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
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="New Contact" side="right">
        <ContactForm
          tags={tags}
          companies={companies}
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
            <h1 className="title is-4 mb-0">Contacts</h1>
            <p className="is-size-7 has-text-grey">{filtered.length} of {contacts.length} records</p>
          </div>
        </div>
        <div className="level-right" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="level-item">
            <div className="field mb-0">
              <div className="control has-icons-left">
                <input
                  className="input is-small"
                  style={{ width: 200 }}
                  placeholder="Search name, email, company…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="icon is-small is-left">🔍</span>
              </div>
            </div>
          </div>
          <div className="level-item">
            <button
              className={`button is-small gg-filter-chip ${followUpOnly ? 'is-warning' : 'is-light'}`}
              onClick={() => setFollowUpOnly((v) => !v)}
            >
              🔔 Follow-ups
            </button>
          </div>
          <div className="level-item">
            <button className="button is-primary is-small" onClick={() => setDrawerOpen(true)}>
              + New Contact
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
              <th className="is-sortable" onClick={() => toggleSort('role')}>
                Role <SortIcon k="role" />
              </th>
              <th className="is-sortable" onClick={() => toggleSort('company')}>
                Company <SortIcon k="company" />
              </th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="has-text-centered has-text-grey py-5">
                  No contacts found.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/contacts/${c.id}`} className="has-text-link has-text-weight-medium">
                    {c.name}
                  </Link>
                  {followUpIds.has(c.id) && <span className="ml-2">🔔</span>}
                </td>
                <td className="has-text-grey">{c.role ?? '—'}</td>
                <td>
                  {c.company ? (
                    <Link href={`/companies/${c.company.id}`} className="has-text-link">
                      {c.company.name}
                    </Link>
                  ) : '—'}
                </td>
                <td className="has-text-grey">{c.email ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
