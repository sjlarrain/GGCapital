/**
 * Auth middleware unit tests — covers the A1 acceptance matrix:
 * jwt / pat / expired / revoked / over-scope.
 *
 * supabaseAdmin is mocked so no real network calls are made.
 */

import { authenticate, hasScope } from '@/app/api/v1/_lib/auth'
import type { Scope } from '@/lib/schemas/token'
import { hashToken } from '@/lib/auth/tokens'

// ── Mock supabaseAdmin ────────────────────────────────────────────────────────

const mockFrom  = jest.fn()
const mockGetUser = jest.fn()

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(token?: string): Request {
  const headers: Record<string, string> = {}
  if (token) headers['authorization'] = `Bearer ${token}`
  return new Request('http://localhost/api/v1/companies', { headers })
}

function chainedMock(returnVal: unknown) {
  const obj: Record<string, jest.Mock> = {}
  const methods = ['select', 'eq', 'single', 'update', 'then']
  methods.forEach((m) => { obj[m] = jest.fn().mockReturnValue(obj) })
  obj['single'] = jest.fn().mockResolvedValue(returnVal)
  obj['then'] = jest.fn().mockResolvedValue(undefined)
  return obj
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => { jest.clearAllMocks() })

describe('authenticate — no token', () => {
  it('returns null when Authorization header absent', async () => {
    const ctx = await authenticate(makeRequest())
    expect(ctx).toBeNull()
  })

  it('returns null when header is not Bearer', async () => {
    const req = new Request('http://localhost', { headers: { authorization: 'Basic abc' } })
    const ctx = await authenticate(req)
    expect(ctx).toBeNull()
  })
})

describe('authenticate — Supabase JWT', () => {
  it('returns AuthContext for a valid JWT', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    mockFrom.mockReturnValue(chainedMock({ data: { role: 'user' }, error: null }))

    const ctx = await authenticate(makeRequest('eyJvalid.jwt.token'))
    expect(ctx).not.toBeNull()
    expect(ctx?.userId).toBe('user-1')
    expect(ctx?.role).toBe('user')
    expect(ctx?.scopes).toContain('crm:read')
    expect(ctx?.scopes).toContain('crm:write')
    expect(ctx?.scopes).not.toContain('staging:promote')
  })

  it('returns admin scopes for admin user', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'admin-1' } }, error: null })
    mockFrom.mockReturnValue(chainedMock({ data: { role: 'admin' }, error: null }))

    const ctx = await authenticate(makeRequest('eyJadmin.jwt.token'))
    expect(ctx?.role).toBe('admin')
    expect(ctx?.scopes).toContain('staging:promote')
  })

  it('returns null for invalid JWT', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('invalid') })
    const ctx = await authenticate(makeRequest('bad-jwt-token'))
    expect(ctx).toBeNull()
  })
})

describe('authenticate — PAT', () => {
  const RAW_PAT = 'ggc_testtoken1234567890abcdef1234567890abcdef1234567890abcdef1234'
  const HASH = hashToken(RAW_PAT)

  it('returns AuthContext for a valid PAT', async () => {
    mockFrom
      .mockReturnValueOnce(chainedMock({
        data: { user_id: 'user-2', scopes: ['crm:read'], expires_at: null, revoked_at: null },
        error: null,
      }))
      .mockReturnValue(chainedMock({ data: { role: 'user' }, error: null }))

    const ctx = await authenticate(makeRequest(RAW_PAT))
    expect(ctx?.userId).toBe('user-2')
    expect(ctx?.scopes).toEqual(['crm:read'])
  })

  it('returns null for revoked PAT', async () => {
    mockFrom.mockReturnValue(chainedMock({
      data: { user_id: 'user-2', scopes: ['crm:read'], expires_at: null, revoked_at: '2026-01-01T00:00:00Z' },
      error: null,
    }))
    const ctx = await authenticate(makeRequest(RAW_PAT))
    expect(ctx).toBeNull()
  })

  it('returns null for expired PAT', async () => {
    mockFrom.mockReturnValue(chainedMock({
      data: { user_id: 'user-2', scopes: ['crm:read'], expires_at: '2020-01-01T00:00:00Z', revoked_at: null },
      error: null,
    }))
    const ctx = await authenticate(makeRequest(RAW_PAT))
    expect(ctx).toBeNull()
  })

  it('returns null when PAT hash not found', async () => {
    mockFrom.mockReturnValue(chainedMock({ data: null, error: new Error('not found') }))
    const ctx = await authenticate(makeRequest(RAW_PAT))
    expect(ctx).toBeNull()
  })

  it('token hash is deterministic and does not equal raw', () => {
    expect(HASH).not.toBe(RAW_PAT)
    expect(HASH).toBe(hashToken(RAW_PAT))
  })
})

describe('hasScope', () => {
  const ctx = { userId: 'u', role: 'user' as const, scopes: ['crm:read', 'crm:write'] as Scope[], authType: 'jwt' as const }

  it('returns true when scope is present', () => {
    expect(hasScope(ctx, 'crm:read')).toBe(true)
  })

  it('returns false when scope is absent', () => {
    expect(hasScope(ctx, 'staging:promote')).toBe(false)
  })
})

describe('scope cannot exceed role', () => {
  it('admin role includes staging:promote; user role does not', async () => {
    // Admin JWT
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'admin-1' } }, error: null })
    mockFrom.mockReturnValue(chainedMock({ data: { role: 'admin' }, error: null }))
    const adminCtx = await authenticate(makeRequest('eyJadmin'))
    expect(adminCtx?.scopes).toContain('staging:promote')

    // User JWT
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    mockFrom.mockReturnValue(chainedMock({ data: { role: 'user' }, error: null }))
    const userCtx = await authenticate(makeRequest('eyJuser'))
    expect(userCtx?.scopes).not.toContain('staging:promote')
  })
})
