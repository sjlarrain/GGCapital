import Link from 'next/link'
import { getContacts } from '@/lib/actions/contacts'
import { getFollowUpContacts } from '@/lib/actions/interactions'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  const [allContacts, followUps] = await Promise.all([
    getContacts(),
    filter === 'followup' ? getFollowUpContacts() : Promise.resolve([]),
  ])

  const followUpIds = new Set(followUps.map((f) => f.contact_id))
  const contacts = filter === 'followup'
    ? allContacts.filter((c) => followUpIds.has(c.id))
    : allContacts

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500">{contacts.length} records</p>
        </div>
        <div className="flex gap-2">
          {filter === 'followup' ? (
            <Link href="/contacts">
              <Button variant="secondary" size="sm">Clear filter</Button>
            </Link>
          ) : (
            <Link href="/contacts?filter=followup">
              <Button variant="secondary" size="sm">🔔 Follow-ups</Button>
            </Link>
          )}
          <Link href="/contacts/new">
            <Button>+ New Contact</Button>
          </Link>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">
                  No contacts yet.{' '}
                  <Link href="/contacts/new" className="text-blue-600 hover:underline">Create one</Link>
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/contacts/${c.id}`} className="text-blue-600 hover:underline flex items-center gap-1">
                    {c.name}
                    {followUpIds.has(c.id) && <span className="text-yellow-500 text-xs">🔔</span>}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.role ?? '—'}</td>
                <td className="px-4 py-3">
                  {(c.company as { id: string; name: string } | null) ? (
                    <Link href={`/companies/${(c.company as { id: string; name: string }).id}`} className="text-blue-600 hover:underline">
                      {(c.company as { id: string; name: string }).name}
                    </Link>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
