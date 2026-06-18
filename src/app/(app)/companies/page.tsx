import Link from 'next/link'
import { getCompanies } from '@/lib/actions/companies'
import { getTagCatalogs } from '@/lib/actions/tags'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

export default async function CompaniesPage() {
  const [companies, tags] = await Promise.all([getCompanies(), getTagCatalogs()])

  const tagName = (ids: string[], catalog: { id: string; name: string }[]) =>
    ids.map((id) => catalog.find((t) => t.id === id)?.name).filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500">{companies.length} records</p>
        </div>
        <Link href="/companies/new">
          <Button>+ New Company</Button>
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Industries</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companies.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  No companies yet.{' '}
                  <Link href="/companies/new" className="text-blue-600 hover:underline">
                    Create one
                  </Link>
                </td>
              </tr>
            )}
            {companies.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/companies/${c.id}`} className="text-blue-600 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {c.type_id ? tags.types.find((t) => t.id === c.type_id)?.name : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {c.stage_id ? tags.stages.find((t) => t.id === c.stage_id)?.name : '—'}
                </td>
                <td className="px-4 py-3">
                  {c.status_id ? (
                    <Badge>{tags.statuses.find((t) => t.id === c.status_id)?.name ?? '—'}</Badge>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {tagName(c.industry_ids ?? [], tags.industries).map((n) => (
                      <Badge key={n} variant="blue">{n}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
