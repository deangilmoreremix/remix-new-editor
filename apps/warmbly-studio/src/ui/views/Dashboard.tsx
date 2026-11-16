import { useWb } from '../store';
import { Badge, Btn, Card, Funnel, LineChart, Stat, fmtDateTime, money } from '../kit';
import { campaignStats } from '../../domain/campaign';
import { dailySeries, funnel, pct, pipelineValue } from '../../domain/analytics';

export function Dashboard() {
  const { ws, adapter, nav, dispatch, toast } = useWb();
  const s = campaignStats(ws.events);
  const now = adapter.now();
  const pv = pipelineValue(ws.deals);
  const unread = ws.threads.filter(t => t.unread && !t.archived).length;
  const dueTasks = ws.tasks.filter(t => !t.done).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '')).slice(0, 4);
  const upcoming = ws.meetings.filter(m => m.at >= now.toISOString()).sort((a, b) => a.at.localeCompare(b.at)).slice(0, 3);
  const active = ws.campaigns.filter(c => c.status === 'active');
  const advance = async (d: number) => { const a = adapter as { advanceDays?: (n: number) => Promise<unknown> }; await a.advanceDays?.(d); toast(`Simulated ${d} day${d > 1 ? 's' : ''} of sending`); };
  return <div className="wb-grid">
    <div className="wb-grid wb-g4">
      <Stat label="Emails sent" value={s.sent} sub={`${active.length} active campaign${active.length === 1 ? '' : 's'}`} />
      <Stat label="Open rate" value={pct(s.openRate)} sub={`${s.opened} contacts opened`} />
      <Stat label="Reply rate" value={pct(s.replyRate)} sub={`${s.replied} replies`} />
      <Stat label="Bounce rate" value={pct(s.bounceRate)} sub={s.bounceRate > 0.05 ? 'Above safe threshold' : 'Healthy'} />
      <Stat label="Open pipeline" value={money(pv.open)} sub={`${money(pv.won)} won`} />
      <Stat label="Unread replies" value={unread} sub={<a href="#inbox" onClick={e => { e.preventDefault(); nav('inbox'); }}>Open inbox</a>} />
    </div>
    <div className="wb-grid wb-g2">
      <Card title="Sends, last 14 days" actions={adapter.kind === 'local' && <div className="wb-row"><Btn sm onClick={() => advance(1)}>Simulate +1 day</Btn><Btn sm onClick={() => advance(7)}>+7 days</Btn></div>}><LineChart data={dailySeries(ws.events, 'sent', 14, now)} /></Card>
      <Card title="Replies, last 14 days"><LineChart data={dailySeries(ws.events, 'replied', 14, now)} color="var(--good)" /></Card>
    </div>
    <div className="wb-grid wb-g2">
      <Card title="Funnel"><Funnel steps={funnel(ws.events)} /></Card>
      <Card title="Mailbox health" actions={<Btn sm onClick={() => nav('mailboxes')}>Manage</Btn>}>
        {ws.mailboxes.map(m => <div key={m.id} className="wb-row" style={{ marginBottom: 8 }}>
          <span style={{ flex: 1 }}>{m.email}</span><Badge tone={m.health >= 75 ? 'good' : m.health >= 50 ? 'warn' : 'bad'}>{m.health}</Badge>
          <Badge tone={m.warmup.enabled ? 'acc' : undefined}>{m.warmup.enabled ? `warmup d${m.warmup.day}` : 'no warmup'}</Badge></div>)}
      </Card>
    </div>
    <div className="wb-grid wb-g2">
      <Card title="Tasks due" actions={<Btn sm onClick={() => nav('pipeline')}>All</Btn>}>
        {dueTasks.length === 0 ? <span className="wb-mute">Nothing due.</span> : dueTasks.map(t => <label key={t.id} className="wb-row" style={{ marginBottom: 6 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={t.done} onChange={() => dispatch({ type: 'task/toggle', id: t.id })} /><span>{t.title}</span><span className="wb-sp" /><span className="wb-mute wb-sm">{t.due && fmtDateTime(t.due)}</span></label>)}
      </Card>
      <Card title="Upcoming meetings">
        {upcoming.length === 0 ? <span className="wb-mute">No meetings scheduled.</span> : upcoming.map(m => <div key={m.id} className="wb-row" style={{ marginBottom: 6 }}><span>{m.title}</span><span className="wb-sp" /><span className="wb-mute wb-sm">{fmtDateTime(m.at)}</span></div>)}
      </Card>
    </div>
  </div>;
}
