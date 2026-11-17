import { useCallback, useEffect, useRef, useState } from 'react';
import { useWb } from '../store';
import { Badge, Btn, Card, Field, Funnel, Icon, LineChart, Stat, Tabs, fmtDate, useConfirm } from '../kit';
import { FlowCanvas } from '../canvas/FlowCanvas';
import { STEP_OPTIONS, insertIndex, stepsToCanvas } from '../canvas/campaignFlow';
import { StepFields } from '../StepEditor';
import type { Campaign, SequenceStep } from '../../types';
import { campaignStats, estimateCompletion } from '../../domain/campaign';
import { dailySeries, funnel, pct } from '../../domain/analytics';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
let sid = 0; const newId = () => `st_${Date.now().toString(36)}${++sid}`;
const blankStep = (kind: string): SequenceStep => kind === 'wait' ? { id: newId(), kind: 'wait', waitDays: 2 } : kind === 'condition' ? { id: newId(), kind: 'condition', condition: 'opened' } : kind === 'task' ? { id: newId(), kind: 'task', taskTitle: '' } : { id: newId(), kind: 'email', subject: '', body: '' };

/** Undo/redo + debounced autosave for a campaign's editable fields. */
export function useCampaignEditor(c: Campaign) {
  const { ws, dispatch } = useWb();
  const [draft, setDraft] = useState(c);
  const past = useRef<Campaign[]>([]); const future = useRef<Campaign[]>([]);
  const [, bump] = useState(0); const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(draft); latest.current = draft;
  const wsRef = useRef(ws); wsRef.current = ws;
  useEffect(() => { setDraft(c); past.current = []; future.current = []; }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const flush = useCallback(() => {
    const live = wsRef.current.campaigns.find(x => x.id === latest.current.id) ?? latest.current;
    dispatch({ type: 'campaign/save', campaign: { ...latest.current, status: live.status } }).then(() => setSaved(true));
  }, [dispatch]);
  const commit = useCallback((next: Campaign, record = true) => {
    if (record) { past.current.push(latest.current); if (past.current.length > 50) past.current.shift(); future.current = []; }
    setDraft(next); latest.current = next; setSaved(false); bump(n => n + 1);
    clearTimeout(timer.current); timer.current = setTimeout(flush, 350);
  }, [flush]);
  useEffect(() => () => { clearTimeout(timer.current); }, []);
  const undo = () => { const p = past.current.pop(); if (!p) return; future.current.push(latest.current); commit(p, false); };
  const redo = () => { const f = future.current.pop(); if (!f) return; past.current.push(latest.current); commit(f, false); };
  return { draft, commit, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, saved };
}

export function CampaignDetail({ c, onBack }: { c: Campaign; onBack: () => void }) {
  const { ws, dispatch, toast } = useWb();
  const [tab, setTab] = useState<'overview' | 'leads' | 'steps' | 'schedule' | 'settings'>('overview');
  const ed = useCampaignEditor(c);
  const live = ws.campaigns.find(x => x.id === c.id) ?? c;
  const { confirm, el } = useConfirm();
  return <div className="wb-grid" style={{ alignContent: 'start' }}>
    <div className="wb-row"><Btn sm onClick={onBack}>← Campaigns</Btn><h2 style={{ margin: 0 }}>{ed.draft.name || 'Untitled campaign'}</h2><Badge tone={live.status === 'active' ? 'good' : live.status === 'paused' ? 'warn' : undefined}>{live.status}</Badge><span className="wb-sp" />
      {live.status === 'active' ? <Btn onClick={() => dispatch({ type: 'campaign/status', id: c.id, status: 'paused' })}>Pause</Btn> : live.status !== 'completed' && <Btn pri onClick={() => { dispatch({ type: 'campaign/status', id: c.id, status: 'active' }); toast('Campaign launched'); }}>{live.status === 'paused' ? 'Resume' : 'Launch'}</Btn>}</div>
    <Tabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'leads', label: 'Leads' }, { id: 'steps', label: 'Steps' }, { id: 'schedule', label: 'Schedule' }, { id: 'settings', label: 'Settings' }]} value={tab} onChange={setTab} />
    {tab === 'overview' && <Overview c={live} />}
    {tab === 'leads' && <Leads c={ed.draft} commit={ed.commit} />}
    {tab === 'steps' && <Steps ed={ed} />}
    {tab === 'schedule' && <Schedule c={ed.draft} commit={ed.commit} saved={ed.saved} />}
    {tab === 'settings' && <SettingsTab c={ed.draft} commit={ed.commit} saved={ed.saved} onDelete={() => confirm(`Delete "${c.name}" and its stats?`, () => { dispatch({ type: 'campaign/remove', id: c.id }); onBack(); })} />}
    {el}</div>;
}

