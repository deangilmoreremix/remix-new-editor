'use client'

/**
 * The outreach sequence as a diagram (Stage 10, React Flow): Recipients → make files → email → wait → check → follow-up.
 * It is a PLAN: it is checked, simulated for different recipient behaviours and exported, but nothing in this app sends, waits or
 * watches anyone on its own. Every connection can also be made with the "Connect" menus, so the diagram is usable without dragging.
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, applyEdgeChanges, applyNodeChanges, type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CONDITION_TEXT, MAX_NODES, NODE_TITLES, WAIT_RANGE, defaultFlow, nodeTitle, normalizeFlow, planRows, simulate, validateFlow, type ConditionKind, type EdgeBranch, type FlowNode, type FlowNodeType, type OutreachFlow, type RecipientBehavior } from '../flow/outreachFlow'
import { toCsv } from '../bulk/csv'
import { browserDownloadBlob } from './ThumbnailGifPanel'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

export interface OutreachFlowPanelProps { initial?: OutreachFlow; downloadFn?: (fileName: string, blob: Blob) => void; storage?: Pick<Storage, 'getItem' | 'setItem'> | null }

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }
const STORAGE_KEY = 'smartvideo.outreachFlow.v1'
const ADDABLE: FlowNodeType[] = ['personalize', 'email', 'wait', 'condition', 'end']

const detail = (n: FlowNode): string => (n.type === 'email' ? n.subject || '(no subject)' : n.type === 'wait' ? `${n.days} day${n.days === 1 ? '' : 's'}` : n.type === 'condition' ? `Has the recipient ${CONDITION_TEXT[n.kind ?? 'watched']}?` : n.type === 'personalize' ? (n.make ?? []).join(', ') || '(nothing chosen)' : n.label ?? '')

const FlowCard = memo(function FlowCard({ data, selected }: NodeProps<Node<{ node: FlowNode }>>) {
  const n = data.node
  return (
    <div data-testid={`flow-node-${n.id}`} style={{ background: C.panel, border: `1px solid ${selected ? C.accent : C.borderStrong}`, borderRadius: 8, padding: '6px 10px', minWidth: 150, color: C.text, fontSize: 11 }}>
      {n.type !== 'audience' ? <Handle type="target" position={Position.Top} /> : null}
      <div style={{ fontWeight: 600 }}>{NODE_TITLES[n.type]}</div>
      <div style={{ color: C.muted }}>{detail(n)}</div>
      {n.type === 'condition' ? (
        <><Handle id="yes" type="source" position={Position.Bottom} style={{ left: '25%' }} /><Handle id="no" type="source" position={Position.Bottom} style={{ left: '75%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted2, fontSize: 9 }}><span>Yes</span><span>No</span></div></>
      ) : n.type !== 'end' ? <Handle type="source" position={Position.Bottom} /> : null}
    </div>
  )
})
const nodeTypes = { card: FlowCard }

function toRf(flow: OutreachFlow, selectedId: string | null): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: flow.nodes.map((n) => ({ id: n.id, type: 'card', position: { x: n.x, y: n.y }, data: { node: n }, selected: n.id === selectedId })),
    edges: flow.edges.map((e) => ({ id: e.id, source: e.from, target: e.to, sourceHandle: e.branch === 'next' ? null : e.branch, label: e.branch === 'next' ? undefined : e.branch === 'yes' ? 'Yes' : 'No' })),
  }
}
let counter = 0
const newId = (flow: OutreachFlow) => { let id = ''; do { counter += 1; id = `n${Date.now().toString(36)}${counter}` } while (flow.nodes.some((n) => n.id === id)); return id }

function FlowEditor({ initial, downloadFn, storage }: OutreachFlowPanelProps) {
  const [flow, setFlow] = useState<OutreachFlow>(() => {
    if (initial) return normalizeFlow(initial)
    try { const raw = storage?.getItem(STORAGE_KEY); if (raw) { const f = normalizeFlow(JSON.parse(raw)); if (f.nodes.length) return f } } catch { /* unreadable draft: start fresh */ }
    return defaultFlow()
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [who, setWho] = useState<RecipientBehavior>({})
  useEffect(() => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(flow)) } catch { /* private mode: the draft is just not kept */ } }, [flow, storage])

  const issues = useMemo(() => validateFlow(flow), [flow])
  const errors = issues.filter((i) => i.level === 'error')
  const sim = useMemo(() => simulate(flow, who), [flow, who])
  const rf = useMemo(() => toRf(flow, selected), [flow, selected])
  const sel = flow.nodes.find((n) => n.id === selected) ?? null

  const patchNode = (id: string, patch: Partial<FlowNode>) => setFlow((f) => normalizeFlow({ ...f, nodes: f.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }))
  const removeNodes = (ids: string[]) => setFlow((f) => normalizeFlow({ ...f, nodes: f.nodes.filter((n) => !ids.includes(n.id)), edges: f.edges.filter((e) => !ids.includes(e.from) && !ids.includes(e.to)) }))
  const addEdge = useCallback((from: string, to: string, branch: EdgeBranch) => setFlow((f) => {
    const src = f.nodes.find((n) => n.id === from)
    if (!src || from === to) return f
    const b: EdgeBranch = src.type === 'condition' ? (branch === 'next' ? 'yes' : branch) : 'next'
    // one way out per plain step and per branch: connecting again replaces the old connection
    const edges = f.edges.filter((e) => !(e.from === from && (src.type === 'condition' ? e.branch === b : true)))
    return normalizeFlow({ ...f, edges: [...edges, { id: `${from}>${to}>${b}`, from, to, branch: b }] })
  }), [])
  const add = (type: FlowNodeType) => setFlow((f) => {
    if (f.nodes.length >= MAX_NODES) return f
    const last = f.nodes[f.nodes.length - 1]; const id = newId(f)
    const base: FlowNode = { id, type, x: (last?.x ?? 0) + 40, y: (last?.y ?? 0) + 110, ...(type === 'email' ? { subject: '{{firstName}}, a quick video' } : type === 'wait' ? { days: 3 } : type === 'personalize' ? { make: ['gif', 'thumbnail'] as FlowNode['make'] } : type === 'condition' ? { kind: 'watched' as ConditionKind } : {}) }
    setSelected(id); return normalizeFlow({ ...f, nodes: [...f.nodes, base] })
  })

  const onNodesChange = (changes: NodeChange[]) => {
    const removed = changes.filter((c) => c.type === 'remove').map((c) => c.id); if (removed.length) removeNodes(removed)
    const moved = applyNodeChanges(changes.filter((c) => c.type === 'position' || c.type === 'select'), rf.nodes)
    setFlow((f) => normalizeFlow({ ...f, nodes: f.nodes.map((n) => { const m = moved.find((x) => x.id === n.id); return m ? { ...n, x: m.position.x, y: m.position.y } : n }) }))
    const s = changes.find((c) => c.type === 'select' && c.selected); if (s && s.type === 'select') setSelected(s.id)
  }
  const onEdgesChange = (changes: EdgeChange[]) => { const gone = changes.filter((c) => c.type === 'remove').map((c) => c.id); if (gone.length) setFlow((f) => ({ ...f, edges: f.edges.filter((e) => !gone.includes(e.id)) })); applyEdgeChanges(changes, rf.edges) }
  const onConnect = (c: Connection) => { if (c.source && c.target) addEdge(c.source, c.target, c.sourceHandle === 'no' ? 'no' : c.sourceHandle === 'yes' ? 'yes' : 'next') }

  const dl = downloadFn ?? browserDownloadBlob
  const outgoing = sel ? flow.edges.filter((e) => e.from === sel.id) : []
  const targets = sel ? flow.nodes.filter((n) => n.id !== sel.id && n.type !== 'audience') : []

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="flow-panel">
      <div style={labelStyle}>Outreach sequence</div>
      <p style={hintStyle}>Plan who gets what, and when. <strong>This is a plan only</strong>: this app does not send emails on a schedule or watch what people do, so you (or a scheduler you connect later) follow it. A person who unsubscribes or replies is never emailed again, whatever the plan says.</p>
      <div style={row}>{ADDABLE.map((t) => <button key={t} type="button" style={small} onClick={() => add(t)} disabled={flow.nodes.length >= MAX_NODES}>Add: {NODE_TITLES[t]}</button>)}</div>

      <div style={{ height: 380, border: `1px solid ${C.border}`, borderRadius: 8 }} data-testid="flow-canvas">
        <ReactFlow nodes={rf.nodes} edges={rf.edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onPaneClick={() => setSelected(null)} fitView colorMode="dark" deleteKeyCode={['Backspace', 'Delete']} proOptions={{ hideAttribution: true }} nodesConnectable>
          <Background /><Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {sel ? (
        <div data-testid="flow-inspector" style={{ ...hintStyle, color: C.text }}>
          <div style={{ fontWeight: 600 }}>{NODE_TITLES[sel.type]}</div>
          {sel.type === 'audience' ? <input aria-label="List name" value={sel.label ?? ''} placeholder="List name" onChange={(e) => patchNode(sel.id, { label: e.target.value })} style={{ ...inputStyle, minHeight: 26, padding: '0 6px' }} /> : null}
          {sel.type === 'email' ? <input aria-label="Email subject" value={sel.subject ?? ''} onChange={(e) => patchNode(sel.id, { subject: e.target.value })} style={{ ...inputStyle, minHeight: 26, padding: '0 6px', width: '100%' }} /> : null}
          {sel.type === 'wait' ? <label>Days to wait <input aria-label="Days to wait" type="number" min={WAIT_RANGE[0]} max={WAIT_RANGE[1]} value={sel.days ?? 3} onChange={(e) => patchNode(sel.id, { days: Number(e.target.value) })} style={{ ...inputStyle, minHeight: 26, width: 64 }} /></label> : null}
          {sel.type === 'condition' ? <label>Check whether they <select aria-label="Check" value={sel.kind ?? 'watched'} onChange={(e) => patchNode(sel.id, { kind: e.target.value as ConditionKind })} style={{ ...inputStyle, minHeight: 26 }}>{(Object.keys(CONDITION_TEXT) as ConditionKind[]).map((k) => <option key={k} value={k}>{CONDITION_TEXT[k]}</option>)}</select></label> : null}
          {sel.type === 'personalize' ? <div style={row}>{(['video', 'gif', 'thumbnail'] as const).map((m) => <label key={m}><input type="checkbox" checked={Boolean(sel.make?.includes(m))} onChange={() => patchNode(sel.id, { make: (['video', 'gif', 'thumbnail'] as const).filter((x) => (x === m ? !sel.make?.includes(m) : sel.make?.includes(x))) })} /> {m}</label>)}</div> : null}
          {sel.type !== 'end' ? (
            <div style={row}>
              {(sel.type === 'condition' ? (['yes', 'no'] as const) : (['next'] as const)).map((b) => (
                <label key={b}>{sel.type === 'condition' ? (b === 'yes' ? 'If yes, go to' : 'If no, go to') : 'Then go to'}{' '}
                  <select aria-label={sel.type === 'condition' ? `Go to if ${b}` : 'Go to'} value={outgoing.find((e) => e.branch === b)?.to ?? ''} onChange={(e) => (e.target.value ? addEdge(sel.id, e.target.value, b) : setFlow((f) => ({ ...f, edges: f.edges.filter((x) => !(x.from === sel.id && x.branch === b)) })))} style={{ ...inputStyle, minHeight: 26 }}>
                    <option value="">(nothing)</option>{targets.map((t) => <option key={t.id} value={t.id}>{nodeTitle(t)}</option>)}
                  </select></label>))}
            </div>
          ) : null}
          {sel.type !== 'audience' ? <button type="button" style={small} onClick={() => { removeNodes([sel.id]); setSelected(null) }}>Remove this step</button> : null}
        </div>
      ) : <p style={hintStyle}>Select a step to edit it. Drag from a dot to another step to connect them.</p>}

      <div data-testid="flow-issues">
        {issues.length === 0 ? <div style={{ ...hintStyle, color: C.text }}>The sequence is valid.</div> : issues.map((i, k) => <div key={k} data-level={i.level} style={{ ...hintStyle, color: C.text }}>{i.level === 'error' ? '✖ ' : '⚠ '}{i.message}</div>)}
      </div>

      <div style={{ ...hintStyle, color: C.text }}>
        <div style={{ fontWeight: 600 }}>What would happen to a recipient who…</div>
        <div style={row}>
          {(['watched', 'clicked', 'replied', 'unsubscribed'] as const).map((k) => <label key={k}><input type="checkbox" checked={Boolean(who[k])} onChange={() => setWho((w) => ({ ...w, [k]: !w[k] }))} /> {k === 'watched' ? 'watches the video' : k === 'clicked' ? 'clicks the button' : k === 'replied' ? 'replies' : 'unsubscribes'}</label>)}
        </div>
        {sim.ended === 'invalid' ? <div>Fix the errors above to see the plan.</div> : (
          <ol data-testid="flow-simulation" style={{ margin: '4px 0 0', paddingLeft: 18 }}>{sim.steps.map((s, i) => <li key={i}>Day {s.day}: {s.text}</li>)}<li>{sim.ended === 'end' ? 'End.' : sim.ended === 'unsubscribed' ? 'Stopped (unsubscribed).' : sim.ended === 'replied' ? 'Stopped (replied).' : 'Stopped.'} {sim.emails} email{sim.emails === 1 ? '' : 's'} in total.</li></ol>
        )}
      </div>
      <div style={row}>
        <button type="button" style={small} disabled={errors.length > 0} onClick={() => dl('outreach-plan.csv', new Blob(['﻿' + toCsv(planRows(flow))], { type: 'text/csv' }))}>Download plan (.csv)</button>
        <button type="button" style={small} onClick={() => dl('outreach-sequence.json', new Blob([JSON.stringify(flow, null, 2)], { type: 'application/json' }))}>Download sequence (.json)</button>
        <button type="button" style={small} onClick={() => { setFlow(defaultFlow()); setSelected(null) }}>Start again from the example</button>
      </div>
    </div>
  )
}

export function OutreachFlowPanel(props: OutreachFlowPanelProps) {
  const storage = props.storage === undefined ? (typeof window !== 'undefined' ? (() => { try { return window.localStorage } catch { return null } })() : null) : props.storage
  return <ReactFlowProvider><FlowEditor {...props} storage={storage} /></ReactFlowProvider>
}
