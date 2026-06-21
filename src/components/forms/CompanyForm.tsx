'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Alert from '@/components/ui/Alert'
import TagPicker from '@/components/TagPicker'
import { createCompany, updateCompany, checkCompanyDuplicate } from '@/lib/actions/companies'
import { createTag } from '@/lib/actions/tags'
import type { Company, TagCatalogs } from '@/types'

interface CompanyFormProps {
  company?: Company
  tags: TagCatalogs
  userId: string
  onSuccess?: (created?: { id: string; name: string }) => void
}

export default function CompanyForm({ company, tags, userId, onSuccess }: CompanyFormProps) {
  const router = useRouter()
  const [name, setName] = useState(company?.name ?? '')
  const [description, setDescription] = useState(company?.description ?? '')
  const [source, setSource] = useState<'' | 'Direct' | 'Fund'>(company?.source ?? '')
  const [industryIds, setIndustryIds] = useState<string[]>(company?.industry_ids ?? [])
  const [regionIds, setRegionIds] = useState<string[]>(company?.region_ids ?? [])
  const [stageIds, setStageIds] = useState<string[]>(company?.stage_ids ?? [])
  const [typeId, setTypeId] = useState<string[]>(company?.type_id ? [company.type_id] : [])
  const [statusId, setStatusId] = useState<string[]>(company?.status_id ? [company.status_id] : [])
  const [tagState, setTagState] = useState(tags)
  const [duplicates, setDuplicates] = useState<{ id: string; name: string }[]>([])
  const [dupDismissed, setDupDismissed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
        source: source || null,
        industry_ids: industryIds,
        region_ids: regionIds,
        stage_ids: stageIds,
        type_id: typeId[0] ?? null,
        status_id: statusId[0] ?? null,
        updated_by: userId,
        deleted_at: null as string | null,
      }

      if (company) {
        await updateCompany(company.id, payload)
        if (onSuccess) onSuccess()
        else router.push(`/companies/${company.id}`)
      } else {
        const created = await createCompany({ ...payload, created_by: userId, deleted_at: null })
        if (onSuccess) onSuccess({ id: created.id, name: created.name })
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

  return (
    <form onSubmit={handleSubmit}>
      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {duplicates.length > 0 && !dupDismissed && (
        <Alert type="warning" title="Possible duplicate" className="mb-4">
          Similar company already exists: {duplicates.map((d) => d.name).join(', ')}.{' '}
          <button type="button" className="button is-ghost is-small" onClick={() => setDupDismissed(true)}>
            Continue anyway
          </button>
        </Alert>
      )}

      <div className="field">
        <label className="label">Company name *</label>
        <div className="control">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>

      <div className="field">
        <label className="label">Description</label>
        <div className="control">
          <textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

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

      <div className="relative">
        <TagPicker label="Industries" catalog={tagState.industries} selected={industryIds} onChange={setIndustryIds} onCreateTag={makeTagCreator('industries')} />
      </div>
      <div className="relative">
        <TagPicker label="Regions" catalog={tagState.regions} selected={regionIds} onChange={setRegionIds} onCreateTag={makeTagCreator('regions')} />
      </div>
      <div className="relative">
        <TagPicker label="Type" catalog={tagState.types} selected={typeId} onChange={setTypeId} onCreateTag={makeTagCreator('types')} multi={false} />
      </div>
      <div className="relative">
        <TagPicker label="Stage" catalog={tagState.stages} selected={stageIds} onChange={setStageIds} onCreateTag={makeTagCreator('stages')} />
      </div>
      <div className="relative">
        <TagPicker label="Status" catalog={tagState.statuses} selected={statusId} onChange={setStatusId} onCreateTag={makeTagCreator('statuses')} multi={false} />
      </div>

      <div className="field mt-5">
        <div className="buttons">
          <button type="submit" className="button is-primary" disabled={saving || (duplicates.length > 0 && !dupDismissed)}>
            {saving ? 'Saving…' : company ? 'Update Company' : 'Create Company'}
          </button>
          <button type="button" className="button is-light" onClick={() => onSuccess ? onSuccess() : router.back()}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
