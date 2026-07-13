#!/usr/bin/env node
// Network Intelligence — bulk intro loader (Phase 5)
//
// Loads intros from a CSV export into the CRM by calling the SAME MCP tools the
// Skill uses (network_search_companies / staging_ingest / network_create_intro)
// over a real MCP session — not by writing to Supabase directly — so dedup and
// staging behavior is identical whether a human runs the Skill interactively or
// this script runs a file. This also exercises the Phase 3 auth/scope/allowlist
// path for real, which is the point: it's the first true end-to-end test.
//
// Usage:
//   node scripts/load_intros.mjs path/to/intros.csv           # dry-run: report only
//   node scripts/load_intros.mjs path/to/intros.csv --commit  # actually insert/stage
//
// Requires in .env.local:
//   NETWORK_LOADER_TOKEN=ggc_...   A PAT for an allowlisted user (see
//                                  src/lib/network/allowlist.ts / NETWORK_ALLOWLIST)
//                                  with network:read, network:write, staging:write.
//   NETWORK_MCP_URL=...            Defaults to http://localhost:3000/api/mcp
//   GG_INTERNAL_DOMAINS=ggcapital.com,gg.vc   (optional) email domains treated as
//                                  GG's own, used to derive intro direction when a
//                                  party/facilitator doesn't resolve to a company
//                                  with is_internal=true (that flag isn't populated
//                                  yet — see project memory). Comma-separated.
//
// CSV ONLY, not .xlsx: this repo's other bulk-import script (import_bbdd.mjs) is
// also CSV-only, and there's no XML/zip-parsing library installed here. Rather
// than hand-roll an untested .xlsx reader against real financial-relationship
// data with no genuine Excel file to validate it against, export your sheet as
// CSV (File → Save As → CSV UTF-8) and point this script at that. If native
// .xlsx support becomes worth it, add the `xlsx` npm package rather than
// hand-rolling parsing — safer for real-world Excel quirks.
//
// Flow per row (mirrors src/lib/network/{resolve,roles}.ts and SKILL.md):
//   1. parties come from side1/side2 columns (comma-separated) if present,
//      else parsed from the subject line (A <> B, multi-company sides via / , & "and").
//   2. each party name -> network_search_companies (4-tier resolve).
//      matched -> collect company_id.  unmatched -> staging_ingest(new_company),
//      idempotent per company name so re-running the file never double-stages.
//   3. facilitator resolved the same way, leniently (never blocks the intro).
//   4. direction: explicit `direction` column wins; else derived from
//      internal/external of facilitator + parties (is_internal DB flag if the
//      party resolved to a company, else GG_INTERNAL_DOMAINS email-domain guess).
//   5. all parties resolved -> network_create_intro(source='bulk_excel',
//      source_ref=<row's source_ref>) (idempotent — re-running is a no-op).
//      else -> hold the row; report which companies must clear /triage first.
//   6. print a summary: linked / newly staged / already staged / created /
//      already-linked / held / warnings / errors.

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── CLI args ─────────────────────────────────────────────────
const argv = process.argv.slice(2)
const COMMIT = argv.includes('--commit')
const filePath = argv.find((a) => !a.startsWith('--'))

if (!filePath || argv.includes('--help') || argv.includes('-h')) {
  console.log(
    'Usage:\n' +
    '  node scripts/load_intros.mjs path/to/intros.csv           # dry-run: report only\n' +
    '  node scripts/load_intros.mjs path/to/intros.csv --commit  # actually insert/stage\n\n' +
    'See scripts/templates/intros-template.csv for the expected columns.'
  )
  process.exit(filePath ? 0 : 1)
}
if (/\.xlsx?$/i.test(filePath)) {
  console.error(
    `This loader reads CSV only (got "${filePath}"). Export your sheet as CSV ` +
    '(File → Save As → CSV UTF-8) and point this script at that file instead.'
  )
  process.exit(1)
}

// ── ENV (mirrors scripts/import_bbdd.mjs's loadEnv) ────────────
function loadEnv() {
  let raw
  try {
    raw = readFileSync(join(ROOT, '.env.local'), 'utf8')
  } catch {
    return // fine — env may already be set in the shell/CI
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^=]+)=(.*)$/)
    if (m && !(m[1].trim() in process.env)) process.env[m[1].trim()] = m[2].trim()
  }
}
loadEnv()

