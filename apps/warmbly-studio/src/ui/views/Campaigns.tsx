import { useMemo, useState } from 'react';
import { useWb } from '../store';
import { Badge, Btn, Card, Empty, Field, Modal, Tabs, fmtDate, useConfirm } from '../kit';
import { CampaignDetail } from './CampaignDetail';
import { StepFields } from '../StepEditor';
import type { Campaign, SequenceStep } from '../../types';
import { campaignStats, estimateCompletion, validateCampaign } from '../../domain/campaign';
import { contactVars, extractVariables, renderEmail, spamCheck } from '../../domain/template';
import { pct } from '../../domain/analytics';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
let sid = 0; const newId = () => `st_${Date.now().toString(36)}${++sid}`;
export const blankCampaign = (): Campaign => ({ id: '', name: '', status: 'draft', mailboxIds: [], contactIds: [], steps: [{ id: newId(), kind: 'email', subject: '', body: '' }],
  schedule: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, timezone: 'America/New_York' }, stopOnReply: true, trackOpens: true, trackClicks: true, dailyCap: 30, createdAt: new Date().toISOString() });

export function Campaigns() {
  const { ws, dispatch, toast, arg, nav } = useWb();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const { confirm, el } = useConfirm();
  const open = ws.campaigns.find(c => c.id === arg);
  if (open) return <CampaignDetail key={open.id} c={open} onBack={() => nav('campaigns')} />;
  return <div className="wb-grid">
    <div className="wb-row"><span className="wb-mute">{ws.campaigns.length} campaigns</span><span className="wb-sp" /><Btn pri onClick={() => setEditing(blankCampaign())}>+ New campaign</Btn></div>
    {ws.campaigns.length === 0 ? <Empty>No campaigns yet. Create a multi-step sequence to start reaching out.</Empty> : <Card><table><thead><tr><th>Campaign</th><th>Status</th><th>Contacts</th><th>Sent</th><th>Opens</th><th>Replies</th><th /></tr></thead><tbody>
      {ws.campaigns.map(c => { const s = campaignStats(ws.events, c.id); return <tr key={c.id} className="click" onClick={() => nav('campaigns', c.id)}>
        <td><b>{c.name}</b><div className="wb-mute wb-sm">{c.steps.filter(x => x.kind === 'email').length} emails · created {fmtDate(c.createdAt)}</div></td>
        <td><Badge tone={c.status === 'active' ? 'good' : c.status === 'paused' ? 'warn' : c.status === 'completed' ? 'acc' : undefined}>{c.status}</Badge></td>
        <td>{c.contactIds.length}</td><td>{s.sent}</td><td>{pct(s.openRate, 0)}</td><td>{pct(s.replyRate, 0)}</td>
        <td onClick={e => e.stopPropagation()}><div className="wb-row">
          {(c.status === 'draft' || c.status === 'paused') && <Btn sm pri onClick={() => { const errs = validateCampaign(c, ws.mailboxes); if (errs.length) { toast(errs[0]); return; } dispatch({ type: 'campaign/status', id: c.id, status: 'active' }); toast('Campaign launched'); }}>Launch</Btn>}
          {c.status === 'active' && <Btn sm onClick={() => dispatch({ type: 'campaign/status', id: c.id, status: 'paused' })}>Pause</Btn>}
          <Btn sm onClick={() => dispatch({ type: 'campaign/duplicate', id: c.id })}>Duplicate</Btn>
          <Btn sm dng onClick={() => confirm(`Delete "${c.name}" and its stats?`, () => dispatch({ type: 'campaign/remove', id: c.id }))}>Delete</Btn></div></td></tr>; })}
    </tbody></table></Card>}
    {editing && <Builder initial={editing} onClose={() => setEditing(null)} />}{el}
  </div>;
}

