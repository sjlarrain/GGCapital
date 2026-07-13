'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { NetworkNode, ConstellationEdge, NetworkRole } from '@/lib/network/roles'

// ── role palette (accessible on the light canvas; matches the legend) ─────────
const ROLE_COLOR: Record<NetworkRole, string> = {
  connector:   '#6366f1', // indigo — facilitates AND receives
  facilitator: '#0ea5e9', // sky — makes intros
  beneficiary: '#10b981', // emerald — receives intros
  peripheral:  '#94a3b8', // slate — neither
}
const ROLE_LABEL: Record<NetworkRole, string> = {
  connector: 'Connector', facilitator: 'Facilitator', beneficiary: 'Beneficiary', peripheral: 'Peripheral',
}

const WIDTH = 820
const HEIGHT = 560

interface Pt { x: number; y: number }

/**
 * Deterministic Fruchterman–Reingold layout. Seeded on a circle by index so the
 * same graph always lays out the same way (no animation, SSR-stable). O(n²) per
 * iteration — fine for the hundreds-of-orgs scale this graph operates at.
 */
function computeLayout(nodes: NetworkNode[], edges: ConstellationEdge[]): Map<string, Pt> {
  const pos = new Map<string, Pt>()
  const n = nodes.length
  if (n === 0) return pos
  const R = Math.min(WIDTH, HEIGHT) * 0.34
  nodes.forEach((nd, i) => {
    const a = (i / n) * 2 * Math.PI
    pos.set(nd.entity_id, { x: WIDTH / 2 + Math.cos(a) * R, y: HEIGHT / 2 + Math.sin(a) * R })
  })
  if (n === 1) return pos

  const area = WIDTH * HEIGHT
  const k = 0.8 * Math.sqrt(area / n) // ideal edge length
  const present = new Set(nodes.map((nd) => nd.entity_id))
  const links = edges.filter((e) => present.has(e.source_entity_id) && present.has(e.target_entity_id))
  let temp = WIDTH / 10
  const iterations = 300

  for (let it = 0; it < iterations; it++) {
    const disp = new Map<string, Pt>()
    for (const nd of nodes) disp.set(nd.entity_id, { x: 0, y: 0 })

    // Repulsion between every pair.
    for (let i = 0; i < n; i++) {
      const a = pos.get(nodes[i].entity_id)!
      const da = disp.get(nodes[i].entity_id)!
      for (let j = i + 1; j < n; j++) {
        const b = pos.get(nodes[j].entity_id)!
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d = Math.hypot(dx, dy) || 0.01
        const f = (k * k) / d
        const ux = (dx / d) * f
        const uy = (dy / d) * f
        da.x += ux; da.y += uy
        const db = disp.get(nodes[j].entity_id)!
        db.x -= ux; db.y -= uy
      }
    }

    // Attraction along edges (weighted: heavier edges pull harder).
    for (const e of links) {
      const a = pos.get(e.source_entity_id)!
      const b = pos.get(e.target_entity_id)!
      const dx = a.x - b.x
      const dy = a.y - b.y
      const d = Math.hypot(dx, dy) || 0.01
      const f = ((d * d) / k) * Math.min(1 + Math.log2(e.weight + 1) * 0.3, 3)
      const ux = (dx / d) * f
      const uy = (dy / d) * f
      disp.get(e.source_entity_id)!.x -= ux
      disp.get(e.source_entity_id)!.y -= uy
      disp.get(e.target_entity_id)!.x += ux
      disp.get(e.target_entity_id)!.y += uy
    }

    // Apply, capped by the cooling temperature; keep inside the canvas.
    for (const nd of nodes) {
      const p = pos.get(nd.entity_id)!
      const dp = disp.get(nd.entity_id)!
      const d = Math.hypot(dp.x, dp.y) || 0.01
      p.x += (dp.x / d) * Math.min(d, temp)
      p.y += (dp.y / d) * Math.min(d, temp)
      p.x = Math.max(24, Math.min(WIDTH - 24, p.x))
      p.y = Math.max(24, Math.min(HEIGHT - 24, p.y))
    }
    temp *= 0.96
  }
  return pos
}

