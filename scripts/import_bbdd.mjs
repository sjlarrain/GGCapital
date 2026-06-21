#!/usr/bin/env node
// BBDD → Supabase import (v2)
//
// Phases:
//   1A companies (CRM)         1B companies (Contacts)   1C explicit creates (managers/funds)
//   reparent + rename          2A contacts (Contacts)    2B stub contacts (CRM)
//   3 meetings                 4 participants            5 interaction logs
//   6 enrichment (roll fund tags up from contacts; push company tags down to stubs)
//
// Run AFTER wiping data and running migration 006.
//   node scripts/import_bbdd.mjs            # aborts if companies table is non-empty
//   node scripts/import_bbdd.mjs --force    # run anyway
//
// HARD RULE: meetings never create companies. Companies come ONLY from CRM rows,
// Contacts rows, and CREATE_COMPANIES. Every meeting links to an existing company or stays null.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BBDD = join(ROOT, 'BBDD')
const FORCE = process.argv.includes('--force')

// ── ENV ──────────────────────────────────────────────────────
function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}
loadEnv()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars')
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── CSV parser ───────────────────────────────────────────────
function parseCSVLine(line) {
  const f = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (c === ',' && !q) { f.push(cur); cur = '' }
    else cur += c
  }
  f.push(cur); return f
}
function parseCSV(raw) {
  const lines = raw.replace(/^﻿/, '').split('\n')
  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  const out = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const v = parseCSVLine(lines[i])
    const r = {}; headers.forEach((h, idx) => r[h] = (v[idx] ?? '').trim())
    out.push(r)
  }
  return out
}

// ── small helpers ────────────────────────────────────────────
function normName(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim()
}
function splitComma(s) { return !s ? [] : s.split(',').map(v => v.trim()).filter(Boolean) }
function parseNum(raw) {
  if (!raw) return null
  const s = raw.replace(/,/g, '').trim()
  if (/^n\.?\s*a\.?$/i.test(s)) return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}