function Builder({ initial, onClose }: { initial: Campaign; onClose: () => void }) {
  const { ws, dispatch, toast } = useWb();
  const [c, setC] = useState<Campaign>(initial);
  const [tab, setTab] = useState<'steps' | 'audience' | 'schedule' | 'preview'>('steps');
  const [previewContact, setPreviewContact] = useState(c.contactIds[0] ?? ws.contacts[0]?.id);
  const set = (p: Partial<Campaign>) => setC(x => ({ ...x, ...p }));
  const setStep = (id: string, p: Partial<SequenceStep>) => set({ steps: c.steps.map(s => s.id === id ? { ...s, ...p } : s) });
  const move = (i: number, d: number) => { const a = [...c.steps]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set({ steps: a }); };
  const errors = useMemo(() => validateCampaign(c, ws.mailboxes), [c, ws.mailboxes]);
  const save = (launch: boolean) => { dispatch({ type: 'campaign/save', campaign: { ...c, status: launch ? 'active' : c.status } }); toast(launch ? 'Campaign launched' : 'Campaign saved'); onClose(); };
  const toggle = (arr: string[], id: string) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
  const pc = ws.contacts.find(x => x.id === previewContact);
  const firstEmail = c.steps.find(s => s.kind === 'email');
  const rendered = pc && firstEmail ? renderEmail({ subject: firstEmail.subject ?? '', body: (firstEmail.body ?? '').replace('{{sender}}', ws.settings.signature.split('\n')[0]) }, pc, () => 0) : null;
  const spam = firstEmail ? spamCheck(firstEmail.subject ?? '', firstEmail.body ?? '') : null;
  const vars = new Set(Object.keys(pc ? contactVars(pc) : {}).concat('sender'));
  const unknownVars = [...new Set(c.steps.flatMap(s => extractVariables(`${s.subject ?? ''} ${s.body ?? ''}`)))].filter(v => !vars.has(v));
  return <Modal title={c.id ? 'Edit campaign' : 'New campaign'} onClose={onClose} footer={<>
    {errors.length > 0 && <span className="wb-sm wb-mute" style={{ marginRight: 'auto' }}>{errors[0]}{errors.length > 1 && ` (+${errors.length - 1} more)`}</span>}
    <Btn onClick={onClose}>Cancel</Btn><Btn disabled={!c.name.trim()} onClick={() => save(false)}>Save draft</Btn><Btn pri disabled={errors.length > 0} onClick={() => save(true)}>Save & launch</Btn></>}>
    <Field label="Campaign name">{id => <input id={id} value={c.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Q1 founders outreach" />}</Field>
    <Tabs tabs={[{ id: 'steps', label: 'Sequence' }, { id: 'audience', label: 'Audience & mailboxes' }, { id: 'schedule', label: 'Schedule' }, { id: 'preview', label: 'Preview' }]} value={tab} onChange={setTab} />
    {tab === 'steps' && <>
      {c.steps.map((s, i) => <div className="wb-step" key={s.id}><div className="n">{i + 1}</div><div className="box">
        <div className="wb-row" style={{ marginBottom: 8 }}>
          <select aria-label={`Step ${i + 1} type`} style={{ width: 130 }} value={s.kind} onChange={e => setStep(s.id, { kind: e.target.value as SequenceStep['kind'] })}><option value="email">Email</option><option value="wait">Wait</option><option value="condition">Condition</option><option value="task">Task</option></select>
          <span className="wb-sp" /><Btn sm onClick={() => move(i, -1)} aria-label="Move up">↑</Btn><Btn sm onClick={() => move(i, 1)} aria-label="Move down">↓</Btn><Btn sm dng onClick={() => set({ steps: c.steps.filter(x => x.id !== s.id) })} aria-label="Remove step">✕</Btn></div>
        {s.kind === 'email' && <><input aria-label={`Step ${i + 1} subject`} placeholder={i === 0 ? 'Subject (spintax {a|b} and {{variables}} supported)' : 'Subject (leave empty to reply in thread)'} value={s.subject ?? ''} onChange={e => setStep(s.id, { subject: e.target.value })} style={{ marginBottom: 6 }} />
          <textarea aria-label={`Step ${i + 1} body`} placeholder="Hi {{firstName | there}}, …" value={s.body ?? ''} onChange={e => setStep(s.id, { body: e.target.value })} />
          <div className="wb-row wb-sm" style={{ marginTop: 6 }}><span className="wb-mute">Insert:</span>{['firstName', 'company', 'title', 'sender'].map(v => <Btn key={v} sm onClick={() => setStep(s.id, { body: `${s.body ?? ''}{{${v}}}` })}>{v}</Btn>)}
            <span className="wb-sp" /><select aria-label="Apply template" style={{ width: 150 }} value="" onChange={e => { const t = ws.templates.find(x => x.id === e.target.value); if (t) setStep(s.id, { subject: t.subject, body: t.body }); }}><option value="">Apply template…</option>{ws.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div></>}
        {s.kind === 'wait' && <div className="wb-row"><span>Wait</span><input aria-label="Wait days" type="number" min={1} style={{ width: 80 }} value={s.waitDays ?? 1} onChange={e => setStep(s.id, { waitDays: Math.max(1, Number(e.target.value) || 1) })} /><span>days</span></div>}
        {s.kind === 'condition' && <div className="wb-row"><span>Continue only if contact</span><select aria-label="Negate" style={{ width: 100 }} value={s.negate ? 'not' : 'has'} onChange={e => setStep(s.id, { negate: e.target.value === 'not' })}><option value="has">has</option><option value="not">has not</option></select>
          <select aria-label="Condition" style={{ width: 110 }} value={s.condition ?? 'opened'} onChange={e => setStep(s.id, { condition: e.target.value as SequenceStep['condition'] })}><option value="opened">opened</option><option value="clicked">clicked</option><option value="replied">replied</option></select></div>}
        {s.kind === 'task' && <input aria-label="Task title" placeholder="Task title" value={s.taskTitle ?? ''} onChange={e => setStep(s.id, { taskTitle: e.target.value })} />}
      </div></div>)}
      <div className="wb-row"><Btn onClick={() => set({ steps: [...c.steps, { id: newId(), kind: 'email', subject: '', body: '' }] })}>+ Email</Btn><Btn onClick={() => set({ steps: [...c.steps, { id: newId(), kind: 'wait', waitDays: 3 }] })}>+ Wait</Btn><Btn onClick={() => set({ steps: [...c.steps, { id: newId(), kind: 'condition', condition: 'opened' }] })}>+ Condition</Btn></div></>}
    {tab === 'audience' && <>
      <p><b>Mailboxes</b> <span className="wb-mute wb-sm">(emails rotate across the selected mailboxes)</span></p>
      {ws.mailboxes.map(m => <label key={m.id} className="wb-row" style={{ marginBottom: 6 }}><input type="checkbox" style={{ width: 'auto' }} checked={c.mailboxIds.includes(m.id)} onChange={() => set({ mailboxIds: toggle(c.mailboxIds, m.id) })} /><span>{m.email}</span><Badge tone={m.health >= 75 ? 'good' : 'warn'}>health {m.health}</Badge></label>)}
      <div className="wb-row" style={{ margin: '14px 0 6px' }}><b>Contacts</b><span className="wb-mute wb-sm">{c.contactIds.length} selected</span><span className="wb-sp" />
        <Btn sm onClick={() => set({ contactIds: ws.contacts.filter(x => x.status !== 'unsubscribed' && x.status !== 'bounced').map(x => x.id) })}>Select all eligible</Btn><Btn sm onClick={() => set({ contactIds: [] })}>Clear</Btn></div>
      <div style={{ maxHeight: 220, overflow: 'auto' }}>{ws.contacts.map(ct => { const blocked = ct.status === 'unsubscribed' || ct.status === 'bounced'; return <label key={ct.id} className="wb-row" style={{ marginBottom: 4, opacity: blocked ? .5 : 1 }}>
        <input type="checkbox" style={{ width: 'auto' }} disabled={blocked} checked={c.contactIds.includes(ct.id)} onChange={() => set({ contactIds: toggle(c.contactIds, ct.id) })} /><span>{ct.firstName} {ct.lastName}</span><span className="wb-mute wb-sm">{ct.company}</span>{blocked && <Badge tone="bad">{ct.status}</Badge>}</label>; })}</div></>}
    {tab === 'schedule' && <>
      <div className="wb-row wrap" style={{ marginBottom: 10 }}>{DAYS.map((d, i) => <Btn key={d} sm pri={c.schedule.days.includes(i)} onClick={() => set({ schedule: { ...c.schedule, days: toggle(c.schedule.days.map(String), String(i)).map(Number) } })}>{d}</Btn>)}</div>
      <div className="wb-grid wb-g2"><Field label="Start hour">{id => <input id={id} type="number" min={0} max={23} value={c.schedule.startHour} onChange={e => set({ schedule: { ...c.schedule, startHour: Number(e.target.value) } })} />}</Field>
        <Field label="End hour">{id => <input id={id} type="number" min={1} max={24} value={c.schedule.endHour} onChange={e => set({ schedule: { ...c.schedule, endHour: Number(e.target.value) } })} />}</Field></div>
      <Field label="Max emails per day (campaign)">{id => <input id={id} type="number" min={1} value={c.dailyCap} onChange={e => set({ dailyCap: Math.max(1, Number(e.target.value) || 1) })} />}</Field>
      {[['stopOnReply', 'Stop sequence when a contact replies'], ['trackOpens', 'Track opens'], ['trackClicks', 'Track link clicks']].map(([k, l]) => <label key={k} className="wb-row" style={{ marginBottom: 6 }}><input type="checkbox" style={{ width: 'auto' }} checked={c[k as 'stopOnReply']} onChange={e => set({ [k]: e.target.checked } as Partial<Campaign>)} /><span>{l}</span></label>)}
      <p className="wb-mute wb-sm">Estimated completion: ~{estimateCompletion(c).days} days.</p></>}
    {tab === 'preview' && <>
      {ws.contacts.length === 0 ? <span className="wb-mute">Add contacts to preview.</span> : <>
        <Field label="Preview as">{id => <select id={id} value={previewContact} onChange={e => setPreviewContact(e.target.value)}>{ws.contacts.slice(0, 50).map(x => <option key={x.id} value={x.id}>{x.firstName} {x.lastName} · {x.company}</option>)}</select>}</Field>
        {rendered && <div className="wb-msg"><b>{rendered.subject || '(no subject)'}</b>{'\n\n'}{rendered.body}</div>}
        {rendered && rendered.missing.length > 0 && <p className="wb-sm" style={{ color: 'var(--warn)' }}>Missing values for: {rendered.missing.join(', ')}. Add a fallback like {'{{name | there}}'}.</p>}
        {unknownVars.length > 0 && <p className="wb-sm" style={{ color: 'var(--warn)' }}>Unknown variables: {unknownVars.join(', ')}</p>}
        {spam && <div className="wb-row"><b>Spam check</b><Badge tone={spam.score < 20 ? 'good' : spam.score < 40 ? 'warn' : 'bad'}>{spam.score}/100</Badge></div>}
        {spam?.issues.map(i => <div key={i} className="wb-sm wb-mute">• {i}</div>)}</>}</>}
  </Modal>;
}
