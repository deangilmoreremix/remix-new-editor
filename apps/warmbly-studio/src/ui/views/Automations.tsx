import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWb } from '../store';
import { Badge, Btn, Card, Empty, Field, Icon, Modal, fmtDateTime, useConfirm } from '../kit';
import { FlowCanvas } from '../canvas/FlowCanvas';
import { FLOW_ADD_OPTIONS, edgesOnPath, flowToCanvas, nodeForKind } from '../canvas/automationFlow';
import type { Automation, AutomationActionKind, AutomationCondition, AutomationTrigger, FlowNode } from '../../types';
import { ACTION_LABEL, ACTION_NEEDS_VALUE, TRIGGER_LABEL, classifyReply } from '../../domain/automation';
import { countNodes, findNode, insertAt, newAction, newTrigger, removeNode, updateNode, validateFlow, walk, walkFlow, formatDelay, type Slot } from '../../domain/flow';

const aid = () => `auto_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function Automations() {
  const { ws, dispatch, nav, arg } = useWb(); const { confirm, el } = useConfirm();
  const open = ws.automations.find(a => a.id === arg);
  if (open) return <AutomationEditor key={open.id} a={open} onBack={() => nav('automations')} />;
  const create = async () => {
    const t = newTrigger(); const flow = { ...t, next: newAction('label', 'interested') };
    const a: Automation = { id: aid(), name: 'Untitled automation', enabled: false, trigger: 'reply-received', flow, runs: 0, createdAt: new Date().toISOString() };
    await dispatch({ type: 'automation/save', automation: a }); nav('automations', a.id);
  };
  const summary = (a: Automation) => { let actions = 0, conds = 0, delays = 0; walk(a.flow, n => { if (n.kind === 'action') actions++; if (n.kind === 'condition') conds++; if (n.kind === 'delay') delays++; });
    return `${TRIGGER_LABEL[a.trigger]} → ${conds ? `${conds} condition${conds > 1 ? 's' : ''}, ` : ''}${actions} action${actions === 1 ? '' : 's'}${delays ? `, ${delays} delay${delays > 1 ? 's' : ''}` : ''}`; };
  return <div className="wb-grid">
    <div className="wb-row"><span className="wb-mute">Playbooks run automatically when something happens in a campaign or inbox.</span><span className="wb-sp" /><Btn pri onClick={create}>+ New automation</Btn></div>
    {ws.pending.length > 0 && <Card title="Scheduled actions"><span className="wb-mute wb-sm">{ws.pending.length} action{ws.pending.length > 1 ? 's' : ''} waiting on a delay. Next runs {fmtDateTime(ws.pending.map(p => p.runAt).sort()[0])}.</span></Card>}
    {ws.automations.length === 0 ? <Empty>No automations yet.</Empty> : ws.automations.map(a => <Card key={a.id}>
      <div className="wb-row wrap"><b>{a.name}</b><Badge tone={a.enabled ? 'good' : undefined}>{a.enabled ? 'on' : 'off'}</Badge><span className="wb-mute wb-sm">{a.runs} runs</span><span className="wb-sp" />
        <Btn sm onClick={() => dispatch({ type: 'automation/toggle', id: a.id })}>{a.enabled ? 'Disable' : 'Enable'}</Btn><Btn sm onClick={() => nav('automations', a.id)}>Edit</Btn>
        <Btn sm onClick={() => dispatch({ type: 'automation/save', automation: { ...a, id: aid(), name: `${a.name} (copy)`, enabled: false, runs: 0, flow: JSON.parse(JSON.stringify(a.flow).replace(/"id":"fn_[^"]+"/g, () => `"id":"fn_${Math.random().toString(36).slice(2, 9)}"`)) } })}>Duplicate</Btn>
        <Btn sm dng onClick={() => confirm(`Delete "${a.name}"?`, () => dispatch({ type: 'automation/remove', id: a.id }))}>Delete</Btn></div>
      <div className="wb-mute wb-sm" style={{ marginTop: 6 }}>{summary(a)}</div></Card>)}
    {el}</div>;
}

interface Version { at: string; label: string; snap: Automation }
function useAutomationEditor(a: Automation) {
  const { ws, dispatch } = useWb();
  const [draft, setDraft] = useState(a);
  const past = useRef<Automation[]>([]); const future = useRef<Automation[]>([]);
  const [versions, setVersions] = useState<Version[]>([{ at: new Date().toISOString(), label: 'Opened', snap: a }]);
  const [saved, setSaved] = useState(true);
  const latest = useRef(draft); latest.current = draft;
  const wsRef = useRef(ws); wsRef.current = ws;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flush = useCallback(() => {
    const live = wsRef.current.automations.find(x => x.id === latest.current.id);
    dispatch({ type: 'automation/save', automation: { ...latest.current, runs: live?.runs ?? latest.current.runs } }).then(() => setSaved(true));
  }, [dispatch]);
  const commit = useCallback((next: Automation, label = 'Edited', record = true) => {
    if (record) { past.current.push(latest.current); if (past.current.length > 60) past.current.shift(); future.current = []; setVersions(v => [{ at: new Date().toISOString(), label, snap: next }, ...v].slice(0, 30)); }
    setDraft(next); latest.current = next; setSaved(false); clearTimeout(timer.current); timer.current = setTimeout(flush, 350);
  }, [flush]);
  useEffect(() => () => { clearTimeout(timer.current); }, []);
  return { draft, commit, saved, versions,
    undo: () => { const p = past.current.pop(); if (p) { future.current.push(latest.current); commit(p, 'Undo', false); } },
    redo: () => { const f = future.current.pop(); if (f) { past.current.push(latest.current); commit(f, 'Redo', false); } },
    canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

function AutomationEditor({ a, onBack }: { a: Automation; onBack: () => void }) {
  const { toast, dispatch } = useWb(); const ed = useAutomationEditor(a);
  const { draft, commit } = ed; const [sel, setSel] = useState<string | null>(null);
  const [panel, setPanel] = useState<'inspect' | 'test'>('inspect'); const [hist, setHist] = useState(false);
  const [hot, setHot] = useState<{ ids: Set<string>; edges: Set<string> } | null>(null);
  const root = useMemo(() => flowToCanvas(draft.flow), [draft.flow]);
  const setFlow = (flow: FlowNode, label: string) => commit({ ...draft, flow, trigger: flow.trigger ?? draft.trigger }, label);
  const node = sel ? findNode(draft.flow, sel) : null;
  const errors = validateFlow(draft.flow);
  const setSelected = (id: string | null) => { setSel(id); if (id) setPanel('inspect'); };
  return <div className="wb-grid" style={{ alignContent: 'start' }}>
    <div className="wb-row wrap">
      <Btn sm onClick={onBack} aria-label="Back to automations">←</Btn>
      <input aria-label="Automation name" style={{ maxWidth: 340, fontWeight: 600 }} value={draft.name} onChange={e => commit({ ...draft, name: e.target.value }, 'Renamed')} />
      <label className="wb-row"><input type="checkbox" role="switch" aria-label="Active" style={{ width: 'auto' }} checked={draft.enabled} onChange={e => { if (e.target.checked && errors.length) { toast(errors[0]); return; } commit({ ...draft, enabled: e.target.checked }, e.target.checked ? 'Activated' : 'Paused'); }} /><span>{draft.enabled ? 'Active' : 'Paused'}</span></label>
      <span className="wb-sp" />
      <Btn sm disabled={!ed.canUndo} onClick={ed.undo} aria-label="Undo"><Icon name="undo" /></Btn><Btn sm disabled={!ed.canRedo} onClick={ed.redo} aria-label="Redo"><Icon name="redo" /></Btn>
      <div style={{ position: 'relative' }}><Btn sm onClick={() => setHist(h => !h)} aria-expanded={hist}><Icon name="history" /> History</Btn>
        {hist && <div className="wb-menu" style={{ right: 0, top: 34, width: 260, maxHeight: 280, overflow: 'auto' }} role="menu">{ed.versions.map((v, i) => <button key={v.at + i} role="menuitem" onClick={() => { commit(v.snap, `Restored “${v.label}”`); setHist(false); toast('Version restored'); }}><span className="wb-sp">{v.label}</span><span className="wb-mute wb-sm">{fmtDateTime(v.at).split(', ').pop()}</span></button>)}</div>}</div>
      <Btn sm pri={panel === 'test'} onClick={() => { setPanel(p => (p === 'test' ? 'inspect' : 'test')); setHot(null); }}><Icon name="play" /> Test</Btn>
      <span className="wb-sm wb-mute" role="status">{ed.saved ? '✓ Saved' : 'Saving…'}</span></div>
    {errors.length > 0 && <div className="wb-sm" style={{ color: 'var(--warn)' }} role="alert">{errors[0]}{errors.length > 1 && ` (+${errors.length - 1} more)`}</div>}
    <div className="wb-ed" style={{ height: 'calc(100vh - 260px)', minHeight: 480 }}>
      <FlowCanvas root={root} selectedId={sel} hotIds={hot?.ids} hotEdges={hot?.edges} onSelect={setSelected} addOptions={() => FLOW_ADD_OPTIONS}
        onAdd={(parentId, slot, kind) => { const nn = nodeForKind(kind); setFlow(insertAt(draft.flow, parentId, slot as Slot, nn), 'Added step'); setSelected(nn.id); }} />
      <aside className="wb-insp" aria-label="Inspector">
        {panel === 'test' ? <TestPanel a={draft} onRun={(ids, edges) => setHot({ ids, edges })} />
          : !node ? <><h3>Automation</h3><p className="wb-mute wb-sm">Select a node to edit it. Use + on any connector to add a condition, delay or action.</p><p className="wb-sm">{countNodes(draft.flow)} nodes · {draft.runs} runs</p></>
          : <NodeInspector n={node} isRoot={node.id === draft.flow.id} onChange={p => setFlow(updateNode(draft.flow, node.id, p), 'Edited step')} onDelete={() => { setFlow(removeNode(draft.flow, node.id), 'Removed step'); setSel(null); }} />}
      </aside></div>
    <div className="wb-row"><Btn sm dng onClick={() => { dispatch({ type: 'automation/remove', id: a.id }); onBack(); }}>Delete automation</Btn></div></div>;
}

function NodeInspector({ n, isRoot, onChange, onDelete }: { n: FlowNode; isRoot: boolean; onChange: (p: Partial<FlowNode>) => void; onDelete: () => void }) {
  const { ws } = useWb();
  const conds = n.conditions ?? [];
  const setC = (i: number, p: Partial<AutomationCondition>) => onChange({ conditions: conds.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const unit = (n.delayMinutes ?? 0) % 1440 === 0 ? 1440 : (n.delayMinutes ?? 0) % 60 === 0 ? 60 : 1; const amount = (n.delayMinutes ?? 0) / unit;
  return <div>
    <div className="wb-row" style={{ marginBottom: 10 }}><h3 style={{ margin: 0, flex: 1 }}>{n.kind === 'trigger' ? 'Trigger' : n.kind === 'condition' ? 'If / else' : n.kind === 'delay' ? 'Delay' : 'Action'}</h3>{!isRoot && <Btn sm dng onClick={onDelete} aria-label="Delete node">Delete</Btn>}</div>
    {n.kind === 'trigger' && <Field label="When">{id => <select id={id} value={n.trigger} onChange={e => onChange({ trigger: e.target.value as AutomationTrigger })}>{Object.entries(TRIGGER_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Field>}
    {n.kind === 'condition' && <>
      <p className="wb-mute wb-sm">All conditions must match to take the Yes branch.</p>
      {conds.map((c, i) => <div key={i} className="wb-grid" style={{ marginBottom: 10, gridTemplateColumns: '1fr 1fr' }}>
        <select aria-label="Field" value={c.field} onChange={e => setC(i, { field: e.target.value as AutomationCondition['field'] })}><option value="label">intent</option><option value="subject">subject</option><option value="body">reply text</option><option value="company">company</option></select>
        <select aria-label="Operator" value={c.op} onChange={e => setC(i, { op: e.target.value as AutomationCondition['op'] })}><option value="equals">is</option><option value="contains">contains</option><option value="not-contains">doesn't contain</option></select>
        <input aria-label="Value" style={{ gridColumn: '1 / 2' }} value={c.value} onChange={e => setC(i, { value: e.target.value })} placeholder={c.field === 'label' ? 'interested' : 'value'} />
        <Btn sm dng aria-label="Remove condition" onClick={() => onChange({ conditions: conds.filter((_, j) => j !== i) })}>Remove</Btn></div>)}
      <Btn sm onClick={() => onChange({ conditions: [...conds, { field: 'label', op: 'equals', value: '' }] })}>+ Condition</Btn></>}
    {n.kind === 'delay' && <div className="wb-row"><span>Wait</span><input aria-label="Delay amount" type="number" min={1} style={{ width: 80 }} value={amount} onChange={e => onChange({ delayMinutes: Math.max(1, Number(e.target.value) || 1) * unit })} />
      <select aria-label="Delay unit" style={{ width: 110 }} value={unit} onChange={e => onChange({ delayMinutes: amount * Number(e.target.value) })}><option value={1}>minutes</option><option value={60}>hours</option><option value={1440}>days</option></select></div>}
    {n.kind === 'action' && <>
      <Field label="Do">{id => <select id={id} aria-label="Action" value={n.action} onChange={e => onChange({ action: e.target.value as AutomationActionKind, value: '' })}>{Object.entries(ACTION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Field>
      {n.action && ACTION_NEEDS_VALUE[n.action] && (n.action === 'label'
        ? <Field label="Intent label">{id => <select id={id} aria-label="Action value" value={n.value ?? ''} onChange={e => onChange({ value: e.target.value })}><option value="">Choose…</option>{['interested', 'question', 'meeting-booked', 'not-interested', 'out-of-office'].map(l => <option key={l}>{l}</option>)}</select>}</Field>
        : <Field label={ACTION_NEEDS_VALUE[n.action]!}>{id => <input id={id} aria-label="Action value" value={n.value ?? ''} onChange={e => onChange({ value: e.target.value })} />}</Field>)}
      {n.action === 'create-deal' && <p className="wb-sm wb-mute">Creates a deal in “{ws.stages[0]?.name ?? 'first stage'}”.</p>}</>}
  </div>;
}

function TestPanel({ a, onRun }: { a: Automation; onRun: (ids: Set<string>, edges: Set<string>) => void }) {
  const { ws } = useWb();
  const [contactId, setContactId] = useState(ws.contacts[0]?.id ?? ''); const [text, setText] = useState('Sounds good, tell me more about pricing.');
  const [out, setOut] = useState<null | { label: string; steps: string[] }>(null);
  const run = () => {
    const contact = ws.contacts.find(c => c.id === contactId); if (!contact) return;
    const label = classifyReply(text);
    const thread = { id: 't', mailboxId: '', contactId, subject: 'Test thread', messages: [{ id: 'm', threadId: 't', direction: 'in' as const, from: contact.email, to: '', subject: '', body: text, at: '' }], unread: false, starred: false, archived: false, label, updatedAt: '' };
    const r = walkFlow(a.flow, { trigger: a.trigger, contact, thread, label });
    onRun(new Set(r.path), edgesOnPath(r.path, r.branches));
    setOut({ label, steps: r.steps.map(s => `${s.atMinutes ? `After ${formatDelay(s.atMinutes)}: ` : ''}${s.kind === 'delay' ? 'wait' : ACTION_LABEL[s.action!]}${s.value ? ` (${s.value})` : ''}`).filter(x => !x.endsWith('wait')) });
  };
  return <div><h3>Test this automation</h3><p className="wb-mute wb-sm">Dry run: nothing is changed. The path is highlighted on the canvas.</p>
    <Field label="Sample contact">{id => <select id={id} value={contactId} onChange={e => setContactId(e.target.value)}>{ws.contacts.slice(0, 40).map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} · {c.company}</option>)}</select>}</Field>
    <Field label="Sample reply">{id => <textarea id={id} value={text} onChange={e => setText(e.target.value)} />}</Field>
    <Btn pri onClick={run}>Run test</Btn>
    {out && <div style={{ marginTop: 12 }} role="status"><div className="wb-sm">Classified as <Badge tone="acc">{out.label}</Badge></div>
      {out.steps.length === 0 ? <p className="wb-sm wb-mute">No actions would run for this reply.</p> : <ol className="wb-sm" style={{ paddingLeft: 18 }}>{out.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}</div>}</div>;
}