const MCP_URL = process.env.NETWORK_MCP_URL || 'http://localhost:3000/api/mcp'
const TOKEN = process.env.NETWORK_LOADER_TOKEN
if (!TOKEN) {
  console.error(
    'Missing NETWORK_LOADER_TOKEN in .env.local — mint a PAT with network:read, ' +
    'network:write, staging:write from Settings → Tokens (requires an allowlisted user).'
  )
  process.exit(1)
}
const GG_INTERNAL_DOMAINS = (process.env.GG_INTERNAL_DOMAINS || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

// ── CSV parser (verbatim from scripts/import_bbdd.mjs, for consistency) ────────
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
  const lines = raw.replace(/^﻿/, '').split(/\r?\n/)
  const headers = parseCSVLine(lines[0]).map((h) => h.trim())
  const out = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const v = parseCSVLine(lines[i])
    const r = {}; headers.forEach((h, idx) => (r[h] = (v[idx] ?? '').trim()))
    out.push({ row: r, line: i + 1 })
  }
  return { headers, rows: out }
}

const EXPECTED_COLUMNS = ['subject', 'date', 'facilitator', 'side1', 'side2', 'direction', 'source_ref', 'notes']
const REQUIRED_COLUMNS = ['subject', 'source_ref']
function validateHeaders(headers) {
  const unknown = headers.filter((h) => !EXPECTED_COLUMNS.includes(h))
  if (unknown.length) {
    throw new Error(`Unknown column(s): ${unknown.join(', ')}. Expected one of: ${EXPECTED_COLUMNS.join(', ')}`)
  }
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c))
  if (missing.length) throw new Error(`Missing required column(s): ${missing.join(', ')}`)
}

// ── pure helpers mirrored from src/lib/network/resolve.ts ──────────────────────
// Plain Node scripts here don't run through the TS/Next toolchain (see
// import_bbdd.mjs, which duplicates normName/splitComma the same way), so these
// are kept in sync by hand. Keep behavior identical to resolve.ts.
function normName(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim()
}
/** side1/side2 COLUMN values: comma-separated multiples only (columns.md). */
function splitColumnCompanies(s) {
  return !s ? [] : s.split(',').map((v) => v.trim()).filter(Boolean)
}
/** Subject-line SIDE text: richer delimiters, mirrors resolve.ts's splitSideCompanies. */
function splitSubjectSideCompanies(side) {
  return (side || '').split(/\s*(?:\/|,|&|\band\b)\s*/i).map((s) => s.trim()).filter(Boolean)
}
/** Mirrors resolve.ts's parseSubject. */
function parseSubjectSides(subject) {
  const s = (subject || '').trim()
  if (!s) return null
  const parts = s.split(/\s*<->\s*|\s*<>\s*|\s*↔\s*/)
  if (parts.length < 2) return null
  const [left, ...rest] = parts
  return { side1: splitSubjectSideCompanies(left), side2: splitSubjectSideCompanies(rest.join(' ')) }
}
function emailDomain(raw) {
  const at = (raw || '').indexOf('@')
  if (at < 0) return null
  return raw.slice(at + 1).trim().toLowerCase() || null
}
const DIRECTIONS = new Set(['outbound', 'outbound_internal', 'inbound', 'other'])

// ── MCP client ───────────────────────────────────────────────────────────────
async function connectMcp() {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
  })
  const client = new Client({ name: 'load-intros-script', version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)
  return client
}

async function callTool(client, name, args) {
  const res = await client.callTool({ name, arguments: args })
  const text = res.content?.find((c) => c.type === 'text')?.text ?? ''
  if (res.isError) throw new Error(`${name}: ${text || 'unknown tool error'}`)
  try { return JSON.parse(text) } catch { return text }
}

// ── per-run caches (dedupe repeated company names across rows) ─────────────────
const companyCache = new Map() // normName(name) -> { status, company_id?, name, internal? }

