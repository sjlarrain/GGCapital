'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { restoreContact, hardDeleteContact } from '@/lib/actions/contacts'
import { restoreCompany, hardDeleteCompany } from '@/lib/actions/companies'
import { restoreMeeting, hardDeleteMeeting } from '@/lib/actions/meetings'

type EntityType = 'contact' | 'company' | 'meeting'

interface TrashRow {
  id: string
  label: string
  deleted_at: string
}

interface Props {
  contacts: TrashRow[]
  companies: TrashRow[]
  meetings: TrashRow[]
  userId: string
  isAdmin: boolean
}

function Section({
  title, rows, entityType, userId, isAdmin, router,
}: {
  title: string
  rows: TrashRow[]
  entityType: EntityType
  userId: string
  isAdmin: boolean
  router: ReturnType<typeof useRouter>
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const restore = async (id: string) => {
    setPendingId(id)
    try {
      if (entityType === 'contact') await restoreContact(id, userId)
      if (entityType === 'company') await restoreCompany(id, userId)
      if (entityType === 'meeting') await restoreMeeting(id, userId)
      startTransition(() => router.refresh())
    } finally {
      setPendingId(null)
    }
  }

  const hardDelete = async (id: string) => {
    setPendingId(id)
    try {
      if (entityType === 'contact') await hardDeleteContact(id)
      if (entityType === 'company') await hardDeleteCompany(id)
      if (entityType === 'meeting') await hardDeleteMeeting(id)
      startTransition(() => router.refresh())
    } finally {
      setPendingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <div className="box mb-4">
      <p className="is-size-6 has-text-weight-semibold mb-3">{title} ({rows.length})</p>
      {rows.length === 0 ? (
        <p className="has-text-grey is-size-7">Nothing in trash.</p>
      ) : (
        <table className="table is-fullwidth is-hoverable mb-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Deleted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.label}</td>
                <td className="has-text-grey is-size-7">{formatDate(r.deleted_at)}</td>
                <td>
                  <div className="buttons">
                    <button
                      className="button is-small is-link is-light"
                      disabled={pendingId === r.id}
                      onClick={() => restore(r.id)}
                    >
                      {pendingId === r.id && confirmingId !== r.id ? '…' : 'Restore'}
                    </button>
                    {isAdmin && (
                      confirmingId === r.id ? (
                        <>
                          <span className="has-text-danger is-size-7 mr-1" style={{ alignSelf: 'center' }}>Forever?</span>
                          <button
                            className="button is-small is-danger"
                            disabled={pendingId === r.id}
                            onClick={() => hardDelete(r.id)}
                          >
                            {pendingId === r.id ? '…' : 'Yes, delete forever'}
                          </button>
                          <button className="button is-small is-ghost" onClick={() => setConfirmingId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="button is-small is-danger is-outlined"
                          disabled={pendingId === r.id}
                          onClick={() => setConfirmingId(r.id)}
                        >
                          Delete forever
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function TrashTable({ contacts, companies, meetings, userId, isAdmin }: Props) {
  const router = useRouter()

  return (
    <>
      <div className="mb-4">
        <h1 className="title is-4 mb-0">Trash</h1>
        <p className="is-size-7 has-text-grey">
          Deleted contacts, companies, and meetings. Anyone can restore an item —
          {isAdmin ? ' as an admin you can also permanently delete.' : ' permanent deletion is admin-only.'}
        </p>
      </div>
      <Section title="Companies" rows={companies} entityType="company" userId={userId} isAdmin={isAdmin} router={router} />
      <Section title="Contacts" rows={contacts} entityType="contact" userId={userId} isAdmin={isAdmin} router={router} />
      <Section title="Meetings" rows={meetings} entityType="meeting" userId={userId} isAdmin={isAdmin} router={router} />
    </>
  )
}
