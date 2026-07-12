#!/usr/bin/env node
/**
 * Bundle network-intelligence-skill/ into public/network-intelligence-skill.zip
 * for download from the app.
 *
 * Dependency-free: writes a STORE (uncompressed) ZIP so it runs the same on
 * Windows and Linux/Vercel with no `zip` binary or npm package. Mirrors
 * build_skill.mjs exactly. Run manually after editing the Skill:
 *   node scripts/build_network_skill.mjs
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs'
import { join, relative, sep } from 'path'
import { fileURLToPath } from 'url'

const root = join(fileURLToPath(import.meta.url), '..', '..')
const srcDir = join(root, 'network-intelligence-skill')
const outFile = join(root, 'public', 'network-intelligence-skill.zip')

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ── collect files (recursive) ─────────────────────────────────────────────────
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const files = walk(srcDir).map((full) => ({
  // Store with a top-level network-intelligence-skill/ folder, forward-slash separators.
  name: 'network-intelligence-skill/' + relative(srcDir, full).split(sep).join('/'),
  data: readFileSync(full),
}))

// ── build ZIP (STORE) ─────────────────────────────────────────────────────────
const chunks = []
const central = []
let offset = 0

for (const f of files) {
  const nameBuf = Buffer.from(f.name, 'utf8')
  const crc = crc32(f.data)
  const size = f.data.length

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)      // version needed
  local.writeUInt16LE(0, 6)       // flags
  local.writeUInt16LE(0, 8)       // compression = store
  local.writeUInt16LE(0, 10)      // mod time
  local.writeUInt16LE(0, 12)      // mod date
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(size, 18)   // compressed size
  local.writeUInt32LE(size, 22)   // uncompressed size
  local.writeUInt16LE(nameBuf.length, 26)
  local.writeUInt16LE(0, 28)      // extra length
  chunks.push(local, nameBuf, f.data)

  const cd = Buffer.alloc(46)
  cd.writeUInt32LE(0x02014b50, 0)
  cd.writeUInt16LE(20, 4)         // version made by
  cd.writeUInt16LE(20, 6)         // version needed
  cd.writeUInt16LE(0, 8)          // flags
  cd.writeUInt16LE(0, 10)         // compression
  cd.writeUInt16LE(0, 12)         // mod time
  cd.writeUInt16LE(0, 14)         // mod date
  cd.writeUInt32LE(crc, 16)
  cd.writeUInt32LE(size, 20)
  cd.writeUInt32LE(size, 24)
  cd.writeUInt16LE(nameBuf.length, 28)
  cd.writeUInt16LE(0, 30)         // extra
  cd.writeUInt16LE(0, 32)         // comment
  cd.writeUInt16LE(0, 34)         // disk number
  cd.writeUInt16LE(0, 36)         // internal attrs
  cd.writeUInt32LE(0, 38)         // external attrs
  cd.writeUInt32LE(offset, 42)    // local header offset
  central.push(Buffer.concat([cd, nameBuf]))

  offset += local.length + nameBuf.length + f.data.length
}

const centralBuf = Buffer.concat(central)
const eocd = Buffer.alloc(22)
eocd.writeUInt32LE(0x06054b50, 0)
eocd.writeUInt16LE(0, 4)                 // disk
eocd.writeUInt16LE(0, 6)                 // cd start disk
eocd.writeUInt16LE(files.length, 8)      // entries this disk
eocd.writeUInt16LE(files.length, 10)     // total entries
eocd.writeUInt32LE(centralBuf.length, 12)
eocd.writeUInt32LE(offset, 16)           // cd offset
eocd.writeUInt16LE(0, 20)                // comment length

mkdirSync(join(root, 'public'), { recursive: true })
writeFileSync(outFile, Buffer.concat([...chunks, centralBuf, eocd]))
console.log(`Wrote ${outFile} (${files.length} files)`)
