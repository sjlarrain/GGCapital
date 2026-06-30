/**
 * Seed a few SAMPLE staging events for manual /triage review (temporary).
 * They sit in staging_events only (not your real CRM) until you promote.
 * Delete them later with: node scripts/staging_seed.mjs --clean
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const get = (k) => env.match(new RegExp(`${k}\\s*=\\s*(\\S+)`))?.[1]
const admin = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const PREFIX = 'sample-'

if (process.argv.includes('--clean')) {
  const { data } = await admin.from('staging_events').select('id').like('source_ref', `${PREFIX}%`)
  for (const r of data ?? []) await admin.from('staging_events').delete().eq('id', r.id)
  console.log(`cleaned ${data?.length ?? 0} sample events`)
  process.exit(0)
}

const { data: profiles } = await admin.from('user_profiles').select('id').limit(1)
const userId = profiles?.[0]?.id

const rows = [
  {
    source: 'agent', source_ref: PREFIX + 'ready',
    raw_payload: { note: 'Agent found a clean new contact at a new company.' },
    event_class: 'new_contact', confidence: 0.9,
    proposed_links: {
      company: { name: 'Northwind Labs (SAMPLE)', website: 'https://northwind.example', description: 'Sample seeded company' },
      contact: { name: 'Dana Reyes', email: 'dana@northwind.example', role: 'Founder' },
    },
    created_by: userId,
  },
  {
    source: 'agent', source_ref: PREFIX + 'needsinfo',
    raw_payload: { note: 'Agent unsure — no email captured.' },
    event_class: 'new_contact', confidence: 0.99,
    proposed_links: { contact: { name: 'Sam Okoro (SAMPLE)' } }, // missing email + company
    created_by: userId,
  },
  {
    source: 'agent', source_ref: PREFIX + 'lowconf',
    raw_payload: { note: 'Complete but low confidence on the match.' },
    event_class: 'new_contact', confidence: 0.6,
    proposed_links: {
      company: { name: 'Acme Holdings (SAMPLE)' },
      contact: { name: 'Lee Park', email: 'lee@acme.example' },
    },
    created_by: userId,
  },
]

for (const r of rows) {
  const { error } = await admin.from('staging_events').upsert(r, { onConflict: 'source,source_ref' })
  console.log(error ? `  ✗ ${r.source_ref}: ${error.message}` : `  ✓ seeded ${r.source_ref}`)
}
console.log('\nOpen /triage and hit "Re-run classify" on each to see ready / needs_info / classified.')
