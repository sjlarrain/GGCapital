#!/usr/bin/env node
// DESTRUCTIVE: deletes ALL rows from the data tables (keeps tags, users, feedback).
// FK-safe order. Requires --confirm to run.
//
//   node scripts/wipe_db.mjs --confirm
//
// After wiping: run migration 006 in Supabase, then `node scripts/import_bbdd.mjs`.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim()
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } })

if (!process.argv.includes('--confirm')) {
  console.error('Refusing to wipe without --confirm. Run: node scripts/wipe_db.mjs --confirm')
  process.exit(1)
}

// FK-safe order: children before parents
const TABLES = ['interaction_logs', 'meeting_participants', 'meetings', 'contacts', 'companies']

for (const t of TABLES) {
  const { count: before } = await supabase.from(t).select('id', { count: 'exact', head: true })
  const { error } = await supabase.from(t).delete().not('id', 'is', null)
  if (error) { console.error(`✗ ${t}: ${error.message}`); process.exit(1) }
  const { count: after } = await supabase.from(t).select('id', { count: 'exact', head: true })
  console.log(`✓ ${t}: ${before ?? '?'} → ${after ?? '?'}`)
}
console.log('\nWipe complete. Next: run migration 006, then node scripts/import_bbdd.mjs')
