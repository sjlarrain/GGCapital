// Fix companies that have multiple stages in the CSV but only got the first one.
// Run AFTER migration 007 (stage_id → stage_ids).
import { createClient } from '@supabase/supabase-js'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars')
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const STAGE_MAP = {
  'pre-seed': 'Pre-Seed', 'seed': 'Seed', 'series a': 'Series A', 'series b': 'Series B',
  'series c': 'Series C', 'series d+': 'Series D+', 'growth': 'Growth', 'pre-ipo': 'Pre-IPO',
  'listed': 'Listed', 'mature': 'Mature', 'late stage': 'Late Stage',
  'non deal roadshow': 'Non Deal Roadshow', 'vc fundraising': 'VC Fundraising',
  'venturedebt': 'Venture Debt', 'venture debt': 'Venture Debt',
}

const { data: tagRows } = await supabase.from('tag_stages').select('id,name')
const stagesByName = new Map(tagRows.map(t => [t.name.toLowerCase(), t.id]))

function resolveStages(raw) {
  if (!raw) return []
  return raw.split(',').map(s => {
    const k = s.trim().toLowerCase()
    const canonical = STAGE_MAP[k] ?? s.trim()
    return stagesByName.get(canonical.toLowerCase()) ?? null
  }).filter(Boolean)
}

const CRM_DIR = path.join(__dirname, '../BBDD/CRM')
const files = (await readdir(CRM_DIR)).filter(f => f.endsWith('.md'))

const updates = []
for (const file of files) {
  const content = await readFile(path.join(CRM_DIR, file), 'utf8')
  const stageMatch = content.match(/^Stage:\s*(.+)$/m)
  if (!stageMatch) continue
  const raw = stageMatch[1].trim()
  if (!raw.includes(',')) continue  // only multi-stage rows need fixing

  const companyNameMatch = file.match(/^(.+?)\s+[a-f0-9]{32}\.md$/)
  if (!companyNameMatch) continue
  const companyName = companyNameMatch[1]
  const stage_ids = resolveStages(raw)
  if (stage_ids.length < 2) continue

  updates.push({ name: companyName, raw, stage_ids })
}

if (updates.length === 0) {
  console.log('No multi-stage companies to fix.')
  process.exit(0)
}

console.log(`Fixing ${updates.length} companies:`)
for (const u of updates) {
  const stageNames = u.stage_ids.map(id => tagRows.find(t => t.id === id)?.name)
  const { data: co } = await supabase.from('companies').select('id,name').ilike('name', u.name).single()
  if (!co) { console.log(`  SKIP (not found): ${u.name}`); continue }
  await supabase.from('companies').update({ stage_ids: u.stage_ids }).eq('id', co.id)
  console.log(`  ✓ ${co.name}: ${stageNames.join(', ')}`)
}

console.log('Done.')
