'use client'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { NetworkNode, ConstellationEdge } from '@/lib/network/roles'

// ── flow palette (matches the reference "relationship ledger") ────────────────
type Flow = 'both' | 'in' | 'out' | 'peripheral'
const FLOW_COLOR: Record<Flow, string> = {
  both: '#F2B95B', // amber — two-way connector
  in:   '#46D2A0', // green — feeds GG intros
  out:  '#6AA6FF', // blue  — GG connects them
  peripheral: '#5A6377',
}
const FLOW_LABEL: Record<Flow, string> = {
  both: 'Two-way connector', in: 'Feeds GG', out: 'GG connects them', peripheral: 'Peripheral',
}

type SortKey = 'made' | 'received' | 'connections' | 'name'

export default function NetworkClient({
  nodes, edges, flowById,
}: {
  nodes: NetworkNode[]
  edges: ConstellationEdge[]
  flowById: Record<string, Flow>
}) {
  const [minConn, setMinConn] = useState(2)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('made')
  const containerRef = useRef<HTMLDivElement>(null)

  const flowOf = (id: string): Flow => flowById[id] ?? 'peripheral'

  // ── graph: nodes above the connection threshold + edges among them ──────────
  const { visNodes, visEdges } = useMemo(() => {
    const vn = nodes.filter((n) => n.degree >= minConn)
    const ids = new Set(vn.map((n) => n.entity_id))
    const ve = edges.filter((e) => ids.has(e.source_entity_id) && ids.has(e.target_entity_id))
    return { visNodes: vn, visEdges: ve }
  }, [nodes, edges, minConn])

  useEffect(() => {
    let destroyed = false
    let network: { destroy: () => void } | null = null
    ;(async () => {
      const [{ Network }, { DataSet }] = await Promise.all([import('vis-network'), import('vis-data')])
      if (destroyed || !containerRef.current) return

      const maxW = Math.max(1, ...visEdges.map((e) => e.weight))
      const nodeData = visNodes.map((n) => {
        const isGG = n.name === 'GG Capital'
        const flow = flowOf(n.entity_id)
        const size = 7 + Math.min(n.degree, 16) * 1.7 + Math.min(n.intros_received, 10) * 0.5
        return {
          id: n.entity_id,
          label: n.name,
          title: `${n.name}\n${n.intros_facilitated} made · ${n.intros_received} received · ${n.degree} connections`,
          shape: isGG ? 'star' : 'dot',
          size: isGG ? 32 : size,
          opacity: 1,
          color: {
            background: isGG ? '#F2B95B' : FLOW_COLOR[flow],
            border: isGG ? '#B8863B' : 'rgba(255,255,255,.28)',
          },
          borderWidth: isGG ? 3 : 1.5,
          font: {
            color: n.degree >= 4 || isGG ? '#E9EDF4' : '#94A3B8',
            size: Math.min(20, 12 + n.degree * 0.35),
            face: 'Georgia', strokeWidth: 4, strokeColor: '#10141D',
          },
          shapeProperties: n.is_company ? {} : { borderDashes: [4, 3] },
        }
      })
      const edgeData = visEdges.map((e, i) => ({
        id: i, from: e.source_entity_id, to: e.target_entity_id,
        width: 0.5 + (e.weight / maxW) * 5,
        color: { color: '#39435C', opacity: 0.5, highlight: '#F2B95B', hover: '#F2B95B' },
        smooth: { enabled: true, type: 'continuous', roundness: 0.35 },
      }))

      const nodesDS = new DataSet(nodeData)
      const edgesDS = new DataSet(edgeData)
      const net = new Network(
        containerRef.current,
        { nodes: nodesDS, edges: edgesDS },
        {
          physics: {
            barnesHut: { gravitationalConstant: -13000, centralGravity: 0.28, springLength: 125, springConstant: 0.03, damping: 0.45, avoidOverlap: 0.5 },
            stabilization: { iterations: 260 },
          },
          interaction: { hover: true, dragNodes: true, zoomView: true, tooltipDelay: 120 },
          nodes: { shadow: { enabled: true, color: 'rgba(0,0,0,.45)', size: 6 } },
          edges: { selectionWidth: 1.4 },
        }
      )
      network = net
      // click a node → isolate its neighborhood; click empty space → reset
      net.on('click', (params: { nodes: string[] }) => {
        if (params.nodes.length) {
          const sel = params.nodes[0]
          const keep = new Set<string>([sel, ...net.getConnectedNodes(sel) as string[]])
          nodesDS.update(nodeData.map((nd) => ({ id: nd.id, opacity: keep.has(nd.id) ? 1 : 0.1 })))
        } else {
          nodesDS.update(nodeData.map((nd) => ({ id: nd.id, opacity: 1 })))
        }
      })
      // freeze the layout once settled so it doesn't keep drifting
      net.once('stabilizationIterationsDone', () => { if (!destroyed) net.setOptions({ physics: false }) })
    })()
    return () => { destroyed = true; network?.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visNodes, visEdges])

  // ── leaderboard table ───────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? nodes.filter((n) => n.name.toLowerCase().includes(q)) : nodes
    const key = sortKey === 'made' ? 'intros_facilitated' : sortKey === 'received' ? 'intros_received' : 'degree'
    return [...filtered].sort((a, b) =>
      sortKey === 'name'
        ? a.name.localeCompare(b.name)
        : (b[key] as number) - (a[key] as number) || b.intros_facilitated - a.intros_facilitated || a.name.localeCompare(b.name)
    )
  }, [nodes, query, sortKey])

  const maxMade = useMemo(() => Math.max(1, ...nodes.map((n) => n.intros_facilitated)), [nodes])
  const companyCount = useMemo(() => nodes.filter((n) => n.is_company).length, [nodes])

  const th = (key: SortKey, label: string, extra = '') => (
    <th
      className={`is-clickable ${extra}`}
      style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
      onClick={() => setSortKey(key)}
      title="Sort by this column"
    >
      {label} {sortKey === key ? <span style={{ color: '#6366f1' }}>▾</span> : <span className="has-text-grey-light">▾</span>}
    </th>
  )

  if (nodes.length === 0) {
    return (
      <div className="container" style={{ maxWidth: 1200, padding: '2rem 1rem' }}>
        <h1 className="title is-4">Network Intelligence</h1>
        <div className="notification is-light">
          <strong>No intros yet.</strong> Load introductions with the Network Intelligence Skill (Settings → Tokens)
          or the bulk loader. Every party becomes a node the moment its intro lands.
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: 1200, padding: '2rem 1rem' }}>
      <h1 className="title is-4 mb-1">Network Intelligence</h1>
      <p className="subtitle is-6 has-text-grey">Who connects GG to whom — computed live from {nodes.length} nodes and {edges.length} connections.</p>

      {/* stat tiles */}
      <div className="is-flex mb-5" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Nodes', value: nodes.length },
          { label: 'CRM companies', value: companyCount },
          { label: 'Name-only nodes', value: nodes.length - companyCount },
          { label: 'Connections', value: edges.length },
        ].map((s) => (
          <div key={s.label} className="box mb-0 p-4" style={{ flex: '1 1 160px', textAlign: 'center' }}>
            <p className="is-size-3 has-text-weight-bold" style={{ lineHeight: 1 }}>{s.value}</p>
            <p className="is-size-7 has-text-grey mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Constellation (dark panel) ── */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #222a3a', marginBottom: '2rem' }}>
        <div
          className="is-flex is-align-items-center px-4 py-3"
          style={{ background: '#171d2a', gap: '1.1rem', flexWrap: 'wrap' }}
        >
          {(Object.keys(FLOW_COLOR) as Flow[]).map((f) => (
            <span key={f} className="is-size-7 is-flex is-align-items-center" style={{ gap: 6, color: '#8a93a6' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: FLOW_COLOR[f], display: 'inline-block' }} />
              {FLOW_LABEL[f]}
            </span>
          ))}
          <span className="is-size-7 is-flex is-align-items-center" style={{ gap: 6, color: '#8a93a6' }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'transparent', border: '1.5px dashed #8a93a6', display: 'inline-block' }} />
            not a CRM company
          </span>
          <span className="is-flex is-align-items-center" style={{ marginLeft: 'auto', gap: 6, color: '#8a93a6', fontSize: 12 }}>
            Min connections
            {[1, 2, 3, 4].map((m) => (
              <button
                key={m}
                onClick={() => setMinConn(m)}
                style={{
                  background: minConn === m ? '#26304a' : '#1c2333',
                  border: `1px solid ${minConn === m ? '#6AA6FF' : '#2a3348'}`,
                  color: minConn === m ? '#e9edf4' : '#8a93a6',
                  borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12,
                }}
              >
                {m}
              </button>
            ))}
          </span>
        </div>
        <div
          ref={containerRef}
          style={{ height: 560, background: 'radial-gradient(ellipse at 50% 45%, #151b29 0%, #10141d 70%)' }}
        />
        <p className="is-size-7 px-4 py-2" style={{ background: '#171d2a', color: '#8a93a6', margin: 0 }}>
          Drag nodes, scroll to zoom, hover for counts. Click a node to isolate its neighborhood; click empty space to reset. Node size ≈ connections + intros received.
        </p>
      </div>

      {/* ── Leaderboard table ── */}
      <div className="box">
        <div className="is-flex is-align-items-center is-justify-content-space-between mb-3" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 className="title is-5 mb-1">Who helps GG most</h2>
            <p className="is-size-7 has-text-grey">Sortable. <strong>Made</strong> = intros this node facilitated; <strong>Received</strong> = intros it was part of; <strong>Connections</strong> = distinct orgs it links to.</p>
          </div>
          <input
            className="input is-small" style={{ maxWidth: 220 }}
            placeholder="Search a name…" value={query} onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table className="table is-fullwidth is-narrow is-hoverable">
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bulma-scheme-main, #fff)', zIndex: 1 }}>
              <tr>
                <th style={{ width: 34 }}>#</th>
                {th('name', 'Node')}
                {th('made', 'Made', 'has-text-right')}
                {th('received', 'Received', 'has-text-right')}
                {th('connections', 'Conns', 'has-text-right')}
              </tr>
            </thead>
            <tbody>
              {rows.map((n, i) => {
                const flow = flowOf(n.entity_id)
                return (
                  <tr key={n.entity_id}>
                    <td className="has-text-grey">{i + 1}</td>
                    <td>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: n.is_company ? FLOW_COLOR[flow] : 'transparent', border: n.is_company ? undefined : `1.5px dashed ${FLOW_COLOR[flow]}`, display: 'inline-block', marginRight: 7 }} />
                      {n.company_id ? (
                        <Link href={`/companies/${n.company_id}`}>{n.name}</Link>
                      ) : (
                        <>{n.name} <span className="tag is-light is-rounded ml-1" style={{ fontSize: '0.6rem', height: '1.1rem', padding: '0 0.4rem' }}>node</span></>
                      )}
                    </td>
                    <td className="has-text-right">
                      <div className="is-flex is-align-items-center is-justify-content-flex-end" style={{ gap: 6 }}>
                        {n.intros_facilitated > 0 && (
                          <span style={{ display: 'inline-block', height: 6, borderRadius: 3, width: `${Math.max(6, (n.intros_facilitated / maxMade) * 60)}px`, background: '#6366f1', opacity: 0.5 }} />
                        )}
                        <span style={{ minWidth: 22, textAlign: 'right' }}>{n.intros_facilitated || '—'}</span>
                      </div>
                    </td>
                    <td className="has-text-right">{n.intros_received || '—'}</td>
                    <td className="has-text-right">{n.degree || '—'}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="has-text-centered has-text-grey py-4">No nodes match “{query}”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