async function resolveOrStage(client, name, stats) {
  const key = normName(name)
  if (!key) return null
  if (companyCache.has(key)) return companyCache.get(key)

  const matches = await callTool(client, 'network_search_companies', { query: name })
  if (Array.isArray(matches) && matches.length > 0) {
    const m = matches[0]
    let internal = false
    try {
      const company = await callTool(client, 'crm_get_company', { id: m.company_id })
      internal = !!company?.is_internal
    } catch {
      // crm:read missing or lookup failed — direction derivation degrades, not fatal.
    }
    const result = { status: 'resolved', company_id: m.company_id, name: m.name, match: m.match, internal }
    companyCache.set(key, result)
    stats.partiesLinked++
    return result
  }

  // No confident match — genuinely new (or too ambiguous). Stage it, never create
  // it directly. source_ref is derived from the normalized name (not the row), so
  // the same company staged from different rows/files is staged exactly once.
  const sourceRef = `bulk_intros:company:${key}`
  let staged = { deduped: false }
  if (COMMIT) {
    staged = await callTool(client, 'staging_ingest', {
      source: 'import', // staging_events.source enum — distinct from intros.source ('bulk_excel')
      source_ref: sourceRef,
      raw_payload: { name },
      extracted: { name },
      proposed_links: { company: { name } },
      event_class: 'new_company',
      confidence: 0.4,
    })
  }
  const result = { status: 'staged', name, internal: false, deduped: !!staged.deduped }
  companyCache.set(key, result)
  if (staged.deduped) stats.companiesAlreadyStaged++
  else stats.companiesNewlyStaged++
  return result
}

function deriveDirection(row, facilitatorInternal, anyPartyInternal, warnings, lineNo) {
  const explicit = (row.direction || '').trim().toLowerCase()
  if (explicit) {
    if (DIRECTIONS.has(explicit)) return explicit
    warnings.push(`line ${lineNo}: unknown direction "${row.direction}" — deriving instead`)
  }
  if (!GG_INTERNAL_DOMAINS.length && !facilitatorInternal && !anyPartyInternal) {
    warnings.push(`line ${lineNo}: no company is_internal=true and GG_INTERNAL_DOMAINS is unset — direction defaulted to "other", please verify`)
    return 'other'
  }
  if (facilitatorInternal && !anyPartyInternal) return 'outbound'
  if (facilitatorInternal && anyPartyInternal) return 'outbound_internal'
  if (!facilitatorInternal && anyPartyInternal) return 'inbound'
  return 'other'
}

