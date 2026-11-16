import { useState } from 'react';
import { useWb } from '../store';
import { Badge, Bar, Btn, Card, Empty, Field, Modal, useConfirm } from '../kit';
import { dnsChecklist } from '../../domain/deliverability';
import { daysToTarget, warmupSchedule, warmupVolume } from '../../domain/warmup';
import type { Mailbox, Provider } from '../../types';

export function Mailboxes() {
  const { ws, dispatch, toast } = useWb();
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const { confirm, el } = useConfirm();
  const mb = ws.mailboxes.find(m => m.id === sel);
  return <div className="wb-grid">
    <div className="wb-row"><span className="wb-mute">{ws.mailboxes.length} mailboxes · {ws.mailboxes.filter(m => m.warmup.enabled).length} warming</span><span className="wb-sp" /><Btn pri onClick={() => setAdding(true)}>+ Connect mailbox</Btn></div>
    {ws.mailboxes.length === 0 ? <Empty>No mailboxes yet. Connect Gmail, Microsoft or SMTP to start sending and warming.</Empty> :
    <Card><table><thead><tr><th>Mailbox</th><th>Provider</th><th>Status</th><th>Today</th><th>Warmup</th><th>Health</th><th /></tr></thead><tbody>
      {ws.mailboxes.map(m => <tr key={m.id} className="click" onClick={() => setSel(m.id)}>
        <td><b>{m.email}</b><div className="wb-mute wb-sm">{m.name}</div></td><td>{m.provider}</td>
        <td><Badge tone={m.status === 'error' ? 'bad' : m.status === 'paused' ? 'warn' : m.status === 'warming' ? 'acc' : 'good'}>{m.status}</Badge></td>
        <td>{m.sentToday}/{m.dailyLimit}</td>
        <td>{m.warmup.enabled ? `Day ${m.warmup.day} · ${warmupVolume(m.warmup.day, m.warmup.target)}/day` : 'Off'}</td>
        <td style={{ width: 120 }}><Bar value={m.health} tone={m.health >= 75 ? 'var(--good)' : m.health >= 50 ? 'var(--warn)' : 'var(--bad)'} /></td>
        <td onClick={e => e.stopPropagation()}><Btn sm onClick={() => dispatch({ type: 'mailbox/warmup', id: m.id, enabled: !m.warmup.enabled })}>{m.warmup.enabled ? 'Pause warmup' : 'Start warmup'}</Btn></td></tr>)}
    </tbody></table></Card>}
    {adding && <AddMailbox onClose={() => setAdding(false)} />}
    {mb && <MailboxDetail m={mb} onClose={() => setSel(null)} onRemove={() => confirm(`Remove ${mb.email}? It will be dropped from all campaigns.`, () => { dispatch({ type: 'mailbox/remove', id: mb.id }); setSel(null); toast('Mailbox removed'); })} />}
    {el}
  </div>;
}

function AddMailbox({ onClose }: { onClose: () => void }) {
  const { dispatch, toast, ws } = useWb();
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [provider, setProvider] = useState<Provider>('gmail');
  const err = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Enter a valid email' : ws.mailboxes.some(m => m.email === email.trim().toLowerCase()) ? 'Already connected' : '';
  return <Modal title="Connect mailbox" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn pri disabled={!!err} onClick={() => { dispatch({ type: 'mailbox/add', email, name: name || email.split('@')[0], provider }); toast('Mailbox connected'); onClose(); }}>Connect</Btn></>}>
    <Field label="Email address">{id => <input id={id} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />}</Field>
    {email && err && <p className="wb-sm" style={{ color: 'var(--bad)' }}>{err}</p>}
    <Field label="Display name">{id => <input id={id} value={name} onChange={e => setName(e.target.value)} />}</Field>
    <Field label="Provider">{id => <select id={id} value={provider} onChange={e => setProvider(e.target.value as Provider)}><option value="gmail">Google Workspace / Gmail</option><option value="microsoft">Microsoft 365 / Outlook</option><option value="smtp">SMTP / IMAP</option></select>}</Field>
    <p className="wb-mute wb-sm">In production this step runs the provider's OAuth flow; the local studio connects instantly.</p>
  </Modal>;
}

function MailboxDetail({ m, onClose, onRemove }: { m: Mailbox; onClose: () => void; onRemove: () => void }) {
  const { dispatch, toast } = useWb();
  const domain = m.email.split('@')[1];
  const sched = warmupSchedule(Math.min(30, daysToTarget(m.warmup.target) + 4), m.warmup.target);
  const max = Math.max(1, ...sched.map(s => s.volume));
  return <Modal title={m.email} onClose={onClose} footer={<><Btn dng onClick={onRemove}>Remove</Btn><Btn onClick={onClose}>Close</Btn></>}>
    <div className="wb-grid wb-g2">
      <Field label="Daily send limit">{id => <input id={id} type="number" min={1} max={500} value={m.dailyLimit} onChange={e => dispatch({ type: 'mailbox/update', id: m.id, patch: { dailyLimit: Math.max(1, Number(e.target.value) || 1) } })} />}</Field>
      <Field label="Minimum gap between sends (min)">{id => <input id={id} type="number" min={0} value={m.minGapMinutes} onChange={e => dispatch({ type: 'mailbox/update', id: m.id, patch: { minGapMinutes: Math.max(0, Number(e.target.value) || 0) } })} />}</Field>
    </div>
    <div className="wb-row" style={{ marginBottom: 10 }}>
      <b>Warmup</b><Badge tone={m.warmup.enabled ? 'acc' : undefined}>{m.warmup.enabled ? 'running' : 'off'}</Badge><span className="wb-sp" />
      <span className="wb-mute wb-sm">Target</span><input aria-label="Warmup target per day" style={{ width: 70 }} type="number" min={5} max={100} value={m.warmup.target} onChange={e => dispatch({ type: 'mailbox/warmup', id: m.id, enabled: m.warmup.enabled, target: Math.max(5, Number(e.target.value) || 5) })} />
      <Btn sm onClick={() => dispatch({ type: 'mailbox/warmup', id: m.id, enabled: !m.warmup.enabled })}>{m.warmup.enabled ? 'Pause' : 'Start'}</Btn></div>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60, marginBottom: 4 }} aria-label="Warmup ramp">
      {sched.map(s => <div key={s.day} title={`Day ${s.day}: ${s.volume}`} style={{ flex: 1, height: `${(s.volume / max) * 100}%`, background: s.day === m.warmup.day ? 'var(--good)' : 'var(--acc)', opacity: s.day <= m.warmup.day ? 1 : .4, borderRadius: 2 }} />)}</div>
    <p className="wb-mute wb-sm">Reaches {m.warmup.target}/day in about {daysToTarget(m.warmup.target)} days. Reply rate so far: {(m.warmup.replyRate * 100).toFixed(0)}%.</p>
    <div className="wb-row" style={{ margin: '12px 0 6px' }}><b>DNS authentication</b><span className="wb-sp" /><Btn sm onClick={() => { dispatch({ type: 'mailbox/verifyDns', id: m.id }); toast('DNS records verified'); }}>Verify records</Btn></div>
    {dnsChecklist(domain).map(r => { const ok = r.purpose === 'SPF' ? m.spf : r.purpose === 'DKIM' ? m.dkim : m.dmarc;
      return <div key={r.purpose} className="wb-row" style={{ marginBottom: 6 }}><Badge tone={ok ? 'good' : 'bad'}>{r.purpose} {ok ? 'ok' : 'missing'}</Badge><code className="wb-sm wb-mute" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.type} {r.host}</code></div>; })}
  </Modal>;
}
