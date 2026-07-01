/**
 * Dedupe search for staged events (A6).
 *
 * Before a staged `new_company` / `new_contact` can be promoted, we check the
 * live CRM for matches — a confident hit should be linked instead of creating a
 * duplicate, and several weak hits are ambiguous. This runs the same kind of
 * lookup as `/api/v1/search` (name ilike, email exact) and returns the
 * `DedupeInput` that `classifyEvent` (rules.ts) consumes; keeping the DB access
 * here lets the classifier stay pure and unit-testable.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DedupeInput, DedupeSignal } from '@/lib/staging/rules'
import type { EventClass } from '@/lib/schemas/staging'
import { normName } from '@/lib/staging/mappings'

type QueryClient = Pick<SupabaseClient, 'from'>
type Obj = Record<string, unknown>

function asObj(v: unknown): Obj | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null
}
function str(o: Obj | null, key: string): string | null {
  const v = o?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

async function companySignal(client: QueryClient, name: string): Promise<DedupeSignal> {
  const { data } = await client
    .from('companies')
    .select('id, name')
    .ilike('name', `%${name}%`)
    .is('deleted_at', null)
    .limit(25)
  const rows = (data ?? []) as { id: string; name: string }[]
  const target = normName(name)
  const exact = rows.filter((r) => normName(r.name) === target)
  return {
    strongMatchId: exact.length === 1 ? exact[0].id : null,
    candidateCount: rows.length,
  }
}

async function contactSignal(client: QueryClient, email: string | null, name: string | null): Promise<DedupeSignal> {
  // Email is the strong key; fall back to name for candidate counting.
  if (email) {
    const { data } = await client.from('contacts').select('id').eq('email', email).is('deleted_at', null).limit(5)
    const rows = (data ?? []) as { id: string }[]
    if (rows.length >= 1) return { strongMatchId: rows.length === 1 ? rows[0].id : null, candidateCount: rows.length }
  }
  if (name) {
    const { data } = await client.from('contacts').select('id').ilike('name', `%${name}%`).is('deleted_at', null).limit(25)
    const rows = (data ?? []) as { id: string }[]
    return { strongMatchId: null, candidateCount: rows.length }
  }
  return { candidateCount: 0 }
}

/**
 * Compute dedupe signals for a staged event's proposed links. Only searches for
 * records that would be *created* (company/contact given by name, not id).
 */
export async function computeDedupe(
  client: QueryClient,
  input: { event_class?: EventClass | null; proposed_links?: unknown }
): Promise<DedupeInput> {
  const links = asObj(input.proposed_links) ?? {}
  const company = asObj(links.company)
  const contact = asObj(links.contact)
  const out: DedupeInput = {}

  // Company: only when creating a new one (has a name, no existing id).
  const companyName = str(company, 'name')
  if (companyName && !str(company, 'id')) {
    out.company = await companySignal(client, companyName)
  }

  // Contact: only when creating a new one (has a name, no existing id).
  const contactName = str(contact, 'name')
  if (contactName && !str(contact, 'id')) {
    out.contact = await contactSignal(client, str(contact, 'email'), contactName)
  }

  return out
}
