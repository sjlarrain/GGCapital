import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createClient } from '@/lib/supabase/server'
import { getCompany } from '@/lib/actions/companies'
import { getTagCatalogs } from '@/lib/actions/tags'
import { getCompanyMeetings } from '@/lib/actions/meetings'
import { getInteractionLogs } from '@/lib/actions/interactions'
import { formatDate } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import SoftDeleteButton from '@/components/SoftDeleteButton'
import ActivityTimeline from '@/components/ActivityTimeline'

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [company, tags, meetings, logs] = await Promise.all([
    getCompany(id).catch(() => null),
    getTagCatalogs(),
    getCompanyMeetings(id),
    getInteractionLogs('company', id),
  ])

  if (!company) notFound()

  const entries = [
    ...meetings.map((m) => ({
      type: 'meeting' as const,
      date: m.date,
      meetingId: m.id,
      meetingTitle: m.title,
    })),
    ...logs.map((l) => ({
      type: 'log' as const,
      date: l.created_at,
      log: l,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const fundTypeIds = new Set(tags.types.filter((t) => ['VC', 'Fund'].includes(t.name)).map((t) => t.id))
  const companyTypeId = tags.types.find((t) => t.name === 'Company')?.id
  const returnView = company.type_id && fundTypeIds.has(company.type_id) ? 'funds'
    : company.type_id === companyTypeId ? 'companies'
    : 'investors'
  const backHref = `/companies?view=${returnView}`
  const backLabel = returnView === 'funds' ? '← Funds'
    : returnView === 'companies' ? '← Companies'
    : '← Investors & Network'
  const isFund = returnView === 'funds'

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, role, email, investment_focus, stage_ids')
    .eq('company_id', id)
    .is('deleted_at', null)
    .order('name')

  // Manager → fund hierarchy
  const [{ data: parent }, { data: funds }] = await Promise.all([
    company.parent_company_id
      ? supabase.from('companies').select('id, name').eq('id', company.parent_company_id).single()
      : Promise.resolve({ data: null }),
    supabase.from('companies').select('id, name').eq('parent_company_id', id).is('deleted_at', null).order('name'),
  ])

  const tagName = (tagId: string | null, catalog: { id: string; name: string }[]) =>
    catalog.find((t) => t.id === tagId)?.name
  const stageNames = (ids: string[] | null) =>
    (ids ?? []).map((sid) => tags.stages.find((t) => t.id === sid)?.name).filter(Boolean)

  // "Investment thesis" = the focus its contacts invest in, unioned across them.
  const investmentThesis = Array.from(
    new Set((contacts ?? []).flatMap((c) => (c.investment_focus ?? []) as string[]))
  ).filter(Boolean)
  const companyStages = stageNames((company.stage_ids ?? []) as string[])
  const fmtMusd = (n: number | null) => (n == null ? null : `US$ ${n}M`)

  return (
    <div className="gg-detail">
      <div className="level mb-4">
        <div className="level-left">
          <div>
            <Link href={backHref} className="is-size-7 has-text-grey">{backLabel}</Link>
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
          <div className="content mb-4" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{company.description}</ReactMarkdown>
          </div>
        )}
        <div className="columns is-multiline is-size-7">
          {!isFund && (
            <div className="column is-half">
              <span className="has-text-grey">Type: </span>
              <span>{tagName(company.type_id, tags.types) ?? '—'}</span>
            </div>
          )}
          {isFund && (company as { country?: string | null }).country && (
            <div className="column is-half">
              <span className="has-text-grey">Country: </span>
              <span>{(company as { country?: string | null }).country}</span>
            </div>
          )}
          {companyStages.length > 0 && (
            <div className="column is-half">
              <p className="has-text-grey mb-1">{isFund ? 'Investment Stage' : 'Stage'}</p>
              <div className="tags">
                {companyStages.map((n) => <Badge key={n} variant="yellow">{n}</Badge>)}
              </div>
            </div>
          )}
          {!isFund && investmentThesis.length > 0 && (
            <div className="column is-half">
              <p className="has-text-grey mb-1">Investment focus</p>
              <div className="tags">
                {investmentThesis.map((n) => <Badge key={n} variant="blue">{n}</Badge>)}
              </div>
            </div>
          )}
          {company.website && (
            <div className="column is-half">
              <span className="has-text-grey">Website: </span>
              <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer">{company.website}</a>
            </div>
          )}
          {fmtMusd(company.round_size_musd) && (
            <div className="column is-half">
              <span className="has-text-grey">Round / fund size: </span>
              <span>{fmtMusd(company.round_size_musd)}</span>
            </div>
          )}
          {fmtMusd(company.valuation_musd) && (
            <div className="column is-half">
              <span className="has-text-grey">Valuation: </span>
              <span>{fmtMusd(company.valuation_musd)}</span>
            </div>
          )}
          {company.legal && (
            <div className="column is-half">
              <span className="has-text-grey">Legal: </span>
              <span>{company.legal}</span>
            </div>
          )}
          {company.deal_date && (
            <div className="column is-half">
              <span className="has-text-grey">Deal date: </span>
              <span>{formatDate(company.deal_date)}</span>
            </div>
          )}
          {parent && (
            <div className="column is-half">
              <span className="has-text-grey">Managed by: </span>
              <Link href={`/companies/${parent.id}`}>{parent.name}</Link>
            </div>
          )}
          <div className="column is-half">
            <span className="has-text-grey">Status: </span>
            <span>{tagName(company.status_id, tags.statuses) ?? '—'}</span>
          </div>
          {!isFund && (
            <div className="column is-half">
              <span className="has-text-grey">Source: </span>
              <span>{company.source ?? '—'}</span>
            </div>
          )}
          <div className="column is-half">
            <span className="has-text-grey">Created: </span>
            <span>{formatDate(company.created_at)}</span>
          </div>
        </div>
        {((company.industry_ids ?? []) as string[]).length > 0 && (
          <div className="mt-2">
            <p className="has-text-grey is-size-7 mb-1">{isFund ? 'Thesis' : 'Industries'}</p>
            <div className="tags">
              {(company.industry_ids as string[]).map((tagId: string) => (
                <Badge key={tagId} variant="blue">
                  {tags.industries.find((t) => t.id === tagId)?.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {((company.region_ids ?? []) as string[]).length > 0 && (
          <div className="mt-2">
            <p className="has-text-grey is-size-7 mb-1">{isFund ? 'Investment Geography' : 'Regions'}</p>
            <div className="tags">
              {(company.region_ids as string[]).map((tagId: string) => (
                <Badge key={tagId} variant="green">
                  {tags.regions.find((t) => t.id === tagId)?.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {((company.files ?? []) as string[]).length > 0 && (
          <div className="mt-3 is-size-7">
            <span className="has-text-grey">Files: </span>
            {(company.files as string[]).map((f, i) => (
              <span key={i}>
                {i > 0 && ', '}
                <a href={f} target="_blank" rel="noreferrer">{f.split('/').pop() || f}</a>
              </span>
            ))}
          </div>
        )}
        {(funds ?? []).length > 0 && (
          <div className="mt-3 is-size-7">
            <span className="has-text-grey">Funds: </span>
            {(funds ?? []).map((f, i) => (
              <span key={f.id}>
                {i > 0 && ', '}
                <Link href={`/companies/${f.id}`}>{f.name}</Link>
              </span>
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

      <div className="mt-5">
        <p className="is-size-6 has-text-weight-semibold mb-3">Activity timeline</p>
        <ActivityTimeline entityType="company" entityId={id} userId={user!.id} entries={entries} />
      </div>
    </div>
  )
}
