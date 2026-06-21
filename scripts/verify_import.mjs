#!/usr/bin/env node
// READ-ONLY post-import verification: counts, duplication, broken links.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) { const m = line.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim() }
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const nn = x => (x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

async function all(table, cols) {
  const out = []; let from = 0
  for (;;) {
    const { data, error } = await s.from(table).select(cols).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data); if (data.length < 1000) break; from += 1000
  }
  return out
}
let problems = 0
const fail = m => { console.log(`  ✗ ${m}`); problems++ }
const ok = m => console.log(`  ✓ ${m}`)

const companies = await all('companies', 'id,name,parent_company_id,industry_ids,region_ids,stage_id,type_id,status_id,investment_stage_ids')
const contacts = await all('contacts', 'id,name,company_id,industry_ids,region_ids,stage_ids')
const meetings = await all('meetings', 'id,title,company_id,type_id')
const parts = await all('meeting_participants', 'id,meeting_id,contact_id')
const logs = await all('interaction_logs', 'id,contact_id,meeting_id')
const tagIds = new Set()
for (const t of ['tag_industries', 'tag_regions', 'tag_stages', 'tag_types', 'tag_statuses', 'tag_meeting_types'])
  for (const r of await all(t, 'id')) tagIds.add(r.id)

const compIds = new Set(companies.map(c => c.id))
const contactIds = new Set(contacts.map(c => c.id))
const meetingIds = new Set(meetings.map(m => m.id))

console.log('\n── Counts ──')
console.log(`  companies=${companies.length} contacts=${contacts.length} meetings=${meetings.length} participants=${parts.length} logs=${logs.length}`)
companies.length === 155 ? ok('companies = 155 (expected)') : fail(`companies = ${companies.length}, expected 155`)
meetings.length === 238 ? ok('meetings = 238 (expected)') : fail(`meetings = ${meetings.length}, expected 238`)

console.log('\n── Duplication ──')
const cByName = {}; for (const c of companies) (cByName[nn(c.name)] ??= []).push(c.name)
const dupC = Object.entries(cByName).filter(([, v]) => v.length > 1)
dupC.length ? fail(`duplicate companies: ${JSON.stringify(dupC)}`) : ok('no duplicate company names')
const ctByKey = {}; for (const c of contacts) (ctByKey[nn(c.name) + '@' + (c.company_id || '∅')] ??= []).push(c.name)
const dupCt = Object.entries(ctByKey).filter(([, v]) => v.length > 1)
dupCt.length ? fail(`duplicate contacts (same name+company): ${dupCt.length}`) : ok('no duplicate contacts (name+company)')

console.log('\n── Broken FK links ──')
let bad = companies.filter(c => c.parent_company_id && !compIds.has(c.parent_company_id))
bad.length ? fail(`companies w/ bad parent_company_id: ${bad.length}`) : ok('all parent_company_id valid')
bad = contacts.filter(c => c.company_id && !compIds.has(c.company_id))
bad.length ? fail(`contacts w/ bad company_id: ${bad.length}`) : ok('all contact.company_id valid')
bad = meetings.filter(m => m.company_id && !compIds.has(m.company_id))
bad.length ? fail(`meetings w/ bad company_id: ${bad.length}`) : ok('all meeting.company_id valid')
bad = parts.filter(p => !meetingIds.has(p.meeting_id) || !contactIds.has(p.contact_id))
bad.length ? fail(`participants w/ bad refs: ${bad.length}`) : ok('all participants reference valid meeting+contact')
bad = logs.filter(l => !contactIds.has(l.contact_id) || (l.meeting_id && !meetingIds.has(l.meeting_id)))
bad.length ? fail(`logs w/ bad refs: ${bad.length}`) : ok('all interaction_logs reference valid contact+meeting')

console.log('\n── Array tag-id integrity (not FK-enforced) ──')
function checkArr(rows, field, label) {
  let n = 0; for (const r of rows) for (const id of (r[field] || [])) if (!tagIds.has(id)) n++
  n ? fail(`${label}.${field}: ${n} stale tag ids`) : ok(`${label}.${field} all valid`)
}
for (const f of ['industry_ids', 'region_ids', 'investment_stage_ids']) checkArr(companies, f, 'companies')
for (const f of ['industry_ids', 'region_ids', 'stage_ids']) checkArr(contacts, f, 'contacts')
for (const f of ['stage_id', 'type_id', 'status_id']) {
  const n = companies.filter(c => c[f] && !tagIds.has(c[f])).length
  n ? fail(`companies.${f}: ${n} stale`) : ok(`companies.${f} all valid`)
}

console.log('\n── Hierarchy spot-check ──')
const byName = {}; for (const c of companies) byName[nn(c.name)] = c
function childrenOf(parentName) {
  const p = byName[nn(parentName)]; if (!p) return null
  return companies.filter(c => c.parent_company_id === p.id).map(c => c.name)
}
for (const [parent, expect] of [['500', ['500 Latam Seed IV', 'SEA 500', 'Luchadores III']], ['Endeavor', ['Endeavor Catalyst']]]) {
  const kids = childrenOf(parent)
  if (!kids) { fail(`parent "${parent}" missing`); continue }
  const missing = expect.filter(e => !kids.some(k => nn(k) === nn(e)))
  missing.length ? fail(`${parent} children missing: ${missing}`) : ok(`${parent} → [${kids.join(', ')}]`)
}
byName['gilgamesh ventures'] ? ok('Gilgamesh Ventures present') : fail('Gilgamesh Ventures missing')
byName['gilgames vc'] && fail('old "Gilgames VC" still present (should be renamed)')

console.log('\n── Business-link spot-check (meeting → company) ──')
const mByTitle = t => meetings.find(m => nn(m.title).startsWith(nn(t)))
const compName = id => companies.find(c => c.id === id)?.name ?? 'NULL'
for (const [title, expect] of [
  ['Cencosud Ventures', 'Cencosud CVC'], ['Fintech Collective', 'Fintech.io'], ['Valor', 'Valor Capital Partners'],
  ['NY - Portage', 'Portage ventures'], ['LV VC', 'LarrainVial'], ['Guil VC', 'Guil Mobility'],
  ['Wayra Meet & Drink', 'Wayra Hispam'], ['Mr Pink', 'Mr Pink'], ['Salkantay VC', 'Salkantay VC'],
]) {
  const m = mByTitle(title); const got = m ? compName(m.company_id) : '(no meeting)'
  nn(got) === nn(expect) ? ok(`"${title}" → ${got}`) : fail(`"${title}" → ${got} (expected ${expect})`)
}

console.log(`\n${problems === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${problems} problem(s) found`}`)
process.exit(problems ? 1 : 0)
