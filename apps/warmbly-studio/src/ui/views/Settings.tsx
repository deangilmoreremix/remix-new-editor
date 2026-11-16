import { useState } from 'react';
import { useWb } from '../store';
import { Badge, Btn, Card, Field, Tabs, useConfirm } from '../kit';
import type { Template } from '../../types';
import { spamCheck } from '../../domain/template';

export function Settings() {
  const [tab, setTab] = useState<'workspace' | 'team' | 'templates'>('workspace');
  return <div><Tabs tabs={[{ id: 'workspace', label: 'Workspace' }, { id: 'team', label: 'Team' }, { id: 'templates', label: 'Templates' }]} value={tab} onChange={setTab} />
    {tab === 'workspace' ? <WorkspaceTab /> : tab === 'team' ? <TeamTab /> : <TemplatesTab />}</div>;
}
function WorkspaceTab() {
  const { ws, dispatch, adapter, toast } = useWb(); const s = ws.settings; const { confirm, el } = useConfirm();
  const up = (patch: Partial<typeof s>) => dispatch({ type: 'settings/update', patch });
  return <div className="wb-grid"><Card title="Workspace">
    <Field label="Workspace name">{id => <input id={id} value={s.workspaceName} onChange={e => up({ workspaceName: e.target.value })} />}</Field>
    <Field label="Time zone">{id => <input id={id} value={s.timezone} onChange={e => up({ timezone: e.target.value })} />}</Field>
    <Field label="Tracking domain">{id => <input id={id} value={s.trackingDomain} onChange={e => up({ trackingDomain: e.target.value })} />}</Field>
    <Field label="Unsubscribe footer">{id => <textarea id={id} value={s.unsubscribeFooter} onChange={e => up({ unsubscribeFooter: e.target.value })} />}</Field>
    <Field label="Signature">{id => <textarea id={id} value={s.signature} onChange={e => up({ signature: e.target.value })} />}</Field></Card>
    {adapter.reset && <Card title="Demo data"><p className="wb-mute">This studio runs on a local sandbox until the Warmbly backend is connected.</p><Btn dng onClick={() => confirm('Reset all data to the demo workspace?', async () => { await adapter.reset?.(); toast('Workspace reset'); })}>Reset demo workspace</Btn></Card>}{el}</div>;
}
function TeamTab() {
  const { ws, dispatch, toast } = useWb(); const [email, setEmail] = useState(''); const [role, setRole] = useState<'admin' | 'member'>('member');
  return <Card><div className="wb-row" style={{ marginBottom: 10 }}><input aria-label="Invite email" placeholder="teammate@company.com" value={email} onChange={e => setEmail(e.target.value)} />
    <select aria-label="Role" style={{ width: 120 }} value={role} onChange={e => setRole(e.target.value as 'admin' | 'member')}><option>member</option><option>admin</option></select>
    <Btn pri disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)} onClick={() => { dispatch({ type: 'team/invite', email, role }); setEmail(''); toast('Invite sent'); }}>Invite</Btn></div>
    {ws.team.map(m => <div key={m.id} className="wb-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: m.online ? 'var(--good)' : 'var(--mute)' }} aria-label={m.online ? 'online' : 'offline'} />
      <div><b>{m.name}</b><div className="wb-mute wb-sm">{m.email}</div></div><span className="wb-sp" /><Badge tone={m.role === 'owner' ? 'acc' : undefined}>{m.role}</Badge>{m.role !== 'owner' && <Btn sm dng onClick={() => dispatch({ type: 'team/remove', id: m.id })}>Remove</Btn>}</div>)}</Card>;
}
function TemplatesTab() {
  const { ws, dispatch, toast } = useWb(); const [t, setT] = useState<Template | null>(null);
  const spam = t ? spamCheck(t.subject, t.body) : null;
  return <div className="wb-grid"><div className="wb-row"><span className="wb-sp" /><Btn pri onClick={() => setT({ id: '', name: '', subject: '', body: '' })}>+ Template</Btn></div>
    {ws.templates.map(x => <Card key={x.id}><div className="wb-row"><b>{x.name}</b><span className="wb-sp" /><Btn sm onClick={() => setT(x)}>Edit</Btn><Btn sm dng onClick={() => dispatch({ type: 'template/remove', id: x.id })}>Delete</Btn></div><div className="wb-mute wb-sm" style={{ whiteSpace: 'pre-wrap' }}>{x.subject}{'\n'}{x.body}</div></Card>)}
    {t && <Card title={t.id ? 'Edit template' : 'New template'}><Field label="Name">{id => <input id={id} value={t.name} onChange={e => setT({ ...t, name: e.target.value })} />}</Field>
      <Field label="Subject">{id => <input id={id} value={t.subject} onChange={e => setT({ ...t, subject: e.target.value })} />}</Field><Field label="Body">{id => <textarea id={id} value={t.body} onChange={e => setT({ ...t, body: e.target.value })} />}</Field>
      {spam && <div className="wb-row"><b>Spam check</b><Badge tone={spam.score < 20 ? 'good' : spam.score < 40 ? 'warn' : 'bad'}>{spam.score}/100</Badge><span className="wb-mute wb-sm">{spam.issues[0]}</span></div>}
      <div className="wb-row" style={{ marginTop: 10 }}><Btn onClick={() => setT(null)}>Cancel</Btn><Btn pri disabled={!t.name.trim()} onClick={() => { dispatch({ type: 'template/save', template: t }); toast('Template saved'); setT(null); }}>Save</Btn></div></Card>}</div>;
}
