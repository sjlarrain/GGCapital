'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import TagPicker from '@/components/TagPicker'
import { createContact, updateContact, checkContactDuplicate } from '@/lib/actions/contacts'
import { createCompany } from '@/lib/actions/companies'
import { createTag } from '@/lib/actions/tags'
import type { Contact, TagCatalogs } from '@/types'

interface ContactFormProps {
  contact?: Contact
  tags: TagCatalogs
  companies: { id: string; name: string }[]
  userId: string
  defaultCompanyId?: string
}

export default function ContactForm({ contact, tags, companies, userId, defaultCompanyId }: ContactFormProps) {
  const router = useRouter()
  const [name, setName] = useState(contact?.name ?? '')
  const [role, setRole] = useState(contact?.role ?? '')
  const [employer, setEmployer] = useState(contact?.employer ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [expertise, setExpertise] = useState(contact?.expertise ?? '')
  const [companyId, setCompanyId] = useState(contact?.company_id ?? defaultCompanyId ?? '')
  const [investmentFocus, setInvestmentFocus] = useState<string[]>(contact?.investment_focus ?? [])
  const [industryIds, setIndustryIds] = useState<string[]>(contact?.industry_ids ?? [])
  const [regionIds, setRegionIds] = useState<string[]>(contact?.region_ids ?? [])
  const [tagState, setTagState] = useState(tags)
  const [companyList, setCompanyList] = useState(companies)
  const [duplicates, setDuplicates] = useState<{ id: string; name: string }[]>([])
  const [dupDismissed, setDupDismissed] = useState(false)
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

  const handleQuickCreateCompany = async () => {
    if (!newCompanyName.trim()) return
    const c = await createCompany({
      name: newCompanyName.trim(),
      description: null,
      source: null,
      industry_ids: [],
      region_ids: [],
      stage_id: null,
      type_id: null,
      status_id: null,
      created_by: userId,
      updated_by: userId,
      deleted_at: null,
    })
    setCompanyList((prev) => [...prev, { id: c.id, name: c.name }])
    setCompanyId(c.id)
    setNewCompanyName('')
    setCreatingCompany(false)
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
        company_id: companyId || null,
        industry_ids: industryIds,
        region_ids: regionIds,
        investment_focus: investmentFocus,
        updated_by: userId,
      }

      if (contact) {
        await updateContact(contact.id, payload)
        router.push(`/contacts/${contact.id}`)
      } else {
        const created = await createContact({ ...payload, created_by: userId, deleted_at: null })
        router.push(`/contacts/${created.id}`)
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
          Similar contact: {duplicates.map((d) => d.name).join(', ')}.
          <Button type="button" variant="ghost" size="sm" className="ml-2 underline" onClick={() => setDupDismissed(true)}>
            Continue anyway
          </Button>
        </Alert>
      )}

      <Input id="name" label="Name *" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input id="role" label="Role / Title" value={role} onChange={(e) => setRole(e.target.value)} />
      <Input id="employer" label="Employer" value={employer} onChange={(e) => setEmployer(e.target.value)} />
      <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input id="phone" label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Input id="expertise" label="Expertise" value={expertise} onChange={(e) => setExpertise(e.target.value)} />

      {/* Company link */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company (optional)</label>
        <div className="flex gap-2">
          <select
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">No company</option>
            {companyList.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Button type="button" variant="secondary" size="sm" onClick={() => setCreatingCompany(true)}>
            + New
          </Button>
        </div>
        {creatingCompany && (
          <div className="flex gap-2 mt-2">
            <Input
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="New company name"
            />
            <Button type="button" size="sm" onClick={handleQuickCreateCompany}>Create</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingCompany(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {/* Investment Focus — fixed list, multi-select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Investment Focus</label>
        <div className="flex flex-wrap gap-3">
          {['Accelerator', 'Builder', 'Funds', 'PE', 'Startups'].map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="rounded"
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

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving || (duplicates.length > 0 && !dupDismissed)}>
          {saving ? 'Saving…' : contact ? 'Update Contact' : 'Create Contact'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  )
}
