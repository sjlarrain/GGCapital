/**
 * A4 staging integration test (temporary — delete after use).
 *
 * Drives the live dev server (http://localhost:3000) with a real PAT, plus
 * direct service-role checks, against the actual Supabase DB. Requires
 * 012_staging.sql to be applied first.
 *
 * Run: node scripts/staging_itest.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

// ── env ───────────────────────────────────────────────────────────────────────
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const get = (k) => env.match(new RegExp(`${k}\\s*=\\s*(\\S+)`))?.[1]
const URL_ = get('NEXT_PUBLIC_SUPABASE_URL')
const SRK = get('SUPABASE_SERVICE_ROLE_KEY')
const BASE = process.env.BASE ?? 'http://localhost:3000'
const admin = createClient(URL_, SRK, { auth: { persistSession: false } })

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m) } else { fail++; console.error('  ✗', m) } }

// track ids for cleanup
const cleanup = { events: [], companies: [], contacts: [], tokenHash: null }

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json }
}

async function main() {
  // pick a real auth user to own everything
  const { data: profiles } = await admin.from('user_profiles').select('id, role').limit(1)
  const userId = profiles?.[0]?.id
  if (!userId) throw new Error('no user_profiles row to use as owner')
  console.log('owner user:', userId)

  // mint a PAT with full staging scopes (this user is an "agent" caller)
  const raw = 'ggc_' + randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(raw).digest('hex')
  cleanup.tokenHash = tokenHash
  {
    const { error } = await admin.from('api_tokens').insert({
      user_id: userId, name: 'A4 itest', token_hash: tokenHash,
      scopes: ['crm:read', 'crm:write', 'staging:read', 'staging:write', 'staging:promote'],
    })
    if (error) throw new Error('PAT insert failed: ' + error.message)
  }

  const ref = 'itest-' + Date.now()

  // ── 1. ingest (complete new_contact, high confidence) ───────────────────────
  console.log('\n[1] ingest + idempotency')
  const ingestBody = {
    source: 'agent', source_ref: ref,
    raw_payload: { note: 'met Alice from Acme' },
    confidence: 0.9,
    event_class: 'new_contact',
    proposed_links: {
      company: { name: 'Acme ITest ' + ref, website: 'https://acme.example' },
      contact: { name: 'Alice ITest', email: `alice.${ref}@example.com`, role: 'CEO' },
    },
  }
  const r1 = await api('/staging/events', { method: 'POST', token: raw, body: ingestBody })
  ok(r1.status === 202 && r1.json?.id, `ingest -> 202 (${r1.status})`)
  const eventId = r1.json?.id
  if (eventId) cleanup.events.push(eventId)

  const r1b = await api('/staging/events', { method: 'POST', token: raw, body: ingestBody })
  ok(r1b.status === 202 && r1b.json?.id === eventId, 'duplicate source_ref returns same id (no second event)')

  // ── 2. classify complete -> ready ───────────────────────────────────────────
  console.log('\n[2] classify')
  const r2 = await api(`/staging/events/${eventId}/classify`, { method: 'POST', token: raw })
  ok(r2.status === 200 && r2.json?.status === 'ready', `complete+0.9 -> ready (${r2.json?.status})`)

  // ── 3. agent promote blocked (auto-promote off) -> 409 ──────────────────────
  console.log('\n[3] agent promote blocked')
  const r3 = await api(`/staging/events/${eventId}/promote`, { method: 'POST', token: raw })
  ok(r3.status === 409, `agent promote (flag off) -> 409 (${r3.status}: ${r3.json?.error ?? ''})`)

  // ── 4. incomplete contact -> needs_info, never ready ────────────────────────
  console.log('\n[4] hard gate -> needs_info')
  const ref2 = ref + '-b'
  const r4i = await api('/staging/events', {
    method: 'POST', token: raw,
    body: {
      source: 'agent', source_ref: ref2, raw_payload: {}, confidence: 0.99, event_class: 'new_contact',
      proposed_links: { contact: { name: 'Bob NoEmail' } }, // missing email + company
    },
  })
  const eventId2 = r4i.json?.id
  if (eventId2) cleanup.events.push(eventId2)
  const r4 = await api(`/staging/events/${eventId2}/classify`, { method: 'POST', token: raw })
  ok(r4.json?.status === 'needs_info', `missing email/company -> needs_info (${r4.json?.status})`)
  ok((r4.json?.blocking_reasons ?? []).includes('missing_contact_email'), 'blocking_reasons includes missing_contact_email')

  // promote a non-ready event -> 409
  const r4p = await api(`/staging/events/${eventId2}/promote`, { method: 'POST', token: raw })
  ok(r4p.status === 409, `promote non-ready -> 409 (${r4p.status})`)

  // ── 5. transactional promote via RPC (human/server-action path) ─────────────
  console.log('\n[5] transactional promote (RPC)')
  const { data: promoted, error: promErr } = await admin.rpc('promote_staging_event', {
    p_event_id: eventId, p_actor: userId,
  })
  ok(!promErr && promoted?.status === 'promoted', `RPC promote -> promoted (${promErr?.message ?? promoted?.status})`)
  const refs = promoted?.promoted_to ?? []
  ok(refs.length === 2, `created 2 records (company+contact) (${refs.length})`)
  for (const x of refs) {
    if (x.table === 'companies') cleanup.companies.push(x.id)
    if (x.table === 'contacts') cleanup.contacts.push(x.id)
  }
  // verify rows really exist + contact linked to the new company
  const compId = cleanup.companies[0], contId = cleanup.contacts[0]
  const { data: comp } = await admin.from('companies').select('id, name, data_status').eq('id', compId).single()
  const { data: cont } = await admin.from('contacts').select('id, email, company_id').eq('id', contId).single()
  ok(!!comp, 'company row exists in CRM')
  ok(cont?.company_id === compId, 'contact linked to the newly created company')

  // promoting again -> 409 (already promoted, not ready)
  const r5b = await api(`/staging/events/${eventId}/promote`, { method: 'POST', token: raw })
  ok(r5b.status === 409, `re-promote already-promoted -> 409 (${r5b.status})`)

  // ── 6. reject (terminal) ────────────────────────────────────────────────────
  console.log('\n[6] reject')
  const r6 = await api(`/staging/events/${eventId2}/reject`, { method: 'POST', token: raw, body: { note: 'dupe' } })
  ok(r6.status === 200 && r6.json?.status === 'rejected', `reject -> rejected (${r6.json?.status})`)

  // ── 7. every transition logged ──────────────────────────────────────────────
  console.log('\n[7] audit log')
  const { data: log1 } = await admin.from('staging_event_log').select('action,to_status').eq('event_id', eventId).order('created_at')
  // expect: ingest, classify, promote
  ok(log1?.some(l => l.action === 'ingest'), 'log has ingest')
  ok(log1?.some(l => l.action === 'classify'), 'log has classify')
  ok(log1?.some(l => l.action === 'promote' && l.to_status === 'promoted'), 'log has promote->promoted')

  // ── 8. queue filter ─────────────────────────────────────────────────────────
  console.log('\n[8] queue filter')
  const r8 = await api('/staging/events?status=rejected&limit=100', { token: raw })
  ok(r8.status === 200 && Array.isArray(r8.json) && r8.json.every(e => e.status === 'rejected'), 'GET ?status=rejected returns only rejected')
}

async function doCleanup() {
  console.log('\n[cleanup]')
  for (const id of cleanup.contacts) await admin.from('contacts').delete().eq('id', id)
  for (const id of cleanup.companies) await admin.from('companies').delete().eq('id', id)
  for (const id of cleanup.events) await admin.from('staging_events').delete().eq('id', id)
  if (cleanup.tokenHash) await admin.from('api_tokens').delete().eq('token_hash', cleanup.tokenHash)
  console.log('  done')
}

main()
  .catch((e) => { console.error('FATAL', e); fail++ })
  .finally(async () => {
    await doCleanup()
    console.log(`\n==== ${pass} passed, ${fail} failed ====`)
    process.exit(fail ? 1 : 0)
  })
