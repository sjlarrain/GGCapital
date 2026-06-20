'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import ContactForm from '@/components/forms/ContactForm'
import CompanyForm from '@/components/forms/CompanyForm'
import MeetingForm from '@/components/forms/MeetingForm'
import type { TagCatalogs } from '@/types'

type ActiveForm = 'company' | 'contact' | 'meeting' | null

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
  companies: { id: string; name: string }[]
  contacts: { id: string; name: string; role: string | null }[]
  userId: string
}

const drawerTitle: Record<NonNullable<ActiveForm>, string> = {
  company: 'New Company',
  contact: 'New Contact',
  meeting: 'Log Meeting',
}

export default function DashboardClient({ stats, followUps, tags, companies, contacts, userId }: Props) {
  const router = useRouter()
  const [activeForm, setActiveForm] = useState<ActiveForm>(null)

  const close = () => setActiveForm(null)
  const done = () => { close(); router.refresh() }

  return (
    <>
      <Modal
        open={activeForm !== null}
        onClose={close}
        title={activeForm ? drawerTitle[activeForm] : ''}
        wide
      >
        {activeForm === 'company' && (
          <CompanyForm tags={tags} userId={userId} onSuccess={done} />
        )}
        {activeForm === 'contact' && (
          <ContactForm tags={tags} companies={companies} userId={userId} onSuccess={done} />
        )}
        {activeForm === 'meeting' && (
          <MeetingForm
            companies={companies}
            contacts={contacts}
            meetingTypes={tags.meetingTypes}
            tags={tags}
            userId={userId}
            onSuccess={done}
          />
        )}
      </Modal>

      <div>
        <div className="mb-6">
          <h1 className="title is-3">Dashboard</h1>
          <p className="subtitle is-6 has-text-grey">Overview of your CRM</p>
        </div>

        <div className="columns is-multiline mb-6">
          {stats.map((s) => (
            <div key={s.label} className="column is-half-tablet is-one-quarter-desktop">
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
            <button className="button is-info is-light" onClick={() => setActiveForm('company')}>
              🏢 New Company
            </button>
            <button className="button is-primary is-light" onClick={() => setActiveForm('contact')}>
              👤 New Contact
            </button>
            <button className="button is-success is-light" onClick={() => setActiveForm('meeting')}>
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
