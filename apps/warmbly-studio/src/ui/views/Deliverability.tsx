import { useState } from 'react';
import { useWb } from '../store';
import { Badge, Bar, Btn, Card, Empty, Field, fmtDate } from '../kit';
import { mailboxReport, shouldAutoPause } from '../../domain/deliverability';
import { pct } from '../../domain/analytics';

export function Deliverability() {
  const { ws, dispatch, toast } = useWb();
  const [email, setEmail] = useState('');
  const reports = ws.mailboxes.map(m => ({ m, r: mailboxReport(m, ws.events) }));
  const avg = reports.length ? Math.round(reports.reduce((s, x) => s + x.r.score, 0) / reports.length) : 0;
  const tone = (l: string) => l === 'excellent' || l === 'good' ? 'good' as const : l === 'at-risk' ? 'warn' as const : 'bad' as const;
  return <div className="wb-grid">
    <div className="wb-grid wb-g4">
      <div className="wb-card wb-stat"><span>Workspace score</span><b>{avg}</b><span>average across mailboxes</span></div>
      <div className="wb-card wb-stat"><span>At-risk mailboxes</span><b>{reports.filter(x => x.r.level === 'at-risk' || x.r.level === 'critical').length}</b></div>
      <div className="wb-card wb-stat"><span>Suppressed addresses</span><b>{ws.suppression.length}</b></div>
    </div>
    <Card title="Mailboxes">{reports.length === 0 ? <Empty>Connect a mailbox to see deliverability.</Empty> : reports.map(({ m, r }) => <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <div className="wb-row"><b>{m.email}</b><Badge tone={tone(r.level)}>{r.level}</Badge><span className="wb-sp" /><span className="wb-mute wb-sm">bounce {pct(r.bounceRate)} · complaints {pct(r.complaintRate, 2)}</span>
        {shouldAutoPause(r) && m.status !== 'paused' && <Btn sm dng onClick={() => { dispatch({ type: 'mailbox/update', id: m.id, patch: { status: 'paused' } }); toast(`${m.email} paused`); }}>Pause now</Btn>}
        {m.status === 'paused' && <Btn sm onClick={() => dispatch({ type: 'mailbox/update', id: m.id, patch: { status: 'connected' } })}>Resume</Btn>}</div>
      <Bar value={r.score} tone={r.score >= 65 ? 'var(--good)' : r.score >= 40 ? 'var(--warn)' : 'var(--bad)'} />
      {r.alerts.map((a, i) => <div key={i} className="wb-sm" style={{ marginTop: 4, color: a.severity === 'critical' ? 'var(--bad)' : a.severity === 'warn' ? 'var(--warn)' : 'var(--mute)' }}>• {a.message}</div>)}
    </div>)}</Card>
    <Card title="Suppression list">
      <div className="wb-row" style={{ marginBottom: 10 }}><Field label="Add email">{id => <input id={id} value={email} onChange={e => setEmail(e.target.value)} placeholder="someone@example.com" />}</Field>
        <Btn pri disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)} onClick={() => { dispatch({ type: 'suppression/add', email }); setEmail(''); }}>Suppress</Btn></div>
      {ws.suppression.length === 0 ? <span className="wb-mute">No suppressed addresses.</span> : <table><thead><tr><th>Email</th><th>Reason</th><th>Added</th><th /></tr></thead><tbody>
        {ws.suppression.map(s => <tr key={s.id}><td>{s.email}</td><td><Badge tone={s.reason === 'complaint' ? 'bad' : 'warn'}>{s.reason}</Badge></td><td>{fmtDate(s.at)}</td><td><Btn sm onClick={() => dispatch({ type: 'suppression/remove', id: s.id })}>Remove</Btn></td></tr>)}</tbody></table>}
    </Card>
  </div>;
}