function Overview({ c }: { c: Campaign }) {
  const { ws, adapter } = useWb(); const s = campaignStats(ws.events, c.id); const evs = ws.events.filter(e => e.campaignId === c.id);
  return <>
    <div className="wb-grid wb-g4"><Stat label="Sent" value={s.sent} /><Stat label="Open rate" value={pct(s.openRate)} sub={`${s.opened} contacts`} /><Stat label="Click rate" value={pct(s.clickRate)} /><Stat label="Reply rate" value={pct(s.replyRate)} sub={`${s.replied} contacts`} /><Stat label="Bounce rate" value={pct(s.bounceRate)} /></div>
    <div className="wb-grid wb-g2"><Card title="Daily performance"><LineChart data={dailySeries(evs, 'sent', 14, adapter.now())} /></Card><Card title="Funnel"><Funnel steps={funnel(evs)} /></Card></div>
    <Card title="Step performance"><table><thead><tr><th>Step</th><th>Sent</th><th>Opened</th><th>Clicked</th><th>Replied</th></tr></thead><tbody>
      {c.steps.filter(x => x.kind === 'email').map((st, i) => { const e = evs.filter(x => x.stepId === st.id); const n = (t: string) => e.filter(x => x.type === t).length;
        return <tr key={st.id}><td>{i === 0 ? 'Intro' : `Follow-up ${i}`}</td><td>{n('sent')}</td><td>{n('opened')}</td><td>{n('clicked')}</td><td>{n('replied')}</td></tr>; })}</tbody></table></Card>
    <Card title="Delivery plan"><span className="wb-mute">Up to {c.dailyCap} emails/day, {DAYS.filter((_, i) => c.schedule.days.includes(i)).join(', ')} {c.schedule.startHour}:00–{c.schedule.endHour}:00 ({c.schedule.timezone}). Estimated {estimateCompletion(c).days} days to complete.</span></Card></>;
}

function Leads({ c, commit }: { c: Campaign; commit: (c: Campaign) => void }) {
  const { ws } = useWb(); const [adding, setAdding] = useState(false); const [q, setQ] = useState('');
  const evs = ws.events.filter(e => e.campaignId === c.id);
  const pool = ws.contacts.filter(x => !c.contactIds.includes(x.id) && x.status !== 'unsubscribed' && x.status !== 'bounced' && (!q || `${x.firstName} ${x.lastName} ${x.email} ${x.company}`.toLowerCase().includes(q.toLowerCase())));
  return <Card title={`${c.contactIds.length} leads`} actions={<Btn sm pri onClick={() => setAdding(a => !a)}>{adding ? 'Done' : '+ Add leads'}</Btn>}>
    {adding && <div style={{ marginBottom: 12 }}><input aria-label="Search leads to add" placeholder="Search contacts…" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ maxHeight: 160, overflow: 'auto', marginTop: 6 }}>{pool.slice(0, 30).map(x => <div key={x.id} className="wb-row" style={{ padding: '4px 0' }}><span>{x.firstName} {x.lastName}</span><span className="wb-mute wb-sm">{x.company}</span><span className="wb-sp" /><Btn sm onClick={() => commit({ ...c, contactIds: [...c.contactIds, x.id] })}>Add</Btn></div>)}{pool.length === 0 && <span className="wb-mute wb-sm">No contacts available.</span>}</div></div>}
    <table><thead><tr><th>Contact</th><th>Company</th><th>Progress</th><th>Outcome</th><th /></tr></thead><tbody>
      {c.contactIds.map(id => { const ct = ws.contacts.find(x => x.id === id); if (!ct) return null; const mine = evs.filter(e => e.contactId === id); const sent = mine.filter(e => e.type === 'sent').length;
        const outcome = mine.find(e => e.type === 'replied') ? 'replied' : mine.find(e => e.type === 'bounced') ? 'bounced' : mine.find(e => e.type === 'clicked') ? 'clicked' : mine.find(e => e.type === 'opened') ? 'opened' : sent ? 'sent' : 'queued';
        return <tr key={id}><td>{ct.firstName} {ct.lastName}<div className="wb-mute wb-sm">{ct.email}</div></td><td>{ct.company}</td><td>{sent}/{c.steps.filter(x => x.kind === 'email').length}</td><td><Badge tone={outcome === 'replied' ? 'good' : outcome === 'bounced' ? 'bad' : undefined}>{outcome}</Badge></td>
          <td><Btn sm dng aria-label={`Remove ${ct.firstName}`} onClick={() => commit({ ...c, contactIds: c.contactIds.filter(x => x !== id) })}>✕</Btn></td></tr>; })}</tbody></table></Card>;
}

