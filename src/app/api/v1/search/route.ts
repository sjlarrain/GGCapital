import type { NextRequest } from 'next/server'
import { authenticate, hasScope } from '../_lib/auth'
import { ok, unauthorized, forbidden, badRequest, serverError } from '../_lib/respond'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()
  if (!hasScope(ctx, 'crm:read')) return forbidden()

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return badRequest('q must be at least 2 characters')

  const [companies, contacts] = await Promise.all([
    supabaseAdmin
      .from('companies')
      .select('id, name, website, data_status, missing_fields')
      .ilike('name', `%${q}%`)
      .is('deleted_at', null)
      .limit(10),
    supabaseAdmin
      .from('contacts')
      .select('id, name, email, company_id, data_status, missing_fields, company:companies(id, name)')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .is('deleted_at', null)
      .limit(10),
  ])

  if (companies.error) return serverError(companies.error.message)
  if (contacts.error) return serverError(contacts.error.message)

  return ok({
    q,
    companies: companies.data ?? [],
    contacts:  contacts.data ?? [],
    total: (companies.data?.length ?? 0) + (contacts.data?.length ?? 0),
  })
}
