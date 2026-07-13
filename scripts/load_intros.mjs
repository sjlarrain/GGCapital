#!/usr/bin/env node
// Network Intelligence — bulk intro loader
//
// Loads intros from a CSV export into the graph by calling the SAME MCP tool the
// Skill uses (network_create_intro) over a real MCP session — not by writing to
// Supabase directly — so behavior is identical whether a human runs the Skill
// interactively or this script runs a file.
//
// The graph is a NODE graph, not a companies subset: network_create_intro turns
// every party into a node. Names that resolve to a CRM company link to it; names
// that don't become name-only nodes (deduped across intros). The tool NEVER
// rejects and NEVER creates a CRM company — so there is no staging step and no
// "held" rows here anymore. Promote the name-only nodes that matter to real
// companies later (in the app, or via network_promote_entity).
//
// Usage:
//   node scripts/load_intros.mjs path/to/intros.csv           # dry-run: report only
//   node scripts/load_intros.mjs path/to/intros.csv --commit  # actually insert
//
// Requires in .env.local:
//   NETWORK_LOADER_TOKEN=ggc_...   A PAT for an allowlisted user (see
//                                  src/lib/network/allowlist.ts / NETWORK_ALLOWLIST)
//                                  with network:read + network:write.
//   NETWORK_MCP_URL=...            Defaults to http://localhost:3000/api/mcp;
//                                  point it at the deployed app to load prod.
//
// CSV columns (normalize your export to these — see scripts/templates/intros-template.csv):
//   subject (required), source_ref (required), date, facilitator, side1, side2, direction, notes
//   - side1/side2: company name(s) per side; comma-separate multiples. If both are
//     blank the subject line ("A <> B") is parsed for the two sides.
//   - source_ref: stable unique key per intro (idempotency — re-running never duplicates).

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
    '  node scripts/load_intros.mjs path/to/intros.csv --commit  # actually insert\n\n' +
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
    'Missing NETWORK_LOADER_TOKEN in .env.local — mint a PAT with network:read + ' +
    'network:write from Settings → Tokens (requires an allowlisted user).'
  )
  process.exit(1)
}

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

// ── party parsing (mirrors src/lib/network/resolve.ts) ─────────────────────────
/** side1/side2 COLUMN values: comma-separated multiples only (columns.md). */
function splitColumnCompanies(s) {
  return !s ? [] : s.split(',').map((v) => v.trim()).filter(Boolean)
}
/** Subject-line SIDE text: richer delimiters, mirrors resolve.ts's splitSideCompanies. */
function splitSubjectSideCompanies(side) {
  return (side || '').split(/\s*(?:\/|&|\band\b)\s*/i).map((s) => s.trim()).filter(Boolean)
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

const DIRECTIONS = new Set(['outbound', 'outbound_internal', 'inbound', 'other'])

// ── MCP client ───────────────────────────────────────────────────────────────
async function connectMcp() {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
  })
  const client = new Client({ name: 'load-intros-script', version: '2.0.0' }, { capabilities: {} })
  await client.connect(transport)
  return client
}

async function callTool(client, name, args) {
  const res = await client.callTool({ name, arguments: args })
  const text = res.content?.find((c) => c.type === 'text')?.text ?? ''
  if (res.isError) throw new Error(`${name}: ${text || 'unknown tool error'}`)
  try { return JSON.parse(text) } catch { return text }
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
  for (const name of side1Names) parties.push({ name, side: 1 })
  for (const name of side2Names) parties.push({ name, side: 2 })

  // Direction: explicit column wins; otherwise default to 'other' (we no longer
  // derive from is_internal — the node model doesn't need it, and this file's
  // rows all carry an explicit direction).
  let direction = (row.direction || '').trim().toLowerCase()
  if (direction && !DIRECTIONS.has(direction)) {
    stats.warnings.push(`line ${lineNo}: unknown direction "${row.direction}" — defaulting to "other"`)
    direction = ''
  }
  if (!direction) direction = 'other'

  const facilitatorRaw = (row.facilitator || '').trim()
  const facilitator = facilitatorRaw
    ? (facilitatorRaw.includes('@') ? { name: facilitatorRaw, email: facilitatorRaw } : { name: facilitatorRaw })
    : undefined

  if (!COMMIT) {
    stats.wouldCreate.push({ line: lineNo, source_ref: sourceRef, subject, direction, parties: parties.map((p) => p.name) })
    return
  }

  const result = await callTool(client, 'network_create_intro', {
    direction,
    occurred_on: row.date || undefined,
    subject,
    parties,
    facilitator,
    source: 'bulk_excel',
    source_ref: sourceRef,
    notes: row.notes || undefined,
  })
  if (result.deduped) stats.introsAlreadyLinked++
  else { stats.introsCreated++; stats.nameOnlyParties += result.name_only_parties ?? 0 }
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const raw = readFileSync(filePath, 'utf8')
  const { headers, rows } = parseCSV(raw)
  validateHeaders(headers)

  console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — ${filePath} (${rows.length} rows) via ${MCP_URL}`)

  const client = await connectMcp()

  const stats = {
    introsCreated: 0, introsAlreadyLinked: 0, nameOnlyParties: 0,
    wouldCreate: [], skipped: [], warnings: [], errors: [],
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
  if (COMMIT) {
    console.log(`Intros created:                    ${stats.introsCreated}`)
    console.log(`Intros already existing (deduped): ${stats.introsAlreadyLinked}`)
    console.log(`Name-only party links (nodes not a CRM company): ${stats.nameOnlyParties}`)
  } else {
    console.log(`Intros that WOULD be created:      ${stats.wouldCreate.length}`)
  }
  console.log(`Rows skipped (bad data):           ${stats.skipped.length}`)
  console.log(`Errors:                            ${stats.errors.length}`)

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
