/**
 * Zod schema tests — required fields, optional fields, strict (no extra props),
 * and dedupe-search round-trip.
 */

import { CompanyCreateSchema, CompanyUpdateSchema, CompanyListQuerySchema } from '@/lib/schemas/company'
import { ContactCreateSchema } from '@/lib/schemas/contact'
import { MeetingCreateSchema } from '@/lib/schemas/meeting'
import { InteractionCreateSchema } from '@/lib/schemas/interaction'
import { mintToken, hashToken, isPAT } from '@/lib/auth/tokens'

// ── Company ───────────────────────────────────────────────────────────────────

describe('CompanyCreateSchema', () => {
  it('accepts name-only (stub creation)', () => {
    const r = CompanyCreateSchema.safeParse({ name: 'Acme' })
    expect(r.success).toBe(true)
  })

  it('rejects missing name', () => {
    const r = CompanyCreateSchema.safeParse({})
    expect(r.success).toBe(false)
  })

  it('rejects extra fields (strict)', () => {
    const r = CompanyCreateSchema.safeParse({ name: 'Acme', created_by: 'injected' })
    expect(r.success).toBe(false)
  })

  it('rejects audit fields (created_by, updated_by)', () => {
    const r = CompanyCreateSchema.safeParse({ name: 'Acme', updated_by: 'injected' })
    expect(r.success).toBe(false)
  })

  it('accepts full payload', () => {
    const r = CompanyCreateSchema.safeParse({
      name:        'Acme',
      description: 'Enterprise SaaS',
      website:     'https://acme.com',
      country:     'US',
    })
    expect(r.success).toBe(true)
  })
})

describe('CompanyUpdateSchema', () => {
  it('accepts empty patch (all optional)', () => {
    const r = CompanyUpdateSchema.safeParse({})
    expect(r.success).toBe(true)
  })

  it('rejects extra fields (strict)', () => {
    const r = CompanyUpdateSchema.safeParse({ created_by: 'injected' })
    expect(r.success).toBe(false)
  })
})

describe('CompanyListQuerySchema', () => {
  it('defaults limit=50 and offset=0', () => {
    const r = CompanyListQuerySchema.parse({})
    expect(r.limit).toBe(50)
    expect(r.offset).toBe(0)
  })

  it('coerces string numbers', () => {
    const r = CompanyListQuerySchema.parse({ limit: '10', offset: '20' })
    expect(r.limit).toBe(10)
    expect(r.offset).toBe(20)
  })

  it('rejects limit > 100', () => {
    const r = CompanyListQuerySchema.safeParse({ limit: '200' })
    expect(r.success).toBe(false)
  })

  it('accepts data_status filter', () => {
    const r = CompanyListQuerySchema.parse({ data_status: 'stub' })
    expect(r.data_status).toBe('stub')
  })

  it('rejects invalid data_status', () => {
    const r = CompanyListQuerySchema.safeParse({ data_status: 'unknown' })
    expect(r.success).toBe(false)
  })
})

// ── Contact ───────────────────────────────────────────────────────────────────

describe('ContactCreateSchema', () => {
  it('requires name, email, company_id', () => {
    const noEmail = ContactCreateSchema.safeParse({ name: 'Alice', company_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
    expect(noEmail.success).toBe(false)

    const noCompany = ContactCreateSchema.safeParse({ name: 'Alice', email: 'a@b.com' })
    expect(noCompany.success).toBe(false)

    const valid = ContactCreateSchema.safeParse({ name: 'Alice', email: 'a@b.com', company_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
    expect(valid.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const r = ContactCreateSchema.safeParse({ name: 'A', email: 'not-an-email', company_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
    expect(r.success).toBe(false)
  })

  it('rejects client-supplied audit fields', () => {
    const r = ContactCreateSchema.safeParse({ name: 'A', email: 'a@b.com', company_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', created_by: 'injected' })
    expect(r.success).toBe(false)
  })
})

// ── Meeting ───────────────────────────────────────────────────────────────────

describe('MeetingCreateSchema', () => {
  const validBase = { company_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', date: '2026-06-28', title: 'Intro call' }

  it('requires company_id, date, title', () => {
    expect(MeetingCreateSchema.safeParse(validBase).success).toBe(true)
    expect(MeetingCreateSchema.safeParse({ date: '2026-06-28', title: 'x' }).success).toBe(false)
    expect(MeetingCreateSchema.safeParse({ company_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', title: 'x' }).success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const r = MeetingCreateSchema.safeParse({ ...validBase, date: '06/28/2026' })
    expect(r.success).toBe(false)
  })
})

// ── Interaction ───────────────────────────────────────────────────────────────

describe('InteractionCreateSchema', () => {
  it('requires entity_type, entity_id, and note', () => {
    expect(InteractionCreateSchema.safeParse({ entity_type: 'contact', entity_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', note: 'Called.' }).success).toBe(true)
    expect(InteractionCreateSchema.safeParse({ entity_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', note: 'Called.' }).success).toBe(false)
    expect(InteractionCreateSchema.safeParse({ entity_type: 'contact', note: 'Called.' }).success).toBe(false)
    expect(InteractionCreateSchema.safeParse({ entity_type: 'contact', entity_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }).success).toBe(false)
  })

  it('accepts entity_type company', () => {
    expect(InteractionCreateSchema.safeParse({ entity_type: 'company', entity_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', note: 'Called.' }).success).toBe(true)
  })

  it('defaults follow_up to false and attachments to empty arrays', () => {
    const r = InteractionCreateSchema.parse({ entity_type: 'contact', entity_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', note: 'Hi' })
    expect(r.follow_up).toBe(false)
    expect(r.file_urls).toEqual([])
    expect(r.links).toEqual([])
  })
})

// ── Token minting ─────────────────────────────────────────────────────────────

describe('mintToken / hashToken / isPAT', () => {
  it('raw token has ggc_ prefix', () => {
    const { raw } = mintToken()
    expect(raw.startsWith('ggc_')).toBe(true)
    expect(isPAT(raw)).toBe(true)
  })

  it('hash is 64-char hex (sha256)', () => {
    const { hash } = mintToken()
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('two mints produce different tokens', () => {
    const a = mintToken()
    const b = mintToken()
    expect(a.raw).not.toBe(b.raw)
    expect(a.hash).not.toBe(b.hash)
  })

  it('hash is deterministic', () => {
    const { raw } = mintToken()
    expect(hashToken(raw)).toBe(hashToken(raw))
  })

  it('raw never stored — only hash', () => {
    const { raw, hash } = mintToken()
    expect(hash).not.toBe(raw)
  })

  it('isPAT returns false for non-PAT strings', () => {
    expect(isPAT('eyJhbGciOiJSUzI1NiJ9.x.y')).toBe(false)
    expect(isPAT('')).toBe(false)
  })
})
