import { useState } from 'react';
import { useWb } from '../store';
import { Badge, Btn, Card, Field, Modal, Tabs, fmtDate, fmtDateTime, money } from '../kit';
import type { Deal, Meeting, Task } from '../../types';
import { pipelineValue } from '../../domain/analytics';

export function Pipeline() {
  const [tab, setTab] = useState<'deals' | 'tasks' | 'meetings'>('deals');
  return <div><Tabs tabs={[{ id: 'deals', label: 'Deals' }, { id: 'tasks', label: 'Tasks' }, { id: 'meetings', label: 'Meetings' }]} value={tab} onChange={setTab} />
    {tab === 'deals' ? <Deals /> : tab === 'tasks' ? <Tasks /> : <Meetings />}</div>;
}

function Deals() {
  const { ws, dispatch } = useWb();
  const [over, setOver] = useState<string | null>(null); const [edit, setEdit] = useState<Deal | null>(null);
  const pv = pipelineValue(ws.deals);
  const blank = (): Deal => ({ id: '', title: '', contactId: ws.contacts[0]?.id ?? '', stageId: ws.stages[0]?.id ?? '', value: 0, status: 'open', createdAt: new Date().toISOString() });
  const weighted = ws.deals.filter(d => d.status === 'open').reduce((s, d) => s + d.value * (ws.stages.find(x => x.id === d.stageId)?.probability ?? 0) / 100, 0);
  return <div className="wb-grid">
    <div className="wb-row"><Badge tone="acc">Open {money(pv.open)}</Badge><Badge tone="good">Won {money(pv.won)}</Badge><Badge>Weighted {money(Math.round(weighted))}</Badge><span className="wb-sp" /><Btn pri onClick={() => setEdit(blank())}>+ Deal</Btn></div>
    <div className="wb-kan">{ws.stages.map(st => { const ds = ws.deals.filter(d => d.stageId === st.id && d.status === 'open');
      return <div key={st.id} className={`wb-col${over === st.id ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(st.id); }} onDragLeave={() => setOver(null)}
        onDrop={e => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); if (id) dispatch({ type: 'deal/move', id, stageId: st.id }); }}>
        <div className="wb-row" style={{ marginBottom: 8 }}><b>{st.name}</b><span className="wb-mute wb-sm">{st.probability}%</span><span className="wb-sp" /><span className="wb-mute wb-sm">{money(ds.reduce((s, d) => s + d.value, 0))}</span></div>
        {ds.map(d => { const c = ws.contacts.find(x => x.id === d.contactId); return <div key={d.id} className="wb-deal" draggable onDragStart={e => e.dataTransfer.setData('text/plain', d.id)} onClick={() => setEdit(d)}>
          <b>{d.title}</b><div className="wb-mute wb-sm">{c?.firstName} {c?.lastName} · {c?.company}</div><div className="wb-row" style={{ marginTop: 4 }}><b>{money(d.value)}</b>{d.closeDate && <span className="wb-mute wb-sm">close {fmtDate(d.closeDate)}</span>}</div>
          <div className="wb-row" style={{ marginTop: 6 }}><select aria-label={`Move ${d.title}`} className="wb-sm" style={{ padding: '2px 4px' }} value={st.id} onClick={e => e.stopPropagation()} onChange={e => dispatch({ type: 'deal/move', id: d.id, stageId: e.target.value })}>{ws.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div>; })}
      </div>; })}</div>
    <Card title="Closed">{ws.deals.filter(d => d.status !== 'open').length === 0 ? <span className="wb-mute">No closed deals.</span> : ws.deals.filter(d => d.status !== 'open').map(d => <div key={d.id} className="wb-row" style={{ marginBottom: 4 }}><span>{d.title}</span><Badge tone={d.status === 'won' ? 'good' : 'bad'}>{d.status}</Badge><span className="wb-sp" /><b>{money(d.value)}</b><Btn sm onClick={() => dispatch({ type: 'deal/close', id: d.id, status: 'open' })}>Reopen</Btn></div>)}</Card>
    {edit && <DealForm d={edit} onClose={() => setEdit(null)} />}
  </div>;
}
function DealForm({ d, onClose }: { d: Deal; onClose: () => void }) {
  const { ws, dispatch, toast } = useWb(); const [x, setX] = useState(d); const set = (p: Partial<Deal>) => setX(v => ({ ...v, ...p }));
  return <Modal title={d.id ? 'Edit deal' : 'New deal'} onClose={onClose} footer={<>
    {d.id && <><Btn dng onClick={() => { dispatch({ type: 'deal/remove', id: d.id }); onClose(); }}>Delete</Btn><Btn onClick={() => { dispatch({ type: 'deal/close', id: d.id, status: 'lost' }); onClose(); }}>Mark lost</Btn><Btn onClick={() => { dispatch({ type: 'deal/close', id: d.id, status: 'won' }); toast('Deal won 🎉'); onClose(); }}>Mark won</Btn></>}
    <Btn onClick={onClose}>Cancel</Btn><Btn pri disabled={!x.title.trim() || !x.contactId} onClick={() => { dispatch({ type: 'deal/save', deal: x }); onClose(); }}>Save</Btn></>}>
    <Field label="Title">{id => <input id={id} value={x.title} onChange={e => set({ title: e.target.value })} />}</Field>
    <div className="wb-grid wb-g2"><Field label="Contact">{id => <select id={id} value={x.contactId} onChange={e => set({ contactId: e.target.value })}>{ws.contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} · {c.company}</option>)}</select>}</Field>
      <Field label="Stage">{id => <select id={id} value={x.stageId} onChange={e => set({ stageId: e.target.value })}>{ws.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}</Field>
      <Field label="Value ($)">{id => <input id={id} type="number" min={0} value={x.value} onChange={e => set({ value: Math.max(0, Number(e.target.value) || 0) })} />}</Field>
      <Field label="Expected close">{id => <input id={id} type="date" value={x.closeDate?.slice(0, 10) ?? ''} onChange={e => set({ closeDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />}</Field></div>
  </Modal>;
}

function Tasks() {
  const { ws, dispatch, adapter } = useWb(); const [title, setTitle] = useState(''); const [due, setDue] = useState('');
  const sorted = [...ws.tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? 'z').localeCompare(b.due ?? 'z'));
  const overdue = (t: Task) => !t.done && t.due && t.due < adapter.now().toISOString();
  return <Card><div className="wb-row" style={{ marginBottom: 10 }}><input aria-label="New task" placeholder="New task…" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && title.trim()) { dispatch({ type: 'task/save', task: { id: '', title, due: due ? new Date(due).toISOString() : undefined, done: false } }); setTitle(''); } }} />
    <input aria-label="Due date" type="date" style={{ width: 160 }} value={due} onChange={e => setDue(e.target.value)} />
    <Btn pri disabled={!title.trim()} onClick={() => { dispatch({ type: 'task/save', task: { id: '', title, due: due ? new Date(due).toISOString() : undefined, done: false } }); setTitle(''); setDue(''); }}>Add</Btn></div>
    {sorted.map(t => { const c = ws.contacts.find(x => x.id === t.contactId); return <div key={t.id} className="wb-row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
      <input aria-label={`Complete ${t.title}`} type="checkbox" style={{ width: 'auto' }} checked={t.done} onChange={() => dispatch({ type: 'task/toggle', id: t.id })} />
      <span style={{ textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? .5 : 1 }}>{t.title}</span>{c && <span className="wb-mute wb-sm">{c.firstName} {c.lastName}</span>}<span className="wb-sp" />
      {overdue(t) && <Badge tone="bad">overdue</Badge>}<span className="wb-mute wb-sm">{t.due && fmtDate(t.due)}</span><Btn sm dng aria-label={`Delete ${t.title}`} onClick={() => dispatch({ type: 'task/remove', id: t.id })}>✕</Btn></div>; })}</Card>;
}

function Meetings() {
  const { ws, dispatch, toast, adapter } = useWb(); const [edit, setEdit] = useState<Meeting | null>(null);
  const sorted = [...ws.meetings].sort((a, b) => a.at.localeCompare(b.at));
  return <div className="wb-grid"><div className="wb-row"><span className="wb-sp" /><Btn pri onClick={() => setEdit({ id: '', title: '', contactId: ws.contacts[0]?.id ?? '', at: new Date(adapter.now().getTime() + 86_400_000).toISOString(), durationMin: 30 })}>+ Meeting</Btn></div>
    <Card>{sorted.length === 0 ? <span className="wb-mute">No meetings.</span> : sorted.map(m => { const c = ws.contacts.find(x => x.id === m.contactId); return <div key={m.id} className="wb-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <div><b>{m.title}</b><div className="wb-mute wb-sm">{c?.firstName} {c?.lastName} · {c?.company}</div></div><span className="wb-sp" /><span>{fmtDateTime(m.at)} · {m.durationMin}m</span><Btn sm onClick={() => setEdit(m)}>Edit</Btn><Btn sm dng onClick={() => dispatch({ type: 'meeting/remove', id: m.id })}>✕</Btn></div>; })}</Card>
    {edit && <Modal title={edit.id ? 'Edit meeting' : 'New meeting'} onClose={() => setEdit(null)} footer={<><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn pri disabled={!edit.title.trim()} onClick={() => { dispatch({ type: 'meeting/save', meeting: edit }); toast('Meeting saved'); setEdit(null); }}>Save</Btn></>}>
      <Field label="Title">{id => <input id={id} value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} />}</Field>
      <Field label="Contact">{id => <select id={id} value={edit.contactId} onChange={e => setEdit({ ...edit, contactId: e.target.value })}>{ws.contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select>}</Field>
      <div className="wb-grid wb-g2"><Field label="When">{id => <input id={id} type="datetime-local" value={new Date(new Date(edit.at).getTime() - new Date(edit.at).getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={e => e.target.value && setEdit({ ...edit, at: new Date(e.target.value).toISOString() })} />}</Field>
        <Field label="Minutes">{id => <input id={id} type="number" min={5} step={5} value={edit.durationMin} onChange={e => setEdit({ ...edit, durationMin: Math.max(5, Number(e.target.value) || 30) })} />}</Field></div></Modal>}</div>;
}
