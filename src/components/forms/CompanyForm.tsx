'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import TagPicker from '@/components/TagPicker'
import { createCompany, updateCompany, checkCompanyDuplicate } from '@/lib/actions/companies'
import { createTag } from '@/lib/actions/tags'
import type { Company, TagCatalogs } from '@/types'

interface CompanyFormProps {
  company?: Company
  tags: TagCatalogs
  userId: string
}

export default function CompanyForm({ company, tags, userId }: CompanyFormProps) {
  const router = useRouter()
  const [name, setName] = useState(company?.name ?? '')
  const [description, setDescription] = useState(company?.description ?? '')
  const [industryIds, setIndustryIds] = useState<string[]>(company?.industry_ids ?? [])
  const [regionIds, setRegionIds] = useState<string[]>(company?.region_ids ?? [])
  const [stageId, setStageId] = useState<string[]>(company?.stage_id ? [company.stage_id] : [])
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
        industry_ids: industryIds,
        region_ids: regionIds,
        stage_id: stageId[0] ?? null,
        type_id: typeId[0] ?? null,
        status_id: statusId[0] ?? null,
        updated_by: userId,
        deleted_at: null as string | null,
      }

      if (company) {
        await updateCompany(company.id, payload)
        router.push(`/companies/${company.id}`)
      } else {
        const created = await createCompany({ ...payload, created_by: userId, deleted_at: null })
        router.push(`/companies/${created.id}`)
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
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      {error && <Alert type="error">{error}</Alert>}

      {duplicates.length > 0 && !dupDismissed && (
        <Alert type="warning" title="Possible duplicate">
          Similar company already exists: {duplicates.map((d) => d.name).join(', ')}.
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-2 underline"
            onClick={() => setDupDismissed(true)}
          >
            Continue anyway
          </Button>
        </Alert>
      )}

      <Input
        id="name"
        label="Company name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Textarea
        id="description"
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />

      <div className="relative">
        <TagPicker
          label="Industries"
          catalog={tagState.industries}
          selected={industryIds}
          onChange={setIndustryIds}
          onCreateTag={makeTagCreator('industries')}
        />
      </div>
      <div className="relative">
        <TagPicker
          label="Regions"
          catalog={tagState.regions}
          selected={regionIds}
          onChange={setRegionIds}
          onCreateTag={makeTagCreator('regions')}
        />
      </div>
      <div className="relative">
        <TagPicker
          label="Type"
          catalog={tagState.types}
          selected={typeId}
          onChange={setTypeId}
          onCreateTag={makeTagCreator('types')}
          multi={false}
        />
      </div>
      <div className="relative">
        <TagPicker
          label="Stage"
          catalog={tagState.stages}
          selected={stageId}
          onChange={setStageId}
          onCreateTag={makeTagCreator('stages')}
          multi={false}
        />
      </div>
      <div className="relative">
        <TagPicker
          label="Status"
          catalog={tagState.statuses}
          selected={statusId}
          onChange={setStatusId}
          onCreateTag={makeTagCreator('statuses')}
          multi={false}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving || (duplicates.length > 0 && !dupDismissed)}>
          {saving ? 'Saving…' : company ? 'Update Company' : 'Create Company'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
