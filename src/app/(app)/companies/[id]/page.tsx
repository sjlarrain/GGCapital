import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompany, softDeleteCompany } from '@/lib/actions/companies'
import { getTagCatalogs } from '@/lib/actions/tags'
import { getCompanyMeetings } from '@/lib/actions/meetings'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import SoftDeleteButton from '@/components/SoftDeleteButton'

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [company, tags, meetings] = await Promise.all([
    getCompany(id).catch(() => null),
    getTagCatalogs(),
    getCompanyMeetings(id),
  ])

  if (!company) notFound()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, role, email')
    .eq('company_id', id)
    .is('deleted_at', null)
    .order('name')

  const tagName = (tagId: string | null, catalog: { id: string; name: string }[]) =>
    catalog.find((t) => t.id === tagId)?.name

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/companies" className="text-sm text-gray-500 hover:underline">← Companies</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{company.name}</h1>
          {company.deleted_at && (
            <Badge variant="red" className="mt-1">Deleted</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/companies/${id}/edit`}>
            <Button variant="secondary" size="sm">Edit</Button>
          </Link>
          {!company.deleted_at && (
            <SoftDeleteButton entityType="company" id={id} userId={user!.id} />
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        {company.description && (
          <p className="text-gray-700">{company.description}</p>
        )}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Type: </span>
            <span>{tagName(company.type_id, tags.types) ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Stage: </span>
            <span>{tagName(company.stage_id, tags.stages) ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Status: </span>
            <span>{tagName(company.status_id, tags.statuses) ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Source: </span>
            <span>{company.source ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Created: </span>
            <span>{formatDate(company.created_at)}</span>
          </div>
        </div>
        {((company.industry_ids ?? []) as string[]).length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {(company.industry_ids as string[]).map((tagId: string) => (
              <Badge key={tagId} variant="blue">
                {tags.industries.find((t) => t.id === tagId)?.name}
              </Badge>
            ))}
          </div>
        )}
        {((company.region_ids ?? []) as string[]).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(company.region_ids as string[]).map((tagId: string) => (
              <Badge key={tagId} variant="green">
                {tags.regions.find((t) => t.id === tagId)?.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Contacts panel */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-gray-800">Contacts ({contacts?.length ?? 0})</h2>
          <Link href={`/contacts/new?company=${id}`}>
            <Button variant="secondary" size="sm">+ Add Contact</Button>
          </Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {(contacts ?? []).length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">No contacts linked.</p>
          )}
          {(contacts ?? []).map((c) => (
            <Link key={c.id} href={`/contacts/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500">{c.role ?? c.email ?? ''}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Meetings panel */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-gray-800">Meetings ({meetings.length})</h2>
          <Link href={`/meetings/new?company=${id}`}>
            <Button variant="secondary" size="sm">+ Log Meeting</Button>
          </Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {meetings.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">No meetings yet.</p>
          )}
          {meetings.map((m) => (
            <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <p className="text-sm font-medium text-gray-900">{m.title}</p>
              <p className="text-xs text-gray-500">{formatDate(m.date)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
