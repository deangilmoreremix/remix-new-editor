import { useEffect, useMemo, useState } from 'react';
import { useWb } from '../store';
import { Badge, Btn, Empty, fmtDateTime, cx } from '../kit';
import type { Thread, ThreadLabel } from '../../types';
import { draftReply } from '../../domain/automation';

const LABELS: ThreadLabel[] = ['interested', 'question', 'meeting-booked', 'not-interested', 'out-of-office', 'none'];
const tone = (l: ThreadLabel) => l === 'interested' || l === 'meeting-booked' ? 'good' as const : l === 'not-interested' ? 'bad' as const : l === 'none' ? undefined : 'acc' as const;

export function Inbox() {
  const { ws, dispatch, toast, arg } = useWb();
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred' | 'archived'>('all');
  const [label, setLabel] = useState<ThreadLabel | 'any'>('any');
  const [mailbox, setMailbox] = useState('any');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | undefined>(arg);
  const [reply, setReply] = useState('');
  const withReplies = useMemo(() => ws.threads.filter(t => t.messages.some(m => m.direction === 'in')), [ws.threads]);
  const list = useMemo(() => withReplies.filter(t => (filter === 'archived' ? t.archived : !t.archived) && (filter !== 'unread' || t.unread) && (filter !== 'starred' || t.starred)
      && (label === 'any' || t.label === label) && (mailbox === 'any' || t.mailboxId === mailbox)
      && (!q || (t.subject + ws.contacts.find(c => c.id === t.contactId)?.email + t.messages.map(m => m.body).join(' ')).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [withReplies, filter, label, mailbox, q, ws.contacts]);
  const t = ws.threads.find(x => x.id === sel);
  const contact = t && ws.contacts.find(c => c.id === t.contactId);
  useEffect(() => { if (t?.unread) dispatch({ type: 'thread/update', id: t.id, patch: { unread: false } }); setReply(t?.draft ?? ''); }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const unreadCount = withReplies.filter(x => x.unread && !x.archived).length;
  const upd = (th: Thread, patch: Partial<Thread>) => dispatch({ type: 'thread/update', id: th.id, patch });
  return <div style={{ height: 'calc(100% - 4px)' }}>
    <div className="wb-row wrap" style={{ marginBottom: 10 }}>
      {(['all', 'unread', 'starred', 'archived'] as const).map(f => <Btn key={f} sm pri={filter === f} onClick={() => setFilter(f)}>{f}{f === 'unread' && unreadCount ? ` (${unreadCount})` : ''}</Btn>)}
      <select aria-label="Filter by label" style={{ width: 150 }} value={label} onChange={e => setLabel(e.target.value as ThreadLabel | 'any')}><option value="any">All labels</option>{LABELS.map(l => <option key={l} value={l}>{l}</option>)}</select>
      <select aria-label="Filter by mailbox" style={{ width: 190 }} value={mailbox} onChange={e => setMailbox(e.target.value)}><option value="any">All mailboxes</option>{ws.mailboxes.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}</select>
      <input aria-label="Search inbox" placeholder="Search…" style={{ width: 200 }} value={q} onChange={e => setQ(e.target.value)} /></div>
    <div className="wb-split" style={{ height: 'calc(100% - 50px)' }}>
      <div className="wb-list">{list.length === 0 ? <Empty>No conversations match.</Empty> : list.map(th => { const c = ws.contacts.find(x => x.id === th.contactId); return <div key={th.id} className={cx('wb-item', th.id === sel && 'on', th.unread && 'unread')} onClick={() => setSel(th.id)}>
        <div className="wb-row">{th.unread && <span className="dot" />}<b style={{ flex: 1 }}>{c?.firstName} {c?.lastName}</b>{th.starred && '★'}<span className="wb-mute wb-sm">{fmtDateTime(th.updatedAt)}</span></div>
        <div className="wb-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{th.subject}</div>
        <div className="wb-row" style={{ marginTop: 4 }}><Badge tone={tone(th.label)}>{th.label}</Badge><span className="wb-mute wb-sm">{c?.company}</span></div></div>; })}</div>
      <div className="wb-list" style={{ padding: 14 }}>
        {!t || !contact ? <Empty>Select a conversation.</Empty> : <>
          <div className="wb-row wrap" style={{ marginBottom: 10 }}><div><b>{t.subject}</b><div className="wb-mute wb-sm">{contact.firstName} {contact.lastName} · {contact.email} · {contact.company}</div></div><span className="wb-sp" />
            <Btn sm onClick={() => upd(t, { starred: !t.starred })}>{t.starred ? '★ Starred' : '☆ Star'}</Btn><Btn sm onClick={() => { upd(t, { archived: !t.archived }); setSel(undefined); }}>{t.archived ? 'Unarchive' : 'Archive'}</Btn>
            <Btn sm onClick={() => upd(t, { unread: true })}>Mark unread</Btn>
            <select aria-label="Set label" style={{ width: 150 }} value={t.label} onChange={e => upd(t, { label: e.target.value as ThreadLabel })}>{LABELS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
          {t.messages.map(m => <div key={m.id} className={cx('wb-msg', m.direction === 'out' && 'out')}><div className="wb-mute wb-sm">{m.direction === 'out' ? 'You' : contact.firstName} · {fmtDateTime(m.at)}</div>{m.body}</div>)}
          <textarea aria-label="Reply" value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply…" />
          <div className="wb-row" style={{ marginTop: 8 }}>
            <Btn onClick={() => setReply(draftReply(t, contact, ws.settings.signature))}>✨ AI draft</Btn>
            <Btn onClick={() => dispatch({ type: 'deal/save', deal: { id: '', title: `${contact.company} opportunity`, contactId: contact.id, stageId: ws.stages[0]?.id ?? '', value: 5000, status: 'open', createdAt: new Date().toISOString() } }).then(() => toast('Deal created'))}>+ Deal</Btn>
            <span className="wb-sp" /><Btn pri disabled={!reply.trim()} onClick={() => { dispatch({ type: 'thread/reply', id: t.id, body: reply }); setReply(''); toast('Reply sent'); }}>Send reply</Btn></div></>}
      </div></div></div>;
}