function Steps({ ed }: { ed: ReturnType<typeof useCampaignEditor> }) {
  const { draft: c, commit } = ed; const [sel, setSel] = useState<string | null>(null);
  const step = c.steps.find(s => s.id === sel); const idx = c.steps.findIndex(s => s.id === sel);
  const setSteps = (steps: SequenceStep[]) => commit({ ...c, steps });
  return <div className="wb-ed"><div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    <div className="wb-row" style={{ marginBottom: 8 }}>
      <label className="wb-row"><input type="checkbox" role="switch" style={{ width: 'auto' }} checked={c.stopOnReply} onChange={e => commit({ ...c, stopOnReply: e.target.checked })} /><span>Stop on reply</span></label><span className="wb-sp" />
      <Btn sm disabled={!ed.canUndo} onClick={ed.undo} aria-label="Undo"><Icon name="undo" /></Btn><Btn sm disabled={!ed.canRedo} onClick={ed.redo} aria-label="Redo"><Icon name="redo" /></Btn>
      <span className="wb-sm wb-mute" role="status">{ed.saved ? '✓ Saved' : 'Saving…'}</span></div>
    <FlowCanvas root={stepsToCanvas(c.steps)} selectedId={sel} onSelect={id => setSel(id && id !== 'start' && !id.endsWith(':exit') ? id : null)}
      addOptions={() => STEP_OPTIONS} onAdd={(parentId, _slot, kind) => { const ns = blankStep(kind); const at = insertIndex(c.steps, parentId); const next = [...c.steps]; next.splice(at, 0, ns); setSteps(next); setSel(ns.id); }} />
  </div>
  <aside className="wb-insp" aria-label="Step inspector">{!step ? <><h3>Sequence</h3><p className="wb-mute wb-sm">Select a step to edit it, or use + on the canvas to add one. Wait steps set the delay before the next email.</p></> : <>
    <div className="wb-row" style={{ marginBottom: 10 }}><h3 style={{ margin: 0, flex: 1 }}>{step.kind === 'email' ? `Email ${c.steps.slice(0, idx + 1).filter(s => s.kind === 'email').length}` : step.kind[0].toUpperCase() + step.kind.slice(1)}</h3>
      <Btn sm disabled={idx === 0} onClick={() => { const a = [...c.steps]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; setSteps(a); }} aria-label="Move step up">↑</Btn>
      <Btn sm disabled={idx === c.steps.length - 1} onClick={() => { const a = [...c.steps]; [a[idx + 1], a[idx]] = [a[idx], a[idx + 1]]; setSteps(a); }} aria-label="Move step down">↓</Btn>
      <Btn sm dng aria-label="Delete step" onClick={() => { setSteps(c.steps.filter(s => s.id !== step.id)); setSel(null); }}>Delete</Btn></div>
    <StepFields st={step} index={idx} onChange={p => setSteps(c.steps.map(s => s.id === step.id ? { ...s, ...p } : s))} /></>}</aside></div>;
}

