import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getFollowUpContacts } from '@/lib/actions/interactions'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [companies, contacts, meetings, followUps] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('meetings').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    getFollowUpContacts(),
  ])

  const stats = [
    { label: 'Companies', count: companies.count ?? 0, href: '/companies', icon: '🏢' },
    { label: 'Contacts', count: contacts.count ?? 0, href: '/contacts', icon: '👤' },
    { label: 'Meetings', count: meetings.count ?? 0, href: '/meetings', icon: '📅' },
    { label: 'Follow-ups due', count: followUps.length, href: '/contacts?filter=followup', icon: '🔔' },
  ]

  const quickCreate = [
    { label: 'New Company', href: '/companies/new' },
    { label: 'New Contact', href: '/contacts/new' },
    { label: 'New Meeting', href: '/meetings/new' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your CRM</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
          >
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-3xl font-bold text-gray-900">{s.count}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick create</h2>
        <div className="flex gap-3">
          {quickCreate.map((q) => (
            <Link
              key={q.label}
              href={q.href}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              + {q.label}
            </Link>
          ))}
        </div>
      </div>

      {followUps.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Follow-ups due</h2>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {followUps.slice(0, 5).map((fu) => (
              <Link
                key={fu.contact_id}
                href={`/contacts/${fu.contact_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <span className="text-yellow-500">🔔</span>
                <span className="text-sm font-medium text-gray-900">
                  {(fu.contact as unknown as { name: string } | null)?.name ?? 'Unknown'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
