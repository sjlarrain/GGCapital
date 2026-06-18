import Link from 'next/link'
import { getMeetings } from '@/lib/actions/meetings'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'

export default async function MeetingsPage() {
  const meetings = await getMeetings()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-sm text-gray-500">{meetings.length} records</p>
        </div>
        <Link href="/meetings/new">
          <Button>+ New Meeting</Button>
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Logged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {meetings.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-10 text-gray-400">
                  No meetings yet.{' '}
                  <Link href="/meetings/new" className="text-blue-600 hover:underline">Log one</Link>
                </td>
              </tr>
            )}
            {meetings.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/meetings/${m.id}`} className="text-blue-600 hover:underline">
                    {m.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{formatDate(m.date)}</td>
                <td className="px-4 py-3">
                  {(m.company as { id: string; name: string } | null) ? (
                    <Link href={`/companies/${(m.company as { id: string; name: string }).id}`} className="text-blue-600 hover:underline">
                      {(m.company as { id: string; name: string }).name}
                    </Link>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(m.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