function Schedule({ c, commit, saved }: { c: Campaign; commit: (c: Campaign) => void; saved: boolean }) {
  const tog = (i: number) => commit({ ...c, schedule: { ...c.schedule, days: c.schedule.days.includes(i) ? c.schedule.days.filter(d => d !== i) : [...c.schedule.days, i].sort() } });
  return <Card title="Sending schedule" actions={<span className="wb-sm wb-mute" role="status">{saved ? '✓ Saved' : 'Saving…'}</span>}>
    <div className="wb-row wrap" style={{ marginBottom: 10 }}>{DAYS.map((d, i) => <Btn key={d} sm pri={c.schedule.days.includes(i)} onClick={() => tog(i)}>{d}</Btn>)}</div>
    <div className="wb-grid wb-g2"><Field label="Start hour">{id => <input id={id} type="number" min={0} max={23} value={c.schedule.startHour} onChange={e => commit({ ...c, schedule: { ...c.schedule, startHour: Number(e.target.value) } })} />}</Field>
      <Field label="End hour">{id => <input id={id} type="number" min={1} max={24} value={c.schedule.endHour} onChange={e => commit({ ...c, schedule: { ...c.schedule, endHour: Number(e.target.value) } })} />}</Field>
      <Field label="Time zone">{id => <input id={id} value={c.schedule.timezone} onChange={e => commit({ ...c, schedule: { ...c.schedule, timezone: e.target.value } })} />}</Field>
      <Field label="Max emails per day">{id => <input id={id} type="number" min={1} value={c.dailyCap} onChange={e => commit({ ...c, dailyCap: Math.max(1, Number(e.target.value) || 1) })} />}</Field></div>
    {c.schedule.endHour <= c.schedule.startHour && <p className="wb-sm" style={{ color: 'var(--bad)' }}>The window must end after it starts.</p>}
    <p className="wb-mute wb-sm">Estimated completion: ~{estimateCompletion(c).days} days.</p></Card>;
}

function SettingsTab({ c, commit, saved, onDelete }: { c: Campaign; commit: (c: Campaign) => void; saved: boolean; onDelete: () => void }) {
  const { ws } = useWb();
  return <div className="wb-grid"><Card title="Campaign settings" actions={<span className="wb-sm wb-mute" role="status">{saved ? '✓ Saved' : 'Saving…'}</span>}>
    <Field label="Name">{id => <input id={id} value={c.name} onChange={e => commit({ ...c, name: e.target.value })} />}</Field>
    {([['trackOpens', 'Track opens'], ['trackClicks', 'Track link clicks'], ['stopOnReply', 'Stop sequence when a contact replies']] as const).map(([k, l]) => <label key={k} className="wb-row" style={{ marginBottom: 6 }}><input type="checkbox" style={{ width: 'auto' }} checked={c[k]} onChange={e => commit({ ...c, [k]: e.target.checked })} /><span>{l}</span></label>)}</Card>
    <Card title="Sending mailboxes">{ws.mailboxes.map(m => <label key={m.id} className="wb-row" style={{ marginBottom: 6 }}><input type="checkbox" style={{ width: 'auto' }} checked={c.mailboxIds.includes(m.id)} onChange={() => commit({ ...c, mailboxIds: c.mailboxIds.includes(m.id) ? c.mailboxIds.filter(x => x !== m.id) : [...c.mailboxIds, m.id] })} /><span>{m.email}</span><Badge tone={m.health >= 75 ? 'good' : 'warn'}>health {m.health}</Badge></label>)}</Card>
    <Card title="Danger zone"><div className="wb-row"><span className="wb-mute">Created {fmtDate(c.createdAt)}</span><span className="wb-sp" /><Btn dng onClick={onDelete}>Delete campaign</Btn></div></Card></div>;
}