function parseDateISO(raw) {
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
function fileList(raw) { return raw ? [raw.trim()] : [] }
function unionInto(arr, more) { for (const x of more) if (x && !arr.includes(x)) arr.push(x) }

// ── Canonical company names (identity / spelling) ────────────
// Applied EVERYWHERE (companies + meetings). Same entity, corrected spelling.
const CANONICAL_NAMES = {
  'arpegio vc': 'Arpegio', 'besant capital': 'Besant VC', 'das calendar': 'Das calendar',
  'fintechlab': 'FintechLab', 'manutara': 'Manutara Ventures', 'puramente': 'PuraMente',
  'ssv': 'SSV VC', 'savia': 'Savia VC', 'savia ventures': 'Savia VC', 'verve vc': 'Verve',
  'vor-tex': 'Vor-Tex', 'wareclouds': 'WareClouds', 'globalplanet.oi': 'GlobalPlanet.io',
  'globalplanet.io': 'GlobalPlanet.io', '1616 ventures': '1616', 'bventures': 'BVC',
  'blustone': 'Blustone', 'blustone br': 'Blustone', 'boost vc': 'Boost',
  'cube ventures': 'Cube VC', 'dalus': 'Dalus VC', 'first check vc': 'First Check Ventures',
  'honey island': 'Honey Island VC', 'invariantes fund': 'Invariantes',
  'maya capital': 'Maya Ventures', 'norte ventures': 'Norte', 'norte br': 'Norte',
  'onevc': 'One VC', 'pygma': 'Pygma VC', 'upload ventures': 'Upload',
  '500 latam seed -iv': '500 Latam Seed IV',
  'alpes lab': 'Alpes Lab', 'alpes labs': 'Alpes Lab',
  // Gilgamesh: ONE company, real name "Gilgamesh Ventures" (CRM typo was "Gilgames VC").
  'gilgames vc': 'Gilgamesh Ventures', 'gilgamesh vc': 'Gilgamesh Ventures',
  'gilgamesh am': 'Gilgamesh Ventures', 'gilgamesh summit': 'Gilgamesh Ventures',
  // meeting spelling variants that are the same entity as an existing company
  'selvaviva': 'Selva Viva', 'vitaldoc': 'Vital-Doc', 'atomic kitch': 'Atomic Kitchens',
  'line up': 'LineUp', 'procitex-ecofiber': 'Procitex', 'carlos vial (berkeley vc)': 'Carlos Vial',
}
function applyCanonical(name) { return CANONICAL_NAMES[normName(name)] ?? name }

// ── Meeting → company business links (NOT identity; only at meeting resolution) ─
// keyed by the normalized extracted meeting key → target company canonical name.
const MEETING_LINK = {
  'cencosud ventures': 'Cencosud CVC',
  'guil vc': 'Guil Mobility',
  'genesis ventures': 'Genesis VC',
  'wayra meet & drink': 'Wayra Hispam',
  'lv vc': 'LarrainVial',
  'fintech collective': 'Fintech.io', 'fintech co': 'Fintech.io', 'ny - fintech co': 'Fintech.io',
  'valor': 'Valor Capital Partners', 'ny - valor capital group': 'Valor Capital Partners',
  'ny - portage': 'Portage ventures',
  '500': '500', '500 latam': '500', 'luchadores iii': 'Luchadores III',
  'amador ventures': 'Amador Ventures', 'amador holdings': 'Amador Ventures',
  'fen ventures': 'FEN Ventures',
  'endeavor': 'Endeavor', 'endeavor catalyst': 'Endeavor Catalyst',
  // new funds — meeting-name variants → fund company
  'mrpink': 'Mr Pink', 'salkantay': 'Salkantay VC', 'ny - red bike': 'Red Bike',
}

// ── New fund companies (created from meeting notes per Santiago) ─
// Populated from BBDD/Meetings/*.md notes. Contacts mined from the same notes.
const NEW_FUNDS = [
  { name: 'a16z Brazil',      type: 'VC',   regions: 'Brasil',          industries: 'Agnostic' },
  { name: 'ABSeed',           type: 'VC',   regions: 'Brasil',          industries: 'SaaS',                          stages: 'Seed, Series A',            contacts: [{ name: 'Geraldo', role: 'Managing Partner' }] },
  { name: 'Alexia VC',        type: 'VC',   regions: 'Brasil',          industries: 'AI, SaaS',                      stages: 'Seed, Series A',            contacts: [{ name: 'Patrick Arippol', role: 'Managing Partner' }, { name: 'Wolff', role: 'Partner' }] },
  { name: 'Caravela',         type: 'VC',   regions: 'Brasil, Latam',   industries: 'Agnostic',                      stages: 'Pre-Seed, Seed, Series A',  contacts: [{ name: 'Rodrigo Andersen', role: 'Investment' }, { name: 'Richard', role: 'Investor Relations' }] },
  { name: 'Cortado Ventures', type: 'VC',   regions: 'EE.UU.',          industries: 'Fintech',                       stages: 'Pre-Seed, Seed, Series A',  contacts: [{ name: 'Nathaniel Harding', role: 'Managing Partner' }] },
  { name: 'Mr Pink',          type: 'VC',   regions: 'Argentina',       industries: 'Fintech, Foodtech',             stages: 'Seed',                      website: 'mrpink.vc', contacts: [{ name: 'Hernán Haro', role: 'General Partner' }] },
  { name: 'Red Bike',         type: 'VC',   regions: 'EE.UU.',          industries: 'Fintech, SaaS, Healthtech',     stages: 'Pre-Seed, Seed',            contacts: [{ name: 'Rachel', role: 'General Partner' }, { name: 'Herman', role: 'General Partner' }] },
  { name: 'Salkantay VC',     type: 'VC',   regions: 'Peru, Latam',     industries: 'Fintech, Healthtech, SaaS, Climate Tech', stages: 'Seed, Series A',  contacts: [{ name: 'Martín Aspillaga', role: 'Partner' }, { name: 'Samir Al-Darwish', role: 'Partner' }] },
  { name: 'Squad Ventures',   type: 'VC',   regions: 'Latam',           industries: 'Agnostic',                      stages: 'Pre-Seed, Seed',            contacts: [{ name: 'Diego Noriega', role: 'Partner' }] },
  { name: 'SaaSholic',        type: 'VC',   regions: 'Brasil',          industries: 'SaaS' },
  { name: 'The Venture City', type: 'VC',   regions: 'EE.UU.',          industries: 'Agnostic' },
  { name: 'Bridge Latam',     type: null,   regions: 'Latam' },
  { name: 'DKF',              type: null },
]

// ── Companies created outside CRM/Contacts (the ONLY such creates) ─
const CREATE_COMPANIES = [
  { name: '500',               type: 'VC',      parent: null },
  { name: 'Luchadores III',    type: 'Fund',    parent: '500' },
  { name: 'Amador Ventures',   type: null,      parent: null },
  { name: 'FEN Ventures',      type: 'VC',      parent: null },
  { name: 'Endeavor',          type: 'Network', parent: null },
  { name: 'Endeavor Catalyst', type: 'Fund',    parent: 'Endeavor' },
]
// Existing companies to re-parent: [childName, parentName]
const REPARENT = [['500 Latam Seed IV', '500'], ['SEA 500', '500']]

// ── translation maps ─────────────────────────────────────────
const TYPE_MAP = { 'vc': 'VC', 'ffoo': 'Family Office', 'cvc': 'Corporate VC', 'network': 'Network', 'fund': 'Fund', 'company': 'Company' }
function mapType(raw) { if (!raw) return null; return TYPE_MAP[normName(splitComma(raw)[0])] ?? null }

const STATUS_MAP = { 'approved': 'Approved', 'contact': 'Active', 'funnel': 'Watch', 'meeting': 'Active', 'miss': 'Rejected', 'rejected': 'Rejected', 'stand-by': 'Watch' }
function mapStatus(raw) { if (!raw) return null; return STATUS_MAP[raw.toLowerCase()] ?? null }

const INDUSTRY_MAP = {
  'ai': 'AI', 'agnostic': 'Agnostic', 'b2b': 'Agnostic', 'climate tech': 'Climate Tech', 'data': 'Data',
  'e-commerce': 'E-Commerce', 'ecommerce': 'E-Commerce', 'fintech': 'Fintech', 'foodtech': 'Foodtech',
  'gaming': 'Gaming', 'healthtech': 'Healthtech', 'insurtech': 'Insurtech', 'life science': 'Life Science',
  'logistic': 'Logistic', 'logistics': 'Logistic', 'marketplace': 'Marketplace', 'mobility': 'Mobility',
  'pet tech': 'Pet Tech', 'proptech': 'Proptech', 'retail': 'Retailtech', 'retailtech': 'Retailtech',
  'saas': 'SaaS', 'secondaries': 'Secondaries', 'traveltech': 'Traveltech', 'wellness': 'Wellness',
}
const INDUSTRY_OVERRIDE = new Map([['selva viva', 'Retailtech'], ['vital-doc', 'Healthtech'], ['worthit vc', 'Agnostic']])
function mapIndustry(raw, companyNorm) {
  if (!raw) return null
  const key = normName(raw)
  if (key === 'negocio' && INDUSTRY_OVERRIDE.has(companyNorm)) return INDUSTRY_OVERRIDE.get(companyNorm)
  if (key === 'negocio' || key === 'others' || key === 'vc') return null
  return INDUSTRY_MAP[key] ?? null
}

const REGION_NAME_MAP = {
  'ee.uu.': 'United States', 'eeuu': 'United States', 'estados unidos': 'United States', 'usa': 'United States', 'us': 'United States',
  'latam': 'Latin America', 'latinoamerica': 'Latin America', 'latin america': 'Latin America',
  'brasil': 'Brazil', 'brazil': 'Brazil', 'chile': 'Chile', 'argentina': 'Argentina',
  'colombia': 'Colombia', 'mexico': 'Mexico', 'méxico': 'Mexico', 'peru': 'Peru', 'perú': 'Peru',
  'espana': 'Spain', 'españa': 'Spain', 'spain': 'Spain', 'world': 'Global', 'global': 'Global',
  'europa': 'Europe', 'europe': 'Europe', 'asia': 'Asia', 'africa': 'Africa', 'china': 'China', 'india': 'India',
  'canada': 'Canada', 'uk': 'United Kingdom', 'reino unido': 'United Kingdom', 'singapore': 'Singapore',
  'hong kong': 'Hong Kong', 'japan': 'Japan', 'south korea': 'South Korea', 'southeast asia': 'Southeast Asia',
  'middle east': 'Middle East', 'australia': 'Australia', 'new zealand': 'New Zealand', 'oceania': 'Australia', 'paraguay': 'Paraguay',
}
function mapRegionName(raw) { return REGION_NAME_MAP[normName(raw)] ?? null }

const STAGE_MAP = {
  'non deal roadshow': 'Non Deal Roadshow', 'vc fundraising': 'VC Fundraising', 'venturedebt': 'Venture Debt', 'venture debt': 'Venture Debt',
  'pre-seed': 'Pre-Seed', 'seed': 'Seed', 'series a': 'Series A', 'series b': 'Series B', 'series c': 'Series C',
  'series d+': 'Series D+', 'growth': 'Growth', 'pre-ipo': 'Pre-IPO', 'listed': 'Listed', 'mature': 'Mature', 'late stage': 'Late Stage',
}
function mapStage(raw) { if (!raw) return null; return STAGE_MAP[normName(splitComma(raw)[0])] ?? null }

const MEETING_TYPE_MAP = { 'meeting': 'Meeting', 'pitch': 'Pitch', 'network': 'Network', 'update': 'Update', 'legal': 'Legal' }
function mapMeetingType(raw) { if (!raw) return null; return MEETING_TYPE_MAP[raw.toLowerCase()] ?? null }

// ── DB helpers ───────────────────────────────────────────────
async function dbInsert(table, data) {
  const { data: row, error } = await supabase.from(table).insert(data).select('id').single()
  if (error) throw new Error(`Insert ${table}: ${error.message} | ${JSON.stringify(data).slice(0, 180)}`)
  return row.id
}
async function getOrCreateTag(table, map, name) {
  if (!name) return null
  if (map.has(name)) return map.get(name)
  const { data, error } = await supabase.from(table).insert({ name }).select('id').single()
  if (error) {
    const { data: ex } = await supabase.from(table).select('id').eq('name', name).single()
    if (ex) { map.set(name, ex.id); return ex.id }
    throw new Error(`tag ${table} ${name}: ${error.message}`)
  }
  map.set(name, data.id); return data.id
}
async function loadTagMap(table) {
  const { data, error } = await supabase.from(table).select('id, name')
  if (error) throw new Error(`loadTagMap ${table}: ${error.message}`)
  const m = new Map(); for (const r of data) m.set(r.name, r.id); return m
}

// ── meeting notes from .md files ─────────────────────────────
function extractNotes(content) {
  const lines = content.replace(/^﻿/, '').split('\n')
  const out = []; let metaDone = false
  for (const line of lines) {
    if (!metaDone) {
      const t = line.trim()
      if (t.startsWith('#') || t.startsWith('Attendees:') || t.startsWith('Event time:') || t.startsWith('Type:') || t === '') continue
      metaDone = true
    }
    out.push(line)
  }
  return out.join('\n').trim()
}
function buildMeetingNotesMap() {
  const notesMap = new Map()
  for (const file of readdirSync(join(BBDD, 'Meetings'))) {
    if (!file.endsWith('.md')) continue
    const base = file.replace(/\.md$/, '').replace(/\s+[0-9a-f]{32}$/, '').trim()
    const key = normName(base.replace(/<>/g, '').replace(/\s+/g, ' '))
    notesMap.set(key, extractNotes(readFileSync(join(BBDD, 'Meetings', file), 'utf8')))
  }
  return notesMap
}

// ── meeting → company key extraction (canonical applied AFTER date strip — bug fix) ─
function extractMeetingCompanyKey(rawTitle) {
  let title = rawTitle.trim()
  if (title.includes('<>')) title = title.split('<>')[0].trim()
  if (/^reunión /i.test(title)) title = title.replace(/^reunión /i, '').trim()
  title = title.replace(/[\s-]+\d{6,9}\s*$/, '').trim()     // " - 20240101" / " -20240101" / typo'd 9-digit
  title = title.replace(/\s*-\s*$/, '').trim()
  title = title.replace(/\s*-\s*[\u{1F1E0}-\u{1F1FF}\u{1F3F4}]+$/u, '').trim() // flag emoji
  if (/^update /i.test(title)) title = title.replace(/^update /i, '').trim()
  return normName(applyCanonical(title))   // ← re-apply canonical after stripping
}

// ════════════════════════════════════════════════════════════
async function main() {
  console.log('=== BBDD Import v2 ===\n')

  // guard against double-import
  const { count: existing } = await supabase.from('companies').select('id', { count: 'exact', head: true })
  if (existing && existing > 0 && !FORCE) {
    throw new Error(`companies table has ${existing} rows. Wipe first, or pass --force.`)
  }

  // admin user
  const { data: profiles } = await supabase.from('user_profiles').select('id, email').limit(10)
  let adminId = profiles?.find(p => p.email === 'stgo97@gmail.com')?.id ?? profiles?.[0]?.id
  if (!adminId) {
    const { data: au } = await supabase.auth.admin.listUsers()
    adminId = (au?.users?.find(u => u.email === 'stgo97@gmail.com') ?? au?.users?.[0])?.id
  }
  if (!adminId) throw new Error('No admin user found. Log into the app first.')
  const BY = { created_by: adminId, updated_by: adminId }
  console.log(`Admin: ${adminId}\n`)

  // tag maps
  const industries = await loadTagMap('tag_industries')
  const regions = await loadTagMap('tag_regions')
  const stages = await loadTagMap('tag_stages')
  const types = await loadTagMap('tag_types')
  const statuses = await loadTagMap('tag_statuses')
  const meetingTypes = await loadTagMap('tag_meeting_types')
  for (const r of ['Brazil', 'Chile', 'Argentina', 'Colombia', 'Mexico', 'Peru', 'Spain', 'Asia', 'Paraguay'])
    if (!regions.has(r)) await getOrCreateTag('tag_regions', regions, r)
  if (!stages.has('Late Stage')) await getOrCreateTag('tag_stages', stages, 'Late Stage')

  async function resolveIndustries(rawList, companyNorm) {
    const ids = []
    for (const raw of splitComma(rawList)) {
      const mapped = mapIndustry(raw, companyNorm); if (!mapped) continue
      const id = await getOrCreateTag('tag_industries', industries, mapped)
      if (id && !ids.includes(id)) ids.push(id)
    }
    return ids
  }
  async function resolveRegions(rawList) {
    const ids = []
    for (const raw of splitComma(rawList)) {
      const mapped = mapRegionName(raw); if (!mapped) continue
      const id = await getOrCreateTag('tag_regions', regions, mapped)
      if (id && !ids.includes(id)) ids.push(id)
    }
    return ids
  }
  async function resolveStages(rawList) {
    const ids = []
    for (const raw of splitComma(rawList)) {
      const mapped = STAGE_MAP[normName(raw)] ?? raw.trim()
      const id = await getOrCreateTag('tag_stages', stages, mapped)
      if (id && !ids.includes(id)) ids.push(id)
    }
    return ids
  }

  // parse CSVs
  const crmRows = parseCSV(readFileSync(join(BBDD, 'CRM 4323ea4bb2a94ff59bc9091b20650432.csv'), 'utf8'))
  const contactsRows = parseCSV(readFileSync(join(BBDD, 'Contacts f88a598ba9fb4c81be0cc0052aad32fe.csv'), 'utf8'))
  const meetingsRows = parseCSV(readFileSync(join(BBDD, 'Meetings dd43ebe1c83647aea8aa62b6d5ef1be0.csv'), 'utf8'))
  console.log(`CRM ${crmRows.length} · Contacts ${contactsRows.length} · Meetings ${meetingsRows.length}\n`)

  const companiesMap = new Map()           // normName → uuid
  const companyOwn = new Map()             // uuid → { industries:[], regions:[] } (own values)
  const contactAgg = new Map()             // uuid → { ind:Set, reg:Set, stg:Set } (from its contacts)
  const contactRecords = []                // { id, company_id, hasInd, hasReg }
  const companyPrimaryContact = new Map()  // company uuid → contact uuid

  function aggOf(cid) {
    if (!contactAgg.has(cid)) contactAgg.set(cid, { ind: new Set(), reg: new Set(), stg: new Set() })
    return contactAgg.get(cid)
  }

  // ── PHASE 1A — CRM companies ──────────────────────────────
  console.log('=== 1A CRM companies ===')
  let ph1a = 0
  for (const row of crmRows) {
    if (!row['Name']?.trim()) continue
    const name = applyCanonical(row['Name'].trim())
    const key = normName(name)
    if (companiesMap.has(key)) { console.log(`  [dup] ${name}`); continue }
    const compNorm = key
    const industryIds = []
    unionInto(industryIds, await resolveIndustries(row['Main Vertical'], compNorm))
    unionInto(industryIds, await resolveIndustries(row['Secondary Vertical'], compNorm))
    const regionIds = await resolveRegions(row['Country'])
    const id = await dbInsert('companies', {
      name,
      description: row['One Line'] || null,
      website: row['URL'] || null,
      round_size_musd: parseNum(row['Round / Fund Size (MUS$)']),
      valuation_musd: parseNum(row['Valuation (MUS$)']),
      legal: row['Legal'] || null,
      deal_date: parseDateISO(row['Date']),
      files: fileList(row['Files & Media']),
      type_id: types.get(mapType(row['Type']) ?? '') ?? null,
      status_id: statuses.get(mapStatus(row['Status']) ?? '') ?? null,
      stage_ids: await resolveStages(row['Stage'] ?? ''),
      industry_ids: industryIds,
      region_ids: regionIds,
      source: row['Funnel'] === 'Direct' ? 'Direct' : row['Funnel'] === 'Fund' ? 'Fund' : null,
      ...BY,
    })
    companiesMap.set(key, id)
    companyOwn.set(id, { industries: [...industryIds], regions: [...regionIds] })
    ph1a++
  }
  console.log(`  → ${ph1a}\n`)

  // ── PHASE 1B — Contacts companies (not in CRM) ────────────
  console.log('=== 1B Contacts companies ===')
  let ph1b = 0
  for (const row of contactsRows) {
    if (!row['Name']?.trim()) continue
    const name = applyCanonical(row['Name'].trim())
    const key = normName(name)
    if (companiesMap.has(key)) continue
    const industryIds = await resolveIndustries(row['Industry'], key)
    const regionIds = await resolveRegions(row['Geography'])
    const id = await dbInsert('companies', {
      name,
      description: null,
      website: row['URL'] || null,
      type_id: types.get(mapType(row['Type']) ?? '') ?? null,
      industry_ids: industryIds,
      region_ids: regionIds,
      ...BY,
    })
    companiesMap.set(key, id)
    companyOwn.set(id, { industries: [...industryIds], regions: [...regionIds] })
    ph1b++
  }
  console.log(`  → ${ph1b}\n`)

  // ── PHASE 1C — explicit creates (managers/funds) ──────────
  console.log('=== 1C explicit company creates ===')
  let ph1c = 0
  for (const pass of [0, 1]) {              // pass 0 = parents, pass 1 = children
    for (const c of CREATE_COMPANIES) {
      if ((pass === 0) !== (c.parent === null)) continue
      const key = normName(c.name)
      if (companiesMap.has(key)) { console.log(`  [exists] ${c.name}`); continue }
      const parentId = c.parent ? companiesMap.get(normName(c.parent)) ?? null : null
      const id = await dbInsert('companies', {
        name: c.name,
        type_id: c.type ? types.get(c.type) ?? null : null,
        parent_company_id: parentId,
        ...BY,
      })
      companiesMap.set(key, id)
      companyOwn.set(id, { industries: [], regions: [] })
      ph1c++
      console.log(`  [+] ${c.name}${c.parent ? ` (child of ${c.parent})` : ''}`)
    }
  }
  // re-parent existing companies
  for (const [child, parent] of REPARENT) {
    const cid = companiesMap.get(normName(applyCanonical(child)))
    const pid = companiesMap.get(normName(parent))
    if (cid && pid) {
      await supabase.from('companies').update({ parent_company_id: pid }).eq('id', cid)
      console.log(`  [re-parent] ${child} → ${parent}`)
    } else console.warn(`  [WARN] re-parent failed: ${child} → ${parent}`)
  }
  console.log(`  → ${ph1c} created\n`)

  // ── PHASE 2A — Contacts people ────────────────────────────
  console.log('=== 2A contacts ===')
  const contactsByName = new Map()          // normName → uuid (dedup for 2B)
  let ph2a = 0
  for (const row of contactsRows) {
    const person = row['Contact']?.trim()
    if (!person) continue
    const firmKey = normName(applyCanonical(row['Name']?.trim() ?? ''))
    const companyId = companiesMap.get(firmKey) ?? null
    const roleRaw = row['Position']?.trim()
    const role = ['bicycle brazil', 'head bicycle brazil'].includes(normName(roleRaw ?? '')) ? null : (roleRaw || null)
    const industryIds = await resolveIndustries(row['Industry'], firmKey)
    const regionIds = await resolveRegions(row['Geography'])
    const stageIds = await resolveStages(row['Stage'])
    const id = await dbInsert('contacts', {
      name: person,
      role,
      email: row['Email'] || null,
      phone: row['Phone'] || null,
      linkedin: row['LinkedIn'] || null,
      location: row['Country'] || null,
      company_id: companyId,
      industry_ids: industryIds,
      region_ids: regionIds,
      stage_ids: stageIds,
      investment_focus: splitComma(row['Investment Focus']),
      ...BY,
    })
    contactsByName.set(normName(person), id)
    contactRecords.push({ id, company_id: companyId, hasInd: industryIds.length > 0, hasReg: regionIds.length > 0 })
    if (companyId) {
      const a = aggOf(companyId)
      for (const x of industryIds) a.ind.add(x)
      for (const x of regionIds) a.reg.add(x)
      for (const x of stageIds) a.stg.add(x)
      if (!companyPrimaryContact.has(companyId)) companyPrimaryContact.set(companyId, id)
    }
    ph2a++
  }
  console.log(`  → ${ph2a}\n`)

  // ── PHASE 2B — CRM stub contacts ──────────────────────────
  console.log('=== 2B CRM stub contacts ===')
  let ph2b = 0
  for (const row of crmRows) {
    if (!row['Name']?.trim()) continue
    const companyId = companiesMap.get(normName(applyCanonical(row['Name'].trim()))) ?? null
    const rawContact = row['Contact']?.trim()
    if (!rawContact) continue
    const names = splitComma(rawContact)
    const emails = splitComma(row['Email'])
    const phones = splitComma(row['Phone'])
    const rawPos = row['Position']?.trim() || null
    for (let i = 0; i < names.length; i++) {
      const person = names[i]
      const pkey = normName(person)
      if (contactsByName.has(pkey)) continue
      const isFirst = i === 0
      const id = await dbInsert('contacts', {
        name: person,
        role: isFirst ? rawPos : null,
        email: isFirst ? (emails[i] ?? null) : null,
        phone: isFirst ? (phones[i] ?? null) : null,
        company_id: companyId,
        ...BY,
      })
      contactsByName.set(pkey, id)
      contactRecords.push({ id, company_id: companyId, hasInd: false, hasReg: false })
      if (companyId && !companyPrimaryContact.has(companyId)) companyPrimaryContact.set(companyId, id)
      ph2b++
    }
  }
  console.log(`  → ${ph2b}\n`)

  // ── PHASE 1D — new fund companies + contacts (mined from meeting notes) ─
  console.log('=== 1D new fund companies ===')
  let ph1d = 0, ph1dc = 0
  for (const f of NEW_FUNDS) {
    const key = normName(f.name)
    if (companiesMap.has(key)) { console.log(`  [exists] ${f.name}`); continue }
    const industryIds = await resolveIndustries(f.industries ?? '', key)
    const regionIds = await resolveRegions(f.regions ?? '')
    const stageIds = await resolveStages(f.stages ?? '')
    const id = await dbInsert('companies', {
      name: f.name,
      website: f.website || null,
      type_id: f.type ? types.get(f.type) ?? null : null,
      industry_ids: industryIds,
      region_ids: regionIds,
      investment_stage_ids: stageIds,
      ...BY,
    })
    companiesMap.set(key, id)
    companyOwn.set(id, { industries: [...industryIds], regions: [...regionIds] })
    ph1d++
    for (const c of (f.contacts ?? [])) {
      const ck = normName(c.name)
      if (contactsByName.has(ck)) continue
      const cid = await dbInsert('contacts', {
        name: c.name, role: c.role ?? null, company_id: id,
        industry_ids: industryIds, region_ids: regionIds, stage_ids: stageIds,
        ...BY,
      })
      contactsByName.set(ck, cid)
      contactRecords.push({ id: cid, company_id: id, hasInd: industryIds.length > 0, hasReg: regionIds.length > 0 })
      const a = aggOf(id); for (const x of stageIds) a.stg.add(x)
      if (!companyPrimaryContact.has(id)) companyPrimaryContact.set(id, cid)
      ph1dc++
    }
    console.log(`  [+] ${f.name}${f.contacts ? ` (${f.contacts.length} contacts)` : ''}`)
  }
  console.log(`  → ${ph1d} funds, ${ph1dc} contacts\n`)

  // ── meeting company resolution (uses canonical + business links) ─
  function resolveMeetingCompanyId(title) {
    let key = extractMeetingCompanyKey(title)
    if (MEETING_LINK[key]) key = normName(MEETING_LINK[key])
    return companiesMap.get(key) ?? null
  }

  // ── PHASE 3 — meetings (never creates companies) ──────────
  console.log('=== 3 meetings ===')
  const meetingNotes = buildMeetingNotesMap()
  const meetingRecords = []                 // { id, rawTitle, companyId }
  let ph3 = 0, nullCompany = 0
  for (const row of meetingsRows) {
    const title = row['Name']?.trim()
    if (!title) continue
    const companyId = resolveMeetingCompanyId(title)
    if (!companyId) nullCompany++
    const noteKey = normName(title.replace(/<>/g, '').replace(/\s+/g, ' '))
    const id = await dbInsert('meetings', {
      title,
      date: parseDateISO(row['Event time']),       // nullable now
      company_id: companyId,
      type_id: meetingTypes.get(mapMeetingType(row['Type']) ?? '') ?? null,
      notes: meetingNotes.get(noteKey) || null,
      ...BY,
    })
    meetingRecords.push({ id, rawTitle: title, companyId })
    ph3++
  }
  console.log(`  → ${ph3} (${ph3 - nullCompany} linked, ${nullCompany} null company)\n`)

  // ── PHASE 4 — participants ────────────────────────────────
  console.log('=== 4 participants ===')
  let ph4 = 0
  for (const m of meetingRecords) {
    const ids = new Set()
    if (m.companyId && companyPrimaryContact.has(m.companyId)) ids.add(companyPrimaryContact.get(m.companyId))
    if (m.rawTitle.includes('<>')) {
      const parts = m.rawTitle.split('<>')
      if (parts[1]) {
        const secKey = extractMeetingCompanyKey(parts[1].trim())
        const secCompany = companiesMap.get(MEETING_LINK[secKey] ? normName(MEETING_LINK[secKey]) : secKey)
        if (secCompany && companyPrimaryContact.has(secCompany)) ids.add(companyPrimaryContact.get(secCompany))
      }
    }
    for (const cid of ids) {
      try { await dbInsert('meeting_participants', { meeting_id: m.id, contact_id: cid }); ph4++ }
      catch (e) { if (!/duplicate|unique/.test(e.message)) console.warn(`  [WARN] ${e.message}`) }
    }
  }
  console.log(`  → ${ph4}\n`)

  // ── PHASE 5 — interaction logs ────────────────────────────
  console.log('=== 5 interaction logs ===')
  let ph5 = 0
  for (const m of meetingRecords) {
    if (!m.companyId) continue
    const contactId = companyPrimaryContact.get(m.companyId)
    if (!contactId) continue
    const noteKey = normName(m.rawTitle.replace(/<>/g, '').replace(/\s+/g, ' '))
    const notes = meetingNotes.get(noteKey)
    if (!notes) continue
    try {
      await dbInsert('interaction_logs', { contact_id: contactId, meeting_id: m.id, note: notes, follow_up: false, created_by: adminId })
      ph5++
    } catch (e) { console.warn(`  [WARN] ${e.message.slice(0, 80)}`) }
  }
  console.log(`  → ${ph5}\n`)

  // ── PHASE 6 — enrichment (roll fund tags up; push company tags down to stubs) ─
  console.log('=== 6 enrichment ===')
  const companyFinal = new Map()
  let rolledUp = 0
  for (const [cid, own] of companyOwn) {
    const agg = contactAgg.get(cid)
    const industries = [...own.industries]; const regionsF = [...own.regions]
    const invStages = []
    if (agg) { unionInto(industries, [...agg.ind]); unionInto(regionsF, [...agg.reg]); unionInto(invStages, [...agg.stg]) }
    companyFinal.set(cid, { industries, regions: regionsF })
    const changedInd = industries.length !== own.industries.length
    const changedReg = regionsF.length !== own.regions.length
    if (changedInd || changedReg || invStages.length) {
      await supabase.from('companies').update({
        industry_ids: industries, region_ids: regionsF, investment_stage_ids: invStages,
      }).eq('id', cid)
      rolledUp++
    }
  }
  let pushedDown = 0
  for (const c of contactRecords) {
    if (!c.company_id || (c.hasInd && c.hasReg)) continue
    const f = companyFinal.get(c.company_id); if (!f) continue
    const patch = {}
    if (!c.hasInd && f.industries.length) patch.industry_ids = f.industries
    if (!c.hasReg && f.regions.length) patch.region_ids = f.regions
    if (Object.keys(patch).length) { await supabase.from('contacts').update(patch).eq('id', c.id); pushedDown++ }
  }
  console.log(`  → ${rolledUp} companies enriched, ${pushedDown} stub contacts inherited tags\n`)

  // ── SUMMARY ───────────────────────────────────────────────
  console.log('=== Summary ===')
  console.log(`  companies : ${companiesMap.size}  (1A ${ph1a} + 1B ${ph1b} + 1C ${ph1c} + 1D ${ph1d})`)
  console.log(`  contacts  : ${ph2a + ph2b + ph1dc}  (2A ${ph2a} + 2B ${ph2b} + 1D ${ph1dc})`)
  console.log(`  meetings  : ${ph3}  (${ph3 - nullCompany} linked, ${nullCompany} null)`)
  console.log(`  participants : ${ph4}`)
  console.log(`  interaction logs : ${ph5}`)
  console.log('\nDone.')
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1) })
