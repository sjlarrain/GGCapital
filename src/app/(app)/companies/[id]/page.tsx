import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompany } from '@/lib/actions/companies'
import { getTagCatalogs } from '@/lib/actions/tags'
import { getCompanyMeetings } from '@/lib/actions/meetings'
import { formatDate } from '@/lib/utils'
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
    <div className="gg-detail">
      <div className="level mb-4">
        <div className="level-left">
          <div>
            <Link href="/companies" className="is-size-7 has-text-grey">← Companies</Link>
            <h1 className="title is-3 mt-1 mb-0">{company.name}</h1>
            {company.deleted_at && <Badge variant="red" className="mt-1">Deleted</Badge>}
          </div>
        </div>
        <div className="level-right">
          <div className="buttons">
            <Link href={`/companies/${id}/edit`} className="button is-light is-small">Edit</Link>
            {!company.deleted_at && (
              <SoftDeleteButton entityType="company" id={id} userId={user!.id} />
            )}
          </div>
        </div>
      </div>

      <div className="box mb-5">
        {company.description && (
          <p className="mb-4">{company.description}</p>
        )}
        <div className="columns is-multiline is-size-7">
          <div className="column is-half">
            <span className="has-text-grey">Type: </span>
            <span>{tagName(company.type_id, tags.types) ?? '—'}</span>
          </div>
          <div className="column is-half">
            <span className="has-text-grey">Stage: </span>
            <span>{tagName(company.stage_id, tags.stages) ?? '—'}</span>
          </div>
          <div className="column is-half">
            <span className="has-text-grey">Status: </span>
            <span>{tagName(company.status_id, tags.statuses) ?? '—'}</span>
          </div>
          <div className="column is-half">
            <span className="has-text-grey">Source: </span>
            <span>{company.source ?? '—'}</span>
          </div>
          <div className="column is-half">
            <span className="has-text-grey">Created: </span>
            <span>{formatDate(company.created_at)}</span>
          </div>
        </div>
        {((company.industry_ids ?? []) as string[]).length > 0 && (
          <div className="tags mt-2">
            {(company.industry_ids as string[]).map((tagId: string) => (
              <Badge key={tagId} variant="blue">
                {tags.industries.find((t) => t.id === tagId)?.name}
              </Badge>
            ))}
          </div>
        )}
        {((company.region_ids ?? []) as string[]).length > 0 && (
          <div className="tags">
            {(company.region_ids as string[]).map((tagId: string) => (
              <Badge key={tagId} variant="green">
                {tags.regions.find((t) => t.id === tagId)?.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="columns">
        <div className="column">
          <div className="level mb-3">
            <div className="level-left">
              <p className="is-size-6 has-text-weight-semibold">Contacts ({contacts?.length ?? 0})</p>
            </div>
            <div className="level-right">
              <Link href={`/contacts/new?company=${id}`} className="button is-light is-small">
                + Add Contact
              </Link>
            </div>
          </div>
          <div className="box p-0" style={{ overflow: 'hidden' }}>
            {(contacts ?? []).length === 0 && (
              <p className="has-text-grey is-size-7 px-4 py-3">No contacts linked.</p>
            )}
            {(contacts ?? []).map((c) => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.6rem 1rem', borderBottom: '1px solid #f5f5f5', textDecoration: 'none' }}
              >
                <div>
                  <p className="is-size-7 has-text-weight-medium">{c.name}</p>
                  <p className="is-size-7 has-text-grey">{c.role ?? c.email ?? ''}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="column">
          <div className="level mb-3">
            <div className="level-left">
              <p className="is-size-6 has-text-weight-semibold">Meetings ({meetings.length})</p>
            </div>
            <div className="level-right">
              <Link href={`/meetings/new?company=${id}`} className="button is-light is-small">
                + Log Meeting
              </Link>
            </div>
          </div>
          <div className="box p-0" style={{ overflow: 'hidden' }}>
            {meetings.length === 0 && (
              <p className="has-text-grey is-size-7 px-4 py-3">No meetings yet.</p>
            )}
            {meetings.map((m) => (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="level is-mobile"
                style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #f5f5f5', textDecoration: 'none', margin: 0 }}
              >
                <div className="level-left">
                  <p className="is-size-7 has-text-weight-medium">{m.title}</p>
                </div>
                <div className="level-right">
                  <p className="is-size-7 has-text-grey">{formatDate(m.date)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
