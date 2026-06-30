'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Alert from '@/components/ui/Alert'
import TagPicker from '@/components/TagPicker'
import MarkdownEditor from '@/components/MarkdownEditor'
import { createCompany, updateCompany, checkCompanyDuplicate } from '@/lib/actions/companies'
import { createTag } from '@/lib/actions/tags'
import { createClient } from '@/lib/supabase/client'
import type { Company, TagCatalogs } from '@/types'

interface CompanyFormProps {
  company?: Company
  tags: TagCatalogs
  userId: string
  mode?: 'company' | 'fund' | 'investor'
  onSuccess?: (created?: { id: string; name: string; industry_ids: string[]; region_ids: string[]; stage_ids: string[] }) => void
}

const FUND_STAGE_NAMES = ['Pre-Seed & Seed', 'Early Stage', 'Late Stage']

export default function CompanyForm({ company, tags, userId, mode = 'company', onSuccess }: CompanyFormProps) {
  const isFund = mode === 'fund'
  const router = useRouter()
  const [name, setName] = useState(company?.name ?? '')
  const [description, setDescription] = useState(company?.description ?? '')
  const [website, setWebsite] = useState(company?.website ?? '')
  const [country, setCountry] = useState(company?.country ?? '')
  const [roundSize, setRoundSize] = useState(company?.round_size_musd?.toString() ?? '')
  const [valuation, setValuation] = useState(company?.valuation_musd?.toString() ?? '')
  const [legal, setLegal] = useState(company?.legal ?? '')
  const [dealDate, setDealDate] = useState(company?.deal_date ?? '')
  const [source, setSource] = useState<'' | 'Direct' | 'Fund'>(company?.source ?? '')
  const [industryIds, setIndustryIds] = useState<string[]>(company?.industry_ids ?? [])
  const [regionIds, setRegionIds] = useState<string[]>(company?.region_ids ?? [])
  const [stageIds, setStageIds] = useState<string[]>(company?.stage_ids ?? [])
  const [typeId, setTypeId] = useState<string[]>(() => {
    if (company?.type_id) return [company.type_id]
    if (isFund) {
      const fundType = tags.types.find((t) => ['VC', 'Fund'].includes(t.name))
      return fundType ? [fundType.id] : []
    }
    return []
  })
  const [statusId, setStatusId] = useState<string[]>(company?.status_id ? [company.status_id] : [])
  const [files, setFiles] = useState<string[]>((company?.files as string[]) ?? [])
  const [fileUrl, setFileUrl] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [tagState, setTagState] = useState(tags)
  const [duplicates, setDuplicates] = useState<{ id: string; name: string }[]>([])
  const [dupDismissed, setDupDismissed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const visibleStages = isFund
    ? tagState.stages.filter((s) => FUND_STAGE_NAMES.includes(s.name) || stageIds.includes(s.id))
    : tagState.stages
  const FUND_STATUS_NAMES = ['Approved', 'Rejected', 'Miss', 'Stand-by']
  const visibleStatuses = isFund
    ? tagState.statuses.filter((s) => FUND_STATUS_NAMES.includes(s.name) || statusId.includes(s.id))
    : tagState.statuses

  useEffect(() => {
    const check = async () => {
      if (name.trim().length < 2) { setDuplicates([]); return }
      const dups = await checkCompanyDuplicate(name.trim(), company?.id)
      setDuplicates(dups)
      if (dups.length > 0) setDupDismissed(false)
    }
    const timer = setTimeout(check, 400)
    return () => clearTimeout(timer)
  }, [name, company?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (duplicates.length > 0 && !dupDismissed) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        website: website.trim() || null,
        country: country.trim() || null,
        round_size_musd: roundSize ? parseFloat(roundSize) : null,
        valuation_musd: !isFund && valuation ? parseFloat(valuation) : null,
        legal: !isFund ? (legal.trim() || null) : null,
        deal_date: !isFund ? (dealDate || null) : null,
        source: !isFund ? (source || null) : null,
        industry_ids: industryIds,
        region_ids: regionIds,
        stage_ids: stageIds,
        type_id: typeId[0] ?? null,
        status_id: statusId[0] ?? null,
        files: files,
        updated_by: userId,
        deleted_at: null as string | null,
      }

      if (company) {
        await updateCompany(company.id, payload)
        if (onSuccess) onSuccess()
        else router.push(`/companies/${company.id}`)
      } else {
        const created = await createCompany({ ...payload, created_by: userId, deleted_at: null })
        if (onSuccess) onSuccess({ id: created.id, name: created.name, industry_ids: industryIds, region_ids: regionIds, stage_ids: stageIds })
        else router.push(`/companies/${created.id}`)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const makeTagCreator = (catalog: keyof TagCatalogs) => async (tagName: string) => {
    const newTag = await createTag(catalog as Parameters<typeof createTag>[0], tagName)
    setTagState((prev) => ({ ...prev, [catalog]: [...prev[catalog], newTag] }))
    return newTag
  }

  const addFileUrl = () => {
    const url = fileUrl.trim()
    if (!url) return
    setFiles((prev) => [...prev, url])
    setFileUrl('')
  }

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    setError('')
    try {
      const supabase = createClient()
      const path = `${userId}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('company-files').upload(path, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('company-files').getPublicUrl(path)
      setFiles((prev) => [...prev, publicUrl])
    } catch (err) {
      setError(String(err))
    } finally {
      setUploadingFile(false)
      e.target.value = ''
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {duplicates.length > 0 && !dupDismissed && (
        <Alert type="warning" title="Possible duplicate" className="mb-4">
          Similar record already exists:{' '}
          {duplicates.map((d, i) => (
            <span key={d.id}>
              {i > 0 && ', '}
              <a href={`/companies/${d.id}`} target="_blank" rel="noreferrer">{d.name}</a>
            </span>
          ))}.{' '}
          <button type="button" className="button is-ghost is-small" onClick={() => setDupDismissed(true)}>
            Continue anyway
          </button>
        </Alert>
      )}

      <div className="field">
        <label className="label">{isFund ? 'Fund Name *' : 'Company name *'}</label>
        <div className="control">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>

      {isFund && (
        <div className="field">
          <label className="label">Country of Origin</label>
          <div className="control">
            <input className="input" placeholder="e.g. Chile, USA, Canada" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>
      )}

      <div className="field">
        <label className="label">Description</label>
        <MarkdownEditor value={description} onChange={setDescription} rows={3} placeholder={isFund ? 'Describe the fund…' : 'Describe the company…'} />
      </div>

      <div className="columns">
        <div className="column">
          <div className="field">
            <label className="label">Website</label>
            <div className="control">
              <input className="input" type="url" placeholder="https://…" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
          </div>
        </div>
        {!isFund && (
          <div className="column">
            <div className="field">
              <label className="label">Deal Date</label>
              <div className="control">
                <input className="input" type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {isFund ? (
        <div className="field">
          <label className="label">Fund Size (US$M)</label>
          <div className="control">
            <input className="input" type="number" step="0.1" min="0" placeholder="0.0" value={roundSize} onChange={(e) => setRoundSize(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="columns">
          <div className="column">
            <div className="field">
              <label className="label">Round / Fund Size (US$M)</label>
              <div className="control">
                <input className="input" type="number" step="0.1" min="0" placeholder="0.0" value={roundSize} onChange={(e) => setRoundSize(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="column">
            <div className="field">
              <label className="label">Valuation (US$M)</label>
              <div className="control">
                <input className="input" type="number" step="0.1" min="0" placeholder="0.0" value={valuation} onChange={(e) => setValuation(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {!isFund && (
        <div className="field">
          <label className="label">Legal entity name</label>
          <div className="control">
            <input className="input" value={legal} onChange={(e) => setLegal(e.target.value)} />
          </div>
        </div>
      )}

      {!isFund && (
        <div className="field">
          <label className="label">Source</label>
          <div className="control">
            <div className="select is-fullwidth">
              <select value={source} onChange={(e) => setSource(e.target.value as '' | 'Direct' | 'Fund')}>
                <option value="">—</option>
                <option value="Direct">Direct</option>
                <option value="Fund">Fund</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <TagPicker label={isFund ? 'Thesis' : 'Industries'} catalog={tagState.industries} selected={industryIds} onChange={setIndustryIds} onCreateTag={makeTagCreator('industries')} />
      </div>
      <div className="relative">
        <TagPicker label={isFund ? 'Investment Geography' : 'Regions'} catalog={tagState.regions} selected={regionIds} onChange={setRegionIds} onCreateTag={makeTagCreator('regions')} />
      </div>
      {!isFund && (
        <div className="relative">
          <TagPicker label="Type" catalog={tagState.types} selected={typeId} onChange={setTypeId} onCreateTag={makeTagCreator('types')} multi={false} />
        </div>
      )}
      <div className="relative">
        <TagPicker label={isFund ? 'Investment Stage' : 'Stage'} catalog={visibleStages} selected={stageIds} onChange={setStageIds} onCreateTag={makeTagCreator('stages')} />
      </div>
      <div className="relative">
        <TagPicker label="Status" catalog={visibleStatuses} selected={statusId} onChange={setStatusId} onCreateTag={makeTagCreator('statuses')} multi={false} />
      </div>

      {/* Files / Links */}
      <div className="field">
        <label className="label">Files / Links</label>
        {files.length > 0 && (
          <div className="mb-2">
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <a href={f} target="_blank" rel="noreferrer" className="is-size-7 has-text-link" style={{ flex: 1, wordBreak: 'break-all' }}>
                  {f.split('/').pop() || f}
                </a>
                <button
                  type="button"
                  className="delete is-small"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input is-small"
            type="url"
            placeholder="Paste a link (DocSend, Google Drive, etc.)"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFileUrl() } }}
            style={{ flex: 1 }}
          />
          <button type="button" className="button is-light is-small" onClick={addFileUrl}>
            Add URL
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          <label className="button is-light is-small" style={{ cursor: 'pointer' }}>
            {uploadingFile ? 'Uploading…' : '↑ Upload PDF'}
            <input
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={handlePdfUpload}
              disabled={uploadingFile}
            />
          </label>
        </div>
      </div>

      <div className="field mt-5">
        <div className="buttons">
          <button type="submit" className="button is-primary" disabled={saving || (duplicates.length > 0 && !dupDismissed)}>
            {saving ? 'Saving…' : company
            ? (isFund ? 'Update Fund' : 'Update Company')
            : (isFund ? 'Create Fund' : 'Create Company')
          }
          </button>
          <button type="button" className="button is-light" onClick={() => onSuccess ? onSuccess() : router.back()}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
