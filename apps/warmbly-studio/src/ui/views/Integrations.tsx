import { useState } from 'react';
import { useWb } from '../store';
import { Badge, Btn, Card, Field, Modal, fmtDate, useConfirm } from '../kit';
import type { Webhook } from '../../types';

const EVENTS = ['email.sent', 'email.opened', 'email.clicked', 'reply.received', 'email.bounced', 'contact.unsubscribed', 'meeting.booked'];
const SCOPES = ['contacts:read', 'contacts:write', 'campaigns:read', 'campaigns:write', 'inbox:read'];

export function Integrations() {
  const { ws, dispatch, toast } = useWb();
  const [hook, setHook] = useState<Webhook | null>(null); const [key, setKey] = useState(false); const [secret, setSecret] = useState<string | null>(null);
  const { confirm, el } = useConfirm();
  return <div className="wb-grid">
    <Card title="Connected apps"><div className="wb-grid wb-g2">{ws.integrations.map(i => <div key={i.id} className="wb-row wb-card"><div><b>{i.name}</b><div className="wb-mute wb-sm">{i.connected ? i.detail ?? 'Connected' : 'Not connected'}</div></div><span className="wb-sp" />
      <Btn sm pri={!i.connected} onClick={() => { dispatch({ type: 'integration/toggle', id: i.id }); toast(i.connected ? `${i.name} disconnected` : `${i.name} connected`); }}>{i.connected ? 'Disconnect' : 'Connect'}</Btn></div>)}</div></Card>
    <Card title="Webhooks" actions={<Btn sm pri onClick={() => setHook({ id: '', url: '', events: ['reply.received'], secret: '', enabled: true })}>+ Webhook</Btn>}>
      {ws.webhooks.length === 0 ? <span className="wb-mute">No webhooks.</span> : ws.webhooks.map(w => <div key={w.id} className="wb-row wrap" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
        <div style={{ flex: 1, minWidth: 200 }}><code className="wb-sm">{w.url}</code><div className="wb-mute wb-sm">{w.events.join(', ')}</div></div>
        {w.lastStatus && <Badge tone={w.lastStatus < 300 ? 'good' : 'bad'}>{w.lastStatus}</Badge>}<Badge tone={w.enabled ? 'good' : undefined}>{w.enabled ? 'on' : 'off'}</Badge>
        <Btn sm onClick={() => { dispatch({ type: 'webhook/test', id: w.id }); toast('Test event sent'); }}>Test</Btn><Btn sm onClick={() => setHook(w)}>Edit</Btn><Btn sm dng onClick={() => confirm('Delete this webhook?', () => dispatch({ type: 'webhook/remove', id: w.id }))}>✕</Btn></div>)}</Card>
    <Card title="REST API keys" actions={<Btn sm pri onClick={() => setKey(true)}>+ API key</Btn>}>
      {ws.apiKeys.length === 0 ? <span className="wb-mute">No API keys.</span> : <table><thead><tr><th>Name</th><th>Key</th><th>Scopes</th><th>Created</th><th /></tr></thead><tbody>
        {ws.apiKeys.map(k => <tr key={k.id}><td>{k.name}</td><td><code>{k.prefix}…</code></td><td className="wb-sm wb-mute">{k.scopes.join(', ')}</td><td>{fmtDate(k.createdAt)}</td><td><Btn sm dng onClick={() => confirm(`Revoke "${k.name}"? Apps using it stop working.`, () => dispatch({ type: 'apikey/revoke', id: k.id }))}>Revoke</Btn></td></tr>)}</tbody></table>}</Card>
    {hook && <HookForm w={hook} onClose={() => setHook(null)} />}
    {key && <KeyForm onClose={() => setKey(false)} onCreated={setSecret} />}
    {secret && <Modal title="Copy your API key" onClose={() => setSecret(null)} footer={<Btn pri onClick={() => setSecret(null)}>Done</Btn>}><p className="wb-mute">Shown once. Store it somewhere safe.</p><code style={{ wordBreak: 'break-all' }}>{secret}</code></Modal>}{el}</div>;
}
function HookForm({ w, onClose }: { w: Webhook; onClose: () => void }) {
  const { dispatch, toast } = useWb(); const [x, setX] = useState(w); const bad = !/^https?:\/\/[^\s]+$/.test(x.url);
  return <Modal title={w.id ? 'Edit webhook' : 'New webhook'} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn pri disabled={bad || !x.events.length} onClick={() => { dispatch({ type: 'webhook/save', webhook: x }); toast('Webhook saved'); onClose(); }}>Save</Btn></>}>
    <Field label="Endpoint URL">{id => <input id={id} value={x.url} onChange={e => setX({ ...x, url: e.target.value })} placeholder="https://example.com/hook" />}</Field>{x.url && bad && <p className="wb-sm" style={{ color: 'var(--bad)' }}>Enter a full http(s) URL</p>}
    <p className="wb-sm wb-mute">Events</p>{EVENTS.map(ev => <label key={ev} className="wb-row" style={{ marginBottom: 4 }}><input type="checkbox" style={{ width: 'auto' }} checked={x.events.includes(ev)} onChange={() => setX({ ...x, events: x.events.includes(ev) ? x.events.filter(e => e !== ev) : [...x.events, ev] })} /><span>{ev}</span></label>)}
    <label className="wb-row" style={{ marginTop: 8 }}><input type="checkbox" style={{ width: 'auto' }} checked={x.enabled} onChange={e => setX({ ...x, enabled: e.target.checked })} /><span>Enabled</span></label></Modal>;
}
function KeyForm({ onClose, onCreated }: { onClose: () => void; onCreated: (k: string) => void }) {
  const { dispatch } = useWb(); const [name, setName] = useState(''); const [scopes, setScopes] = useState<string[]>(['contacts:read']);
  return <Modal title="New API key" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn pri disabled={!name.trim() || !scopes.length} onClick={() => { dispatch({ type: 'apikey/create', name, scopes }); onCreated(`wb_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`); onClose(); }}>Create</Btn></>}>
    <Field label="Name">{id => <input id={id} value={name} onChange={e => setName(e.target.value)} />}</Field>
    {SCOPES.map(s => <label key={s} className="wb-row" style={{ marginBottom: 4 }}><input type="checkbox" style={{ width: 'auto' }} checked={scopes.includes(s)} onChange={() => setScopes(scopes.includes(s) ? scopes.filter(x => x !== s) : [...scopes, s])} /><span>{s}</span></label>)}</Modal>;
}
