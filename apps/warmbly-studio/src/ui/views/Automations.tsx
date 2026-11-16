import { useState } from 'react';
import { useWb } from '../store';
import { Badge, Btn, Card, Empty, Field, Modal, useConfirm } from '../kit';
import type { Automation, AutomationAction, AutomationCondition, AutomationTrigger } from '../../types';
import { ACTION_LABEL, TRIGGER_LABEL } from '../../domain/automation';

const NEEDS_VALUE: Record<string, string> = { label: 'Label (interested, question, …)', tag: 'Tag name', 'create-task': 'Task title', 'create-deal': 'Deal value ($)' };
let n = 0; const aid = () => `a_${Date.now().toString(36)}${++n}`;
const blank = (): Automation => ({ id: '', name: '', enabled: true, trigger: 'reply-received', conditions: [], actions: [{ id: aid(), kind: 'label', value: 'interested' }], runs: 0, createdAt: new Date().toISOString() });

export function Automations() {
  const { ws, dispatch } = useWb(); const [edit, setEdit] = useState<Automation | null>(null); const { confirm, el } = useConfirm();
  return <div className="wb-grid">
    <div className="wb-row"><span className="wb-mute">Playbooks run automatically when something happens in a campaign or inbox.</span><span className="wb-sp" /><Btn pri onClick={() => setEdit(blank())}>+ New playbook</Btn></div>
    {ws.automations.length === 0 ? <Empty>No playbooks yet.</Empty> : ws.automations.map(a => <Card key={a.id}>
      <div className="wb-row wrap"><b>{a.name}</b><Badge tone={a.enabled ? 'good' : undefined}>{a.enabled ? 'on' : 'off'}</Badge><span className="wb-mute wb-sm">{a.runs} runs</span><span className="wb-sp" />
        <Btn sm onClick={() => dispatch({ type: 'automation/toggle', id: a.id })}>{a.enabled ? 'Disable' : 'Enable'}</Btn><Btn sm onClick={() => setEdit(a)}>Edit</Btn><Btn sm dng onClick={() => confirm(`Delete "${a.name}"?`, () => dispatch({ type: 'automation/remove', id: a.id }))}>Delete</Btn></div>
      <Flow a={a} /></Card>)}
    {edit && <Editor a={edit} onClose={() => setEdit(null)} />}{el}</div>;
}

function Flow({ a }: { a: Automation }) {
  return <div className="wb-flow" style={{ marginTop: 10 }} aria-label={`Flow for ${a.name}`}>
    <div className="wb-node trig"><span className="wb-mute wb-sm">WHEN</span><br />{TRIGGER_LABEL[a.trigger]}</div>
    {a.conditions.length > 0 && <><div className="wb-link" /><div className="wb-node"><span className="wb-mute wb-sm">IF</span><br />{a.conditions.map((c, i) => <div key={i}>{c.field} {c.op.replace('-', ' ')} “{c.value}”</div>)}</div></>}
    {a.actions.map(x => <div key={x.id} className="wb-flow"><div className="wb-link" /><div className="wb-node"><span className="wb-mute wb-sm">THEN</span><br />{ACTION_LABEL[x.kind]}{x.value ? `: ${x.value}` : ''}</div></div>)}</div>;
}

function Editor({ a, onClose }: { a: Automation; onClose: () => void }) {
  const { dispatch, toast } = useWb(); const [x, setX] = useState(a); const set = (p: Partial<Automation>) => setX(v => ({ ...v, ...p }));
  const setAct = (id: string, p: Partial<AutomationAction>) => set({ actions: x.actions.map(y => y.id === id ? { ...y, ...p } : y) });
  const setCond = (i: number, p: Partial<AutomationCondition>) => set({ conditions: x.conditions.map((c, j) => j === i ? { ...c, ...p } : c) });
  return <Modal title={a.id ? 'Edit playbook' : 'New playbook'} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn pri disabled={!x.name.trim() || !x.actions.length} onClick={() => { dispatch({ type: 'automation/save', automation: x }); toast('Playbook saved'); onClose(); }}>Save</Btn></>}>
    <Field label="Name">{id => <input id={id} value={x.name} onChange={e => set({ name: e.target.value })} />}</Field>
    <Field label="When">{id => <select id={id} value={x.trigger} onChange={e => set({ trigger: e.target.value as AutomationTrigger })}>{Object.entries(TRIGGER_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Field>
    <div className="wb-row" style={{ margin: '6px 0' }}><b>Conditions</b><span className="wb-mute wb-sm">(all must match)</span><span className="wb-sp" /><Btn sm onClick={() => set({ conditions: [...x.conditions, { field: 'label', op: 'equals', value: '' }] })}>+ Condition</Btn></div>
    {x.conditions.map((c, i) => <div key={i} className="wb-row" style={{ marginBottom: 6 }}>
      <select aria-label="Field" style={{ width: 110 }} value={c.field} onChange={e => setCond(i, { field: e.target.value as AutomationCondition['field'] })}><option value="label">label</option><option value="subject">subject</option><option value="body">reply text</option><option value="company">company</option></select>
      <select aria-label="Operator" style={{ width: 130 }} value={c.op} onChange={e => setCond(i, { op: e.target.value as AutomationCondition['op'] })}><option value="equals">equals</option><option value="contains">contains</option><option value="not-contains">doesn't contain</option></select>
      <input aria-label="Value" value={c.value} onChange={e => setCond(i, { value: e.target.value })} /><Btn sm dng aria-label="Remove condition" onClick={() => set({ conditions: x.conditions.filter((_, j) => j !== i) })}>✕</Btn></div>)}
    <div className="wb-row" style={{ margin: '10px 0 6px' }}><b>Actions</b><span className="wb-sp" /><Btn sm onClick={() => set({ actions: [...x.actions, { id: aid(), kind: 'tag', value: '' }] })}>+ Action</Btn></div>
    {x.actions.map(y => <div key={y.id} className="wb-row" style={{ marginBottom: 6 }}>
      <select aria-label="Action" style={{ width: 230 }} value={y.kind} onChange={e => setAct(y.id, { kind: e.target.value as AutomationAction['kind'], value: '' })}>{Object.entries(ACTION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      {NEEDS_VALUE[y.kind] ? <input aria-label="Action value" placeholder={NEEDS_VALUE[y.kind]} value={y.value ?? ''} onChange={e => setAct(y.id, { value: e.target.value })} /> : <span className="wb-sp" />}
      <Btn sm dng aria-label="Remove action" onClick={() => set({ actions: x.actions.filter(z => z.id !== y.id) })}>✕</Btn></div>)}
    <div style={{ marginTop: 10 }}><Flow a={x} /></div></Modal>;
}