// ── per-row processing ───────────────────────────────────────────────────────
async function processRow(client, row, lineNo, stats) {
  const subject = (row.subject || '').trim()
  const sourceRef = (row.source_ref || '').trim()
  if (!subject) { stats.skipped.push({ line: lineNo, reason: 'missing subject' }); return }
  if (!sourceRef) { stats.skipped.push({ line: lineNo, reason: 'missing source_ref' }); return }

  let side1Names = splitColumnCompanies(row.side1)
  let side2Names = splitColumnCompanies(row.side2)
  if (side1Names.length === 0 && side2Names.length === 0) {
    const parsed = parseSubjectSides(subject)
    if (parsed) { side1Names = parsed.side1; side2Names = parsed.side2 }
  }
  if (side1Names.length === 0 || side2Names.length === 0) {
    stats.skipped.push({ line: lineNo, reason: `could not determine both sides from side1/side2/subject: "${subject}"` })
    return
  }

  const parties = []
  const unresolvedNames = []
  let anyPartyInternal = false
  for (const [side, names] of [[1, side1Names], [2, side2Names]]) {
    for (const name of names) {
      const r = await resolveOrStage(client, name, stats)
      if (r?.status === 'resolved') {
        parties.push({ name: r.name, side, company_id: r.company_id })
        if (r.internal) anyPartyInternal = true
      } else {
        unresolvedNames.push(name)
      }
    }
  }

  // Facilitator: resolved leniently (read-only lookup, never staged, never blocks).
  const facilitatorRaw = (row.facilitator || '').trim()
  let facilitatorInternal = false
  let facilitatorArg
  if (facilitatorRaw) {
    facilitatorArg = { name: facilitatorRaw }
    const email = facilitatorRaw.includes('@') ? facilitatorRaw : null
    if (email) facilitatorArg.email = email
    try {
      const matches = await callTool(client, 'network_search_companies', { query: facilitatorRaw, email })
      if (Array.isArray(matches) && matches.length > 0) {
        facilitatorArg.company_id = matches[0].company_id
        try {
          const company = await callTool(client, 'crm_get_company', { id: matches[0].company_id })
          facilitatorInternal = !!company?.is_internal
        } catch { /* degrade to email-domain guess below */ }
      }
    } catch { /* leave facilitator unresolved — the tool accepts a bare name/email */ }
    if (!facilitatorInternal) {
      const domain = emailDomain(facilitatorRaw)
      facilitatorInternal = !!domain && GG_INTERNAL_DOMAINS.includes(domain)
    }
  }

  const direction = deriveDirection(row, facilitatorInternal, anyPartyInternal, stats.warnings, lineNo)

  if (unresolvedNames.length > 0) {
    stats.held.push({ line: lineNo, source_ref: sourceRef, subject, unresolved: unresolvedNames })
    return
  }

  if (COMMIT) {
    const result = await callTool(client, 'network_create_intro', {
      direction,
      occurred_on: row.date || undefined,
      subject,
      parties,
      facilitator: facilitatorArg,
      source: 'bulk_excel',
      source_ref: sourceRef,
      notes: row.notes || undefined,
    })
    if (result.deduped) stats.introsAlreadyLinked++
    else stats.introsCreated++
  } else {
    stats.wouldCreate.push({ line: lineNo, source_ref: sourceRef, subject, direction, parties: parties.map((p) => p.name) })
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const raw = readFileSync(filePath, 'utf8')
  const { headers, rows } = parseCSV(raw)
  validateHeaders(headers)

  console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — ${filePath} (${rows.length} rows) via ${MCP_URL}`)
  if (!GG_INTERNAL_DOMAINS.length) {
    console.log('Note: GG_INTERNAL_DOMAINS is not set — direction can only be derived from a party\'s is_internal flag (not populated yet), so most rows will default to "other" unless the `direction` column is filled in.')
  }

  const client = await connectMcp()

  const stats = {
    partiesLinked: 0, companiesNewlyStaged: 0, companiesAlreadyStaged: 0,
    introsCreated: 0, introsAlreadyLinked: 0,
    wouldCreate: [], held: [], skipped: [], warnings: [], errors: [],
  }

  try {
    for (const { row, line } of rows) {
      try {
        await processRow(client, row, line, stats)
      } catch (e) {
        stats.errors.push({ line, message: e instanceof Error ? e.message : String(e) })
      }
      if (line % 25 === 0) console.log(`  … processed ${line} rows`)
    }
  } finally {
    await client.close()
  }

  // ── summary ──────────────────────────────────────────────────────────────
  console.log('\n── Summary ──')
  console.log(`Parties resolved to an existing company: ${stats.partiesLinked}`)
  console.log(`Companies newly staged to /triage:       ${stats.companiesNewlyStaged}`)
  console.log(`Companies already staged (deduped):      ${stats.companiesAlreadyStaged}`)
  if (COMMIT) {
    console.log(`Intros created:                          ${stats.introsCreated}`)
    console.log(`Intros already existing (deduped):       ${stats.introsAlreadyLinked}`)
  } else {
    console.log(`Intros that WOULD be created:            ${stats.wouldCreate.length}`)
  }
  console.log(`Intros held (blocked on staged companies): ${stats.held.length}`)
  console.log(`Rows skipped (bad data):                 ${stats.skipped.length}`)
  console.log(`Errors:                                  ${stats.errors.length}`)

  if (stats.held.length) {
    console.log('\nHeld — clear these in /triage, then re-run this file:')
    for (const h of stats.held) console.log(`  line ${h.line} [${h.source_ref}] "${h.subject}" — waiting on: ${h.unresolved.join(', ')}`)
  }
  if (!COMMIT && stats.wouldCreate.length) {
    console.log('\nWould create (dry run — re-run with --commit once this looks right):')
    for (const w of stats.wouldCreate) console.log(`  line ${w.line} [${w.source_ref}] "${w.subject}" — ${w.direction} — ${w.parties.join(' <> ')}`)
  }
  if (stats.warnings.length) {
    console.log('\nWarnings:')
    for (const w of stats.warnings) console.log(`  ${w}`)
  }
  if (stats.skipped.length) {
    console.log('\nSkipped:')
    for (const s of stats.skipped) console.log(`  line ${s.line}: ${s.reason}`)
  }
  if (stats.errors.length) {
    console.log('\nErrors:')
    for (const e of stats.errors) console.log(`  line ${e.line}: ${e.message}`)
  }

  if (!COMMIT) {
    console.log('\nThis was a dry run — nothing was written. Re-run with --commit once the output above looks right.')
  }
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
