'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Drawer from '@/components/Drawer'
import ContactForm from '@/components/forms/ContactForm'
import CompanyForm from '@/components/forms/CompanyForm'
import MeetingForm from '@/components/forms/MeetingForm'
import type { TagCatalogs } from '@/types'

type OrgType = 'company' | 'fund' | 'investor'
type QuickCreate = 'org' | 'contact' | 'meeting' | null

interface Stat {
  label: string
  count: number
  href: string
  icon: string
}

interface FollowUp {
  contact_id: string
  contact: unknown
}

interface Props {
  stats: Stat[]
  followUps: FollowUp[]
  tags: TagCatalogs
  companies: { id: string; name: string; industry_ids: string[]; region_ids: string[]; stage_ids: string[] }[]
  contacts: { id: string; name: string; role: string | null }[]
  userId: string
}

const ORG_TABS: { type: OrgType; icon: string; label: string }[] = [
  { type: 'company', icon: '🏢', label: 'Company' },
  { type: 'fund',    icon: '💰', label: 'Fund' },
  { type: 'investor',icon: '📊', label: 'Investor & Network' },
]

const drawerTitle: Record<NonNullable<QuickCreate>, string> = {
  org:     'New Org',
  contact: 'New Contact',
  meeting: 'Log Meeting',
}

export default function DashboardClient({ stats, followUps, tags, companies, contacts, userId }: Props) {
  const router = useRouter()
  const [quickCreate, setQuickCreate] = useState<QuickCreate>(null)
  const [orgType, setOrgType] = useState<OrgType | null>(null)

  const close = () => { setQuickCreate(null); setOrgType(null) }
  const done  = () => { close(); router.refresh() }

  return (
    <>
      {/* Single right-side drawer for all quick-create flows */}
      <Drawer
        open={quickCreate !== null}
        onClose={close}
        title={quickCreate ? drawerTitle[quickCreate] : ''}
        side="right"
      >
        {/* ── Org section ── */}
        {quickCreate === 'org' && (
          <div>
            {/* Horizontal type selector — always visible, highlights active tab */}
            <div className="buttons has-addons mb-5" style={{ width: '100%' }}>
              {ORG_TABS.map(({ type, icon, label }) => (
                <button
                  key={type}
                  className={`button is-small${orgType === type ? ' is-primary' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setOrgType(type)}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Prompt shown until a type is chosen */}
            <div hidden={orgType !== null}>
              <p className="has-text-grey is-size-7">Select a type above to get started.</p>
            </div>

            {/* All three forms in the DOM; hidden toggles which one is visible */}
            <div hidden={orgType !== 'company'}>
              <CompanyForm tags={tags} userId={userId} mode="company" onSuccess={done} />
            </div>
            <div hidden={orgType !== 'fund'}>
              <CompanyForm tags={tags} userId={userId} mode="fund" onSuccess={done} />
            </div>
            <div hidden={orgType !== 'investor'}>
              <CompanyForm tags={tags} userId={userId} mode="investor" onSuccess={done} />
            </div>
          </div>
        )}

        {/* ── Contact section ── */}
        {quickCreate === 'contact' && (
          <ContactForm tags={tags} companies={companies} userId={userId} onSuccess={done} />
        )}

        {/* ── Meeting section ── */}
        {quickCreate === 'meeting' && (
          <MeetingForm
            companies={companies}
            contacts={contacts}
            meetingTypes={tags.meetingTypes}
            tags={tags}
            userId={userId}
            onSuccess={done}
          />
        )}
      </Drawer>

      <div>
        <div className="mb-6">
          <h1 className="title is-3">Dashboard</h1>
          <p className="subtitle is-6 has-text-grey">Overview of your CRM</p>
        </div>

        <div className="columns is-multiline mb-6">
          {stats.map((s) => (
            <div key={s.label} className="column is-half-tablet is-one-third-desktop">
              <Link href={s.href} style={{ textDecoration: 'none' }}>
                <div className="box has-text-centered" style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>{s.icon}</div>
                  <p className="title is-2 mb-1">{s.count}</p>
                  <p className="is-size-7 has-text-grey">{s.label}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <p className="is-size-6 has-text-weight-semibold mb-3">Quick create</p>
          <div className="buttons">
            <button
              className="button is-info is-light"
              onClick={() => { setOrgType(null); setQuickCreate('org') }}
            >
              🏢 New Org
            </button>
            <button
              className="button is-primary is-light"
              onClick={() => setQuickCreate('contact')}
            >
              👤 New Contact
            </button>
            <button
              className="button is-success is-light"
              onClick={() => setQuickCreate('meeting')}
            >
              📅 Log Meeting
            </button>
          </div>
        </div>

        {followUps.length > 0 && (
          <div>
            <p className="is-size-6 has-text-weight-semibold mb-3">Follow-ups due</p>
            <div className="box p-0" style={{ overflow: 'hidden' }}>
              {followUps.slice(0, 5).map((fu) => (
                <Link
                  key={fu.contact_id}
                  href={`/contacts/${fu.contact_id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem', borderBottom: '1px solid #f5f5f5', textDecoration: 'none' }}
                >
                  <span>🔔</span>
                  <span className="is-size-7 has-text-weight-medium">
                    {(fu.contact as { name: string } | null)?.name ?? 'Unknown'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