function radius(node: NetworkNode): number {
  return 5 + Math.min(node.degree, 12) * 1.4 + Math.min(node.intros_received, 8) * 0.6
}

export default function NetworkClient({ nodes, edges }: { nodes: NetworkNode[]; edges: ConstellationEdge[] }) {
  const maxDegree = useMemo(() => nodes.reduce((m, n) => Math.max(m, n.degree), 0), [nodes])
  const [minConnections, setMinConnections] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)

  // Adjacency for neighbor-highlight.
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const e of edges) {
      if (!map.has(e.source_entity_id)) map.set(e.source_entity_id, new Set())
      if (!map.has(e.target_entity_id)) map.set(e.target_entity_id, new Set())
      map.get(e.source_entity_id)!.add(e.target_entity_id)
      map.get(e.target_entity_id)!.add(e.source_entity_id)
    }
    return map
  }, [edges])

  // Apply the min-connections filter to nodes + the edges between survivors.
  const { visibleNodes, visibleEdges } = useMemo(() => {
    const vn = nodes.filter((n) => n.degree >= minConnections)
    const ids = new Set(vn.map((n) => n.entity_id))
    const ve = edges.filter((e) => ids.has(e.source_entity_id) && ids.has(e.target_entity_id))
    return { visibleNodes: vn, visibleEdges: ve }
  }, [nodes, edges, minConnections])

  const layout = useMemo(() => computeLayout(visibleNodes, visibleEdges), [visibleNodes, visibleEdges])
  const maxWeight = useMemo(() => visibleEdges.reduce((m, e) => Math.max(m, e.weight), 1), [visibleEdges])

  const isDimmed = (id: string) =>
    hovered !== null && hovered !== id && !(adjacency.get(hovered)?.has(id) ?? false)

  const totalIntros = useMemo(() => nodes.reduce((s, n) => s + n.intros_received, 0), [nodes])
  const unlinkedCount = useMemo(() => nodes.filter((n) => !n.is_company).length, [nodes])

  return (
    <div className="container" style={{ maxWidth: 1200, padding: '2rem 1rem' }}>
      <h1 className="title is-4">Network Intelligence</h1>
      <p className="subtitle is-6 has-text-grey">
        The relationship constellation, computed live from intros. {nodes.length} nodes · {edges.length} connections
        {unlinkedCount > 0 && <> · {unlinkedCount} not yet a CRM company</>}.
      </p>

      {nodes.length === 0 ? (
        <div className="notification is-light">
          <strong>No intros yet.</strong> Load introductions with the Network Intelligence Skill (Settings → Tokens)
          or the bulk loader. Every party becomes a node the moment its intro lands — names that aren&apos;t CRM
          companies appear as unlinked nodes you can promote later.
        </div>
      ) : (
        <div className="columns">
          {/* ── Constellation ── */}
          <div className="column is-two-thirds">
            <div className="box" style={{ padding: '0.75rem' }}>
              <div className="is-flex is-align-items-center is-justify-content-space-between mb-2" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                <div className="is-flex" style={{ gap: '0.9rem', flexWrap: 'wrap' }}>
                  {(Object.keys(ROLE_COLOR) as NetworkRole[]).map((r) => (
                    <span key={r} className="is-size-7 is-flex is-align-items-center" style={{ gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: ROLE_COLOR[r], display: 'inline-block' }} />
                      {ROLE_LABEL[r]}
                    </span>
                  ))}
                  {/* shape legend: hollow = not a CRM company */}
                  <span className="is-size-7 is-flex is-align-items-center" style={{ gap: 4 }} title="A node that isn't backed by a CRM company. Promote it to a company when it matters.">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', border: '1.5px dashed #94a3b8', display: 'inline-block' }} />
                    Unlinked (not a CRM company)
                  </span>
                </div>
                <label className="is-size-7 has-text-grey is-flex is-align-items-center" style={{ gap: 6 }}>
                  Min connections: <strong>{minConnections}</strong>
                  <input
                    type="range" min={0} max={Math.max(maxDegree, 1)} value={minConnections}
                    onChange={(e) => setMinConnections(Number(e.target.value))}
                    style={{ verticalAlign: 'middle' }}
                  />
                </label>
              </div>

              <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', background: '#fbfcfe', borderRadius: 6 }}>
                {/* edges */}
                {visibleEdges.map((e, i) => {
                  const a = layout.get(e.source_entity_id)
                  const b = layout.get(e.target_entity_id)
                  if (!a || !b) return null
                  const dim = isDimmed(e.source_entity_id) && isDimmed(e.target_entity_id)
                  return (
                    <line
                      key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke="#cbd5e1" strokeOpacity={dim ? 0.15 : 0.55}
                      strokeWidth={1 + (e.weight / maxWeight) * 4}
                    />
                  )
                })}
                {/* nodes — filled = CRM company, hollow/dashed = name-only node */}
                {visibleNodes.map((n) => {
                  const p = layout.get(n.entity_id)
                  if (!p) return null
                  const dim = isDimmed(n.entity_id)
                  const r = radius(n)
                  const showLabel = (hovered === n.entity_id || n.degree >= Math.max(2, maxDegree * 0.6))
                  const color = ROLE_COLOR[n.role]
                  return (
                    <g key={n.entity_id}
                       onMouseEnter={() => setHovered(n.entity_id)}
                       onMouseLeave={() => setHovered(null)}
                       style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1 }}>
                      <circle
                        cx={p.x} cy={p.y} r={r}
                        fill={n.is_company ? color : '#fff'}
                        stroke={n.is_company ? '#fff' : color}
                        strokeWidth={1.5}
                        strokeDasharray={n.is_company ? undefined : '3 2'}
                      />
                      {showLabel && (
                        <text x={p.x} y={p.y - r - 3} textAnchor="middle" fontSize={11} fill="#334155">
                          {n.name}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
              <p className="help has-text-grey">Hover a node to highlight its direct connections. Node size ≈ connections + intros received. Hollow nodes aren&apos;t CRM companies yet.</p>
            </div>
          </div>

          {/* ── Leaderboard ── */}
          <div className="column is-one-third">
            <div className="box" style={{ padding: '1rem' }}>
              <h2 className="title is-6 mb-1">Leaderboard</h2>
              <p className="is-size-7 has-text-grey mb-3">{totalIntros} intros received across the network.</p>
              <table className="table is-fullwidth is-narrow is-hoverable">
                <thead>
                  <tr>
                    <th>Node</th>
                    <th title="Intros facilitated" className="has-text-right">Made</th>
                    <th title="Intros received" className="has-text-right">Recv</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.slice(0, 25).map((n) => (
                    <tr key={n.entity_id}
                        onMouseEnter={() => setHovered(n.entity_id)}
                        onMouseLeave={() => setHovered(null)}
                        style={{ background: hovered === n.entity_id ? '#eef2ff' : undefined }}>
                      <td>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.is_company ? ROLE_COLOR[n.role] : '#fff', border: n.is_company ? undefined : `1.5px dashed ${ROLE_COLOR[n.role]}`, display: 'inline-block', marginRight: 6 }} />
                        {n.name}
                        {!n.is_company && <span className="tag is-light is-rounded ml-1" style={{ fontSize: '0.6rem', height: '1.1rem', padding: '0 0.4rem' }} title="Not a CRM company">node</span>}
                      </td>
                      <td className="has-text-right">{n.intros_facilitated || '—'}</td>
                      <td className="has-text-right">{n.intros_received || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {nodes.length > 25 && <p className="help has-text-grey">Showing top 25 of {nodes.length}.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
