'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Alert from '@/components/ui/Alert'
import TagPicker from '@/components/TagPicker'
import Modal from '@/components/ui/Modal'
import Autocomplete from '@/components/Autocomplete'
import { createContact, updateContact, checkContactDuplicate } from '@/lib/actions/contacts'
import { createTag } from '@/lib/actions/tags'
import type { Contact, TagCatalogs } from '@/types'

type CompanyOption = {
  id: string
  name: string
  industry_ids: string[]
  region_ids: string[]
  stage_ids: string[]
}

// Lazy import to avoid circular reference at module level
type CompanyFormComponentType = React.ComponentType<{
  tags: TagCatalogs
  userId: string
  onSuccess?: (newCompany?: { id: string; name: string; industry_ids: string[]; region_ids: string[]; stage_ids: string[] }) => void
}>

interface ContactFormProps {
  contact?: Contact
  tags: TagCatalogs
  companies: CompanyOption[]
  userId: string
  defaultCompanyId?: string
  onSuccess?: () => void
}

export default function ContactForm({ contact, tags, companies, userId, defaultCompanyId, onSuccess }: ContactFormProps) {
  const router = useRouter()
  const [name, setName] = useState(contact?.name ?? '')
  const [role, setRole] = useState(contact?.role ?? '')
  const [employer, setEmployer] = useState(contact?.employer ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [expertise, setExpertise] = useState(contact?.expertise ?? '')
  const [linkedin, setLinkedin] = useState(contact?.linkedin ?? '')
  const [location, setLocation] = useState(contact?.location ?? '')
  const [companyId, setCompanyId] = useState(contact?.company_id ?? defaultCompanyId ?? '')
  const [investmentFocus, setInvestmentFocus] = useState<string[]>(contact?.investment_focus ?? [])
  // For a new contact pre-filled with a company, seed tags from that company.
  const seedCompany = !contact && defaultCompanyId ? companies.find((c) => c.id === defaultCompanyId) : undefined
  const [industryIds, setIndustryIds] = useState<string[]>(contact?.industry_ids ?? seedCompany?.industry_ids ?? [])
  const [regionIds, setRegionIds] = useState<string[]>(contact?.region_ids ?? seedCompany?.region_ids ?? [])
  const [stageIds, setStageIds] = useState<string[]>(contact?.stage_ids ?? seedCompany?.stage_ids ?? [])
  const [tagState, setTagState] = useState(tags)
  const [companyList, setCompanyList] = useState<CompanyOption[]>(companies)
  const [duplicates, setDuplicates] = useState<{ id: string; name: string }[]>([])
  const [dupDismissed, setDupDismissed] = useState(false)
  const [newCompanyOpen, setNewCompanyOpen] = useState(false)
  const [CompanyForm, setCompanyForm] = useState<CompanyFormComponentType | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Duplicate check
  useEffect(() => {
    const check = async () => {
      if (name.trim().length < 2) { setDuplicates([]); return }
      const dups = await checkContactDuplicate(name.trim(), contact?.id)
      setDuplicates(dups)
      if (dups.length > 0) setDupDismissed(false)
    }
    const timer = setTimeout(check, 400)
    return () => clearTimeout(timer)
  }, [name, contact?.id])

  // Inherit industry/region/stage from a company (only into empty fields, and
  // never when editing an existing contact). Runs from the change handler rather
  // than an effect so it only fires on an actual user selection.
  const applyCompanyInheritance = (co: CompanyOption | undefined) => {
    if (contact || !co) return
    if (industryIds.length === 0 && co.industry_ids.length > 0) setIndustryIds(co.industry_ids)
    if (regionIds.length === 0 && co.region_ids.length > 0) setRegionIds(co.region_ids)
    if (stageIds.length === 0 && co.stage_ids.length > 0) setStageIds(co.stage_ids)
  }

  const handleCompanyChange = (id: string) => {
    setCompanyId(id)
    if (id) applyCompanyInheritance(companyList.find((c) => c.id === id))
  }

  const openNewCompany = async () => {
    if (!CompanyForm) {
      const mod = await import('./CompanyForm')
      setCompanyForm(() => mod.default)
    }
    setNewCompanyOpen(true)
  }

  const handleCompanyCreated = (newCompany?: { id: string; name: string; industry_ids: string[]; region_ids: string[]; stage_ids: string[] }) => {
    if (newCompany) {
      setCompanyList((prev) => [...prev, newCompany])
      setCompanyId(newCompany.id)
      applyCompanyInheritance(newCompany)
    }
    setNewCompanyOpen(false)
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (duplicates.length > 0 && !dupDismissed) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        role: role.trim() || null,
        employer: employer.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        expertise: expertise.trim() || null,
        linkedin: linkedin.trim() || null,
        location: location.trim() || null,
        company_id: companyId || null,
        industry_ids: industryIds,
        region_ids: regionIds,
        stage_ids: stageIds,
        investment_focus: investmentFocus,
        updated_by: userId,
      }
      if (contact) {
        await updateContact(contact.id, payload)
        if (onSuccess) onSuccess()
        else router.push(`/contacts/${contact.id}`)
      } else {
        const created = await createContact({ ...payload, created_by: userId, deleted_at: null })
        if (onSuccess) onSuccess()
        else router.push(`/contacts/${created.id}`)
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

  const companyOptions = companyList.map((c) => ({ id: c.id, label: c.name }))

  return (
    <>
      <form onSubmit={handleSubmit}>
        {error && <Alert type="error" className="mb-4">{error}</Alert>}

        {duplicates.length > 0 && !dupDismissed && (
          <Alert type="warning" title="Possible duplicate" className="mb-4">
            Similar contact: {duplicates.map((d) => d.name).join(', ')}.{' '}
            <button type="button" className="button is-ghost is-small" onClick={() => setDupDismissed(true)}>
              Continue anyway
            </button>
          </Alert>
        )}

        <div className="field">
          <label className="label">Name *</label>
          <div className="control">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        </div>

        <div className="columns">
          <div className="column">
            <div className="field">
              <label className="label">Role / Title</label>
              <div className="control">
                <input className="input" value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="column">
            <div className="field">
              <label className="label">Employer</label>
              <div className="control">
                <input className="input" value={employer} onChange={(e) => setEmployer(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="columns">
          <div className="column">
            <div className="field">
              <label className="label">Email</label>
              <div className="control">
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="column">
            <div className="field">
              <label className="label">Phone</label>
              <div className="control">
                <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="columns">
          <div className="column">
            <div className="field">
              <label className="label">Expertise</label>
              <div className="control">
                <input className="input" value={expertise} onChange={(e) => setExpertise(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="column">
            <div className="field">
              <label className="label">Location</label>
              <div className="control">
                <input className="input" placeholder="e.g. Sydney, Australia" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="field">
          <label className="label">LinkedIn</label>
          <div className="control">
            <input className="input" type="url" placeholder="https://linkedin.com/in/…" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label className="label">Company</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Autocomplete
                options={companyOptions}
                value={companyId}
                onChange={handleCompanyChange}
                placeholder="Search companies…"
                clearLabel="No company"
              />
            </div>
            <button type="button" className="button is-light is-small" style={{ alignSelf: 'flex-end', marginBottom: 0 }} onClick={openNewCompany}>
              + New
            </button>
          </div>
        </div>

        <div className="field">
          <label className="label">Investment Focus</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {['Accelerator', 'Builder', 'Funds', 'PE', 'Startups'].map((option) => (
              <label key={option} className="checkbox">
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={investmentFocus.includes(option)}
                  onChange={(e) =>
                    setInvestmentFocus((prev) =>
                      e.target.checked ? [...prev, option] : prev.filter((v) => v !== option)
                    )
                  }
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        <div className="relative">
          <TagPicker label="Industries" catalog={tagState.industries} selected={industryIds} onChange={setIndustryIds} onCreateTag={makeTagCreator('industries')} />
        </div>
        <div className="relative">
          <TagPicker label="Regions" catalog={tagState.regions} selected={regionIds} onChange={setRegionIds} onCreateTag={makeTagCreator('regions')} />
        </div>
        <div className="relative">
          <TagPicker label="Stages" catalog={tagState.stages} selected={stageIds} onChange={setStageIds} onCreateTag={makeTagCreator('stages')} />
        </div>

        <div className="field mt-4">
          <div className="buttons">
            <button type="submit" className="button is-primary" disabled={saving || (duplicates.length > 0 && !dupDismissed)}>
              {saving ? 'Saving…' : contact ? 'Update Contact' : 'Create Contact'}
            </button>
            <button type="button" className="button is-light" onClick={() => onSuccess ? onSuccess() : router.back()}>
              Cancel
            </button>
          </div>
        </div>
      </form>

      <Modal open={newCompanyOpen} onClose={() => setNewCompanyOpen(false)} title="New Company" wide>
        {CompanyForm && (
          <CompanyForm
            tags={tagState}
            userId={userId}
            onSuccess={handleCompanyCreated}
          />
        )}
      </Modal>
    </>
  )
}
