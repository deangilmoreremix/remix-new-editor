import { useEffect, useMemo, useRef, useState } from 'react';
import { useWb } from '../store';
import { Badge, Btn, Empty, Field, Icon, Modal, cx, fmtDateTime } from '../kit';
import type { Draft, Label, Thread, ThreadLabel } from '../../types';
import { FOLDERS, type Folder, folderCounts, groupByDay, initials, isSnoozed, labelCounts, listDrafts, listThreads, previewOf, relativeTime, snoozeOptions, tagCounts } from '../../domain/inbox';
import { draftReply } from '../../domain/automation';

const TONE: Record<Label['color'], 'acc' | 'good' | 'bad' | 'warn'> = { acc: 'acc', good: 'good', bad: 'bad', warn: 'warn', purple: 'acc' };
const DOT: Record<Label['color'], string> = { acc: 'var(--acc)', good: 'var(--good)', bad: 'var(--bad)', warn: 'var(--warn)', purple: '#a78bfa' };
const INTENT: Record<ThreadLabel, string> = { interested: 'Interested', question: 'Question', 'meeting-booked': 'Meeting', 'not-interested': 'Not interested', 'out-of-office': 'Out of office', none: '' };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function Inbox() {
  const { ws, dispatch, toast, arg, adapter } = useWb();
  const now = adapter.now();
  const [folder, setFolder] = useState<Folder>('inbox');
  const [mailboxIds, setMailboxIds] = useState<string[]>([]); const [labelId, setLabelId] = useState<string | null>(null); const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState(''); const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [sel, setSel] = useState<string | undefined>(arg); const [selecting, setSelecting] = useState(false); const [picked, setPicked] = useState<string[]>([]);
  const [compose, setCompose] = useState<Draft | null>(null); const [mbq, setMbq] = useState(''); const [allMb, setAllMb] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  const counts = folderCounts(ws, now); const lc = labelCounts(ws, now); const tags = tagCounts(ws, now);
  const isDraftFolder = folder === 'drafts' || folder === 'scheduled';
  const filters = { mailboxIds, labelId, tag, query };
  const threads = isDraftFolder ? [] : listThreads(ws, folder, now, filters, sort);
  const drafts = isDraftFolder ? listDrafts(ws, folder === 'scheduled', now).filter(d => !query || `${d.to} ${d.subject} ${d.body}`.toLowerCase().includes(query.toLowerCase())) : [];
  const t = threads.find(x => x.id === sel) ?? (sel ? ws.threads.find(x => x.id === sel) : undefined);
  const contact = t && ws.contacts.find(c => c.id === t.contactId);
  const nameOf = (th: Thread) => { const c = ws.contacts.find(x => x.id === th.contactId); return c ? `${c.firstName} ${c.lastName}`.trim() || c.email : 'Unknown'; };
  const unreadTotal = counts.unread;

  useEffect(() => { if (t?.unread) dispatch({ type: 'thread/bulk', ids: [t.id], patch: { unread: false } }); }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const move = (ids: string[], patch: Parameters<typeof dispatch>[0] extends infer A ? A extends { type: 'thread/bulk'; patch: infer P } ? P : never : never, msg: string) => {
    dispatch({ type: 'thread/bulk', ids, patch }); toast(msg);
    if (sel && ids.includes(sel)) { const i = threads.findIndex(x => x.id === sel); const nxt = threads.filter(x => !ids.includes(x.id))[Math.min(i, threads.length - ids.length - 1)]; setSel(nxt?.id); }
    setPicked(p => p.filter(x => !ids.includes(x)));
  };
  const openCompose = (d?: Partial<Draft>) => setCompose({ id: '', kind: 'compose', mailboxId: mailboxIds[0] ?? ws.mailboxes[0]?.id ?? '', to: '', subject: '', body: `\n\n${ws.settings.signature}`, createdAt: new Date().toISOString(), ...d });

  // keyboard shortcuts (ignored while typing)
  const kb = useRef<(e: KeyboardEvent) => void>(undefined);
  kb.current = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement; if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable || e.metaKey || e.ctrlKey || compose) return;
    const i = threads.findIndex(x => x.id === sel);
    if (e.key === '/') { e.preventDefault(); search.current?.focus(); }
    else if (e.key === 'c') { e.preventDefault(); openCompose(); }
    else if (e.key === 'j') setSel(threads[Math.min(threads.length - 1, i + 1)]?.id);
    else if (e.key === 'k') setSel(threads[Math.max(0, i - 1)]?.id);
    else if (t && e.key === 'e') move([t.id], { archived: !t.archived }, t.archived ? 'Moved to inbox' : 'Archived');
    else if (t && e.key === '#') move([t.id], { trashed: true }, 'Moved to trash');
    else if (t && e.key === 'u') { dispatch({ type: 'thread/bulk', ids: [t.id], patch: { unread: true } }); setSel(undefined); }
    else if (t && e.key === 's') dispatch({ type: 'thread/bulk', ids: [t.id], patch: { starred: !t.starred } });
  };
  useEffect(() => { const h = (e: KeyboardEvent) => kb.current?.(e); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);

  const mbList = ws.mailboxes.filter(m => !mbq || m.email.includes(mbq.toLowerCase()));
  const shownMb = allMb || mbq ? mbList : mbList.slice(0, 5);
  const groups = useMemo(() => groupByDay(threads, now), [threads, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = FOLDERS.find(f => f.id === folder)!.label; const total = isDraftFolder ? drafts.length : threads.length;

  return <div className="wb-ib" data-testid="inbox">
    <nav className="wb-ib-rail" aria-label="Mail folders">
      <Btn pri style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }} onClick={() => openCompose()}><Icon name="edit" /> Compose <kbd>c</kbd></Btn>
      {FOLDERS.map(f => <button key={f.id} className={cx('f', folder === f.id && 'on')} aria-current={folder === f.id ? 'page' : undefined} onClick={() => { setFolder(f.id); setSel(undefined); setPicked([]); }}>
        <Icon name={f.icon} />{f.label}<span className={cx('n', f.id === 'inbox' && counts.unread > 0 && 'hot')}>{f.id === 'inbox' ? (counts.unread || '') : counts[f.id] || ''}</span></button>)}
      <div className="sec">Mailboxes <span className="wb-sp" /><span>{ws.mailboxes.length}</span></div>
      <input aria-label="Filter mailboxes" placeholder="Filter mailboxes" value={mbq} onChange={e => setMbq(e.target.value)} />
      {shownMb.map(m => <button key={m.id} className={cx('f', mailboxIds.includes(m.id) && 'on')} aria-pressed={mailboxIds.includes(m.id)} onClick={() => setMailboxIds(x => x.includes(m.id) ? x.filter(y => y !== m.id) : [...x, m.id])} title={m.email}><Icon name="mail" /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</span></button>)}
      {!mbq && mbList.length > 5 && <button className="f" onClick={() => setAllMb(a => !a)}>{allMb ? 'Show fewer' : `Show all (${mbList.length - 5} more)`}</button>}
      <LabelsRail lc={lc} labelId={labelId} setLabelId={setLabelId} />
      {tags.length > 0 && <><div className="sec">Tags</div>{tags.map(([g, n]) => <button key={g} className={cx('f', tag === g && 'on')} aria-pressed={tag === g} onClick={() => setTag(x => x === g ? null : g)}><Icon name="tag" />{g}<span className="n">{n}</span></button>)}</>}
    </nav>

    <section className="wb-ib-list" aria-label="Conversations">
      <div className="wb-ib-head">
        <div className="wb-row"><b style={{ fontSize: 16 }}>{title}</b><span className="wb-mute">{total}</span><span className="wb-sp" />
          {!isDraftFolder && <Btn sm onClick={() => { setSelecting(s => !s); setPicked([]); }} aria-pressed={selecting}>{selecting ? 'Done' : 'Select'}</Btn>}
          {!isDraftFolder && <Btn sm onClick={() => setSort(s => s === 'newest' ? 'oldest' : 'newest')} aria-label={`Sort: ${sort} first`} title={`Sort: ${sort} first`}><Icon name="history" /> {sort === 'newest' ? 'Newest' : 'Oldest'}</Btn>}
          <Btn sm pri onClick={() => openCompose()}><Icon name="edit" /> Compose</Btn></div>
        <div style={{ position: 'relative' }}><input ref={search} aria-label="Search inbox" placeholder="Search inbox: name, address, or any word" value={query} onChange={e => setQuery(e.target.value)} />
          {!query && <kbd style={{ position: 'absolute', right: 8, top: 8 }}>/</kbd>}</div>
        {(mailboxIds.length > 0 || labelId || tag) && <div className="wb-row wrap wb-sm"><span className="wb-mute">Filters:</span>
          {mailboxIds.map(id => <Badge key={id} tone="acc">{ws.mailboxes.find(m => m.id === id)?.email}</Badge>)}{labelId && <Badge tone="acc">{ws.labels.find(l => l.id === labelId)?.name}</Badge>}{tag && <Badge tone="acc">#{tag}</Badge>}
          <Btn sm onClick={() => { setMailboxIds([]); setLabelId(null); setTag(null); }}>Clear</Btn></div>}
        {selecting && picked.length > 0 && <BulkBar ids={picked} folder={folder} move={move} clear={() => setPicked([])} />}
      </div>
      <div className="wb-ib-scroll">
        {isDraftFolder ? (drafts.length === 0 ? <Empty>{folder === 'scheduled' ? 'No scheduled emails.' : 'No drafts.'}</Empty> : drafts.map(d => <div key={d.id} className="wb-ib-item" role="button" tabIndex={0} onClick={() => openCompose(d)} onKeyDown={e => e.key === 'Enter' && openCompose(d)}>
          <span className="wb-av"><Icon name="draft" /></span><div className="main"><div className="top"><span className="nm">{d.to || '(no recipient)'}</span><span className="wb-sp" /><span className="wb-mute wb-sm">{d.scheduledAt ? fmtDateTime(d.scheduledAt) : relativeTime(d.createdAt, now)}</span></div>
            <div className="sub">{d.subject || '(no subject)'}</div><div className="pv">{d.body.replace(/\s+/g, ' ').trim()}</div></div></div>))
        : total === 0 ? <Empty>{query ? 'No conversations match your search.' : folder === 'inbox' ? 'Inbox zero. Nice.' : 'Nothing here.'}</Empty>
        : groups.map(g => <div key={g.title}><div className="wb-ib-grp">{g.title}</div>{g.items.map(th => {
            const labels = (th.labelIds ?? []).map(id => ws.labels.find(l => l.id === id)).filter(Boolean) as Label[];
            return <div key={th.id} className={cx('wb-ib-item', th.id === sel && 'on', !th.unread && 'read')} role="button" tabIndex={0} aria-label={`${nameOf(th)}: ${th.subject}`} onClick={() => setSel(th.id)} onKeyDown={e => e.key === 'Enter' && setSel(th.id)}>
              {selecting ? <input className="wb-chk" type="checkbox" aria-label={`Select ${nameOf(th)}`} checked={picked.includes(th.id)} onClick={e => e.stopPropagation()} onChange={() => setPicked(p => p.includes(th.id) ? p.filter(x => x !== th.id) : [...p, th.id])} /> : <span className={cx('ud', !th.unread && 'off')} aria-label={th.unread ? 'Unread' : undefined} />}
              <div className="main"><div className="top"><span className="nm">{nameOf(th)}</span>{th.starred && <span style={{ color: 'var(--warn)' }} aria-label="Starred">★</span>}<span className="wb-sp" /><span className="wb-mute wb-sm">{relativeTime(th.updatedAt, now)}</span></div>
                <div className="sub">{th.subject}</div><div className="pv">{previewOf(th)}</div>
                <div className="wb-row wrap" style={{ marginTop: 4, gap: 4 }}>{labels.map(l => <Badge key={l.id} tone={TONE[l.color]}>{l.name}</Badge>)}{INTENT[th.label] && th.label !== 'none' && <Badge>{INTENT[th.label]}</Badge>}{(th.tags ?? []).map(g => <Badge key={g}>#{g}</Badge>)}{th.draft && <Badge tone="acc">AI draft</Badge>}{isSnoozed(th, now) && <Badge tone="warn">snoozed</Badge>}</div></div></div>; })}</div>)}
      </div>
    </section>

    <section className="wb-ib-read" aria-label="Reading pane">
      {folder === 'drafts' || folder === 'scheduled' ? <Empty>Select a {folder === 'scheduled' ? 'scheduled email' : 'draft'} to edit it.</Empty>
        : !t || !contact ? <Empty>Select a conversation to read it.<div className="wb-sm" style={{ marginTop: 8 }}><kbd>j</kbd> <kbd>k</kbd> navigate · <kbd>e</kbd> archive · <kbd>#</kbd> trash · <kbd>u</kbd> unread · <kbd>c</kbd> compose</div></Empty>
        : <Reader t={t} nameOf={nameOf(t)} onClose={() => setSel(undefined)} move={move} openCompose={openCompose} unreadTotal={unreadTotal} />}
    </section>
    {compose && <ComposeModal d={compose} onClose={() => setCompose(null)} />}
  </div>;
}

function LabelsRail({ lc, labelId, setLabelId }: { lc: Record<string, number>; labelId: string | null; setLabelId: (v: string | null) => void }) {
  const { ws, dispatch } = useWb(); const [adding, setAdding] = useState(false); const [name, setName] = useState(''); const [color, setColor] = useState<Label['color']>('acc');
  return <><div className="sec">Labels <span className="wb-sp" /><button aria-label="Add label" style={{ background: 'none', border: 0, color: 'var(--mute)', padding: 0 }} onClick={() => setAdding(a => !a)}><Icon name="plus" /></button></div>
    {adding && <div className="wb-row" style={{ padding: '0 4px 6px' }}><input aria-label="New label name" value={name} placeholder="Label name" onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { dispatch({ type: 'label/save', label: { id: '', name: name.trim(), color } }); setName(''); setAdding(false); } }} />
      <select aria-label="Label colour" style={{ width: 62, padding: 4 }} value={color} onChange={e => setColor(e.target.value as Label['color'])}>{(['acc', 'good', 'bad', 'warn', 'purple'] as const).map(c => <option key={c} value={c}>{c}</option>)}</select></div>}
    {ws.labels.map(l => <button key={l.id} className={cx('f', labelId === l.id && 'on')} aria-pressed={labelId === l.id} onClick={() => setLabelId(labelId === l.id ? null : l.id)}><span className="dot" style={{ background: DOT[l.color] }} />{l.name}<span className="n">{lc[l.id] || ''}</span></button>)}</>;
}

type MoveFn = (ids: string[], patch: { unread?: boolean; starred?: boolean; archived?: boolean; trashed?: boolean; spam?: boolean; snoozedUntil?: string | undefined; assigneeId?: string | undefined }, msg: string) => void;

function BulkBar({ ids, folder, move, clear }: { ids: string[]; folder: Folder; move: MoveFn; clear: () => void }) {
  const { dispatch, adapter } = useWb(); const [menu, setMenu] = useState<null | 'snooze' | 'label'>(null);
  return <div className="wb-row wrap" role="toolbar" aria-label="Bulk actions" style={{ position: 'relative' }}><b className="wb-sm">{ids.length} selected</b><span className="wb-sp" />
    <Btn sm onClick={() => move(ids, { archived: folder !== 'archive' }, folder === 'archive' ? 'Moved to inbox' : 'Archived')}>{folder === 'archive' ? 'Unarchive' : 'Archive'}</Btn>
    {folder === 'trash' ? <><Btn sm onClick={() => move(ids, { trashed: false }, 'Restored')}>Restore</Btn><Btn sm dng onClick={() => { dispatch({ type: 'thread/purge', ids }); clear(); }}>Delete forever</Btn></> : <Btn sm onClick={() => move(ids, { trashed: true }, 'Moved to trash')}>Trash</Btn>}
    <Btn sm onClick={() => move(ids, { spam: folder !== 'spam' }, folder === 'spam' ? 'Marked not spam' : 'Marked as spam')}>{folder === 'spam' ? 'Not spam' : 'Spam'}</Btn>
    <Btn sm onClick={() => move(ids, { unread: false }, 'Marked read')}>Read</Btn><Btn sm onClick={() => move(ids, { unread: true }, 'Marked unread')}>Unread</Btn>
    <Btn sm onClick={() => setMenu(m => m === 'snooze' ? null : 'snooze')}>Snooze</Btn><Btn sm onClick={() => setMenu(m => m === 'label' ? null : 'label')}>Label</Btn>
    {menu === 'snooze' && <SnoozeMenu now={adapter.now()} onPick={u => { move(ids, { snoozedUntil: u }, 'Snoozed'); setMenu(null); }} />}
    {menu === 'label' && <LabelMenu ids={ids} onDone={() => setMenu(null)} />}</div>;
}
function SnoozeMenu({ now, onPick }: { now: Date; onPick: (iso: string) => void }) {
  const [custom, setCustom] = useState('');
  return <div className="wb-menu" role="menu" style={{ right: 0, top: 34 }}>{snoozeOptions(now).map(o => <button key={o.label} role="menuitem" onClick={() => onPick(o.until)}><span className="wb-sp">{o.label}</span><span className="wb-mute wb-sm">{new Date(o.until).toLocaleString(undefined, { weekday: 'short', hour: 'numeric' })}</span></button>)}
    <div className="wb-row" style={{ padding: 6 }}><input aria-label="Snooze until" type="datetime-local" value={custom} onChange={e => setCustom(e.target.value)} /><Btn sm disabled={!custom} onClick={() => onPick(new Date(custom).toISOString())}>Set</Btn></div></div>;
}
function LabelMenu({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { ws, dispatch } = useWb(); const [tag, setTag] = useState(''); const on = (l: Label) => ids.every(id => ws.threads.find(t => t.id === id)?.labelIds?.includes(l.id));
  return <div className="wb-menu" role="menu" style={{ right: 0, top: 34 }}>{ws.labels.map(l => <button key={l.id} role="menuitemcheckbox" aria-checked={on(l)} onClick={() => dispatch({ type: 'thread/labels', ids, labelId: l.id, remove: on(l) })}><span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: DOT[l.color] }} /><span className="wb-sp">{l.name}</span>{on(l) && <Icon name="check" />}</button>)}
    <div className="wb-row" style={{ padding: 6 }}><input aria-label="Add tag" placeholder="Add tag" value={tag} onChange={e => setTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && tag.trim()) { dispatch({ type: 'thread/tags', ids, tag: tag.trim().replace(/^#/, '') }); setTag(''); onDone(); } }} /></div></div>;
}

function Reader({ t, nameOf, onClose, move, openCompose }: { t: Thread; nameOf: string; onClose: () => void; move: MoveFn; openCompose: (d?: Partial<Draft>) => void; unreadTotal: number }) {
  const { ws, dispatch, toast, adapter } = useWb(); const now = adapter.now();
  const c = ws.contacts.find(x => x.id === t.contactId)!; const mb = ws.mailboxes.find(m => m.id === t.mailboxId);
  const [menu, setMenu] = useState<null | 'snooze' | 'label' | 'assign'>(null); const [reply, setReply] = useState<string | null>(null);
  useEffect(() => { setReply(null); setMenu(null); }, [t.id]);
  const labels = (t.labelIds ?? []).map(id => ws.labels.find(l => l.id === id)).filter(Boolean) as Label[]; const assignee = ws.team.find(m => m.id === t.assigneeId);
  const Act = ({ icon, label, onClick, on }: { icon: string; label: string; onClick: () => void; on?: boolean }) => <button className={cx(on && 'on')} aria-label={label} title={label} onClick={onClick}><Icon name={icon} /></button>;
  const send = () => { if (!reply?.trim()) return; dispatch({ type: 'draft/send', draft: { id: '', kind: 'reply', mailboxId: t.mailboxId, to: c.email, subject: `Re: ${t.subject.replace(/^Re:\s*/i, '')}`, body: reply, threadId: t.id, createdAt: new Date().toISOString() } }); setReply(null); toast('Reply sent'); };
  return <>
    <header className="wb-ib-rh">
      <div className="wb-row" style={{ alignItems: 'flex-start' }}><div style={{ minWidth: 0, flex: 1 }}><h2 style={{ margin: 0, fontSize: 16 }}>{t.subject}</h2>
        <div className="wb-row wrap wb-sm" style={{ marginTop: 4, gap: 6 }}><span className="wb-mute">{t.messages.length} message{t.messages.length === 1 ? '' : 's'} · {c.email}</span>{labels.map(l => <Badge key={l.id} tone={TONE[l.color]}>{l.name}</Badge>)}{t.label !== 'none' && <Badge>{INTENT[t.label]}</Badge>}{(t.tags ?? []).map(g => <Badge key={g}>#{g}</Badge>)}{assignee && <Badge tone="acc">{assignee.name}</Badge>}{isSnoozed(t, now) && <Badge tone="warn">snoozed until {fmtDateTime(t.snoozedUntil)}</Badge>}</div></div>
        <div className="wb-ib-acts" role="toolbar" aria-label="Conversation actions" style={{ position: 'relative' }}>
          <Act icon="star" label={t.starred ? 'Unstar' : 'Star'} on={t.starred} onClick={() => dispatch({ type: 'thread/bulk', ids: [t.id], patch: { starred: !t.starred } })} />
          <Act icon="tag" label="Labels and tags" onClick={() => setMenu(m => m === 'label' ? null : 'label')} />
          <Act icon="snooze" label="Snooze" onClick={() => setMenu(m => m === 'snooze' ? null : 'snooze')} />
          <Act icon="user" label="Assign" onClick={() => setMenu(m => m === 'assign' ? null : 'assign')} />
          <Act icon="mail" label="Mark unread" onClick={() => { dispatch({ type: 'thread/bulk', ids: [t.id], patch: { unread: true } }); onClose(); }} />
          <Act icon="archive" label={t.archived ? 'Move to inbox' : 'Archive'} onClick={() => move([t.id], { archived: !t.archived }, t.archived ? 'Moved to inbox' : 'Archived')} />
          <Act icon="spam" label={t.spam ? 'Not spam' : 'Report spam'} onClick={() => move([t.id], { spam: !t.spam }, t.spam ? 'Marked not spam' : 'Marked as spam')} />
          {t.trashed ? <><Act icon="reply" label="Restore" onClick={() => move([t.id], { trashed: false }, 'Restored')} /><Act icon="trash" label="Delete forever" onClick={() => { dispatch({ type: 'thread/purge', ids: [t.id] }); onClose(); }} /></> : <Act icon="trash" label="Move to trash" onClick={() => move([t.id], { trashed: true }, 'Moved to trash')} />}
          <Act icon="x" label="Close conversation" onClick={onClose} />
          {menu === 'snooze' && <SnoozeMenu now={now} onPick={u => { move([t.id], { snoozedUntil: u }, 'Snoozed'); setMenu(null); }} />}
          {menu === 'label' && <LabelMenu ids={[t.id]} onDone={() => setMenu(null)} />}
          {menu === 'assign' && <div className="wb-menu" role="menu" style={{ right: 0, top: 34 }}>{[{ id: undefined as string | undefined, name: 'Unassigned' }, ...ws.team].map(m => <button key={m.id ?? 'none'} role="menuitemradio" aria-checked={t.assigneeId === m.id} onClick={() => { dispatch({ type: 'thread/bulk', ids: [t.id], patch: { assigneeId: m.id } }); setMenu(null); }}><span className="wb-sp">{m.name}</span>{t.assigneeId === m.id && <Icon name="check" />}</button>)}</div>}
        </div></div>
    </header>
    <div className="wb-ib-body">
      {t.draft && <div className="wb-card wb-row" style={{ marginBottom: 12 }}><Icon name="sparkles" /><span className="wb-sp">The agent drafted a reply for this conversation.</span><Btn sm pri onClick={() => setReply(t.draft!)}>Use draft</Btn><Btn sm onClick={() => dispatch({ type: 'thread/update', id: t.id, patch: { draft: undefined } })}>Dismiss</Btn></div>}
      {t.messages.map(m => <article key={m.id} className="wb-ib-msg"><div className="wb-row"><span className="wb-av">{initials(m.direction === 'in' ? nameOf : (mb?.name ?? 'Me'))}</span>
        <div style={{ minWidth: 0 }}><b>{m.direction === 'in' ? nameOf : (mb?.name ?? 'You')}</b> <span className="wb-mute wb-sm">&lt;{m.from}&gt;</span><div className="wb-mute wb-sm">to {m.direction === 'in' ? (mb?.email ?? 'me') : m.to}</div></div><span className="wb-sp" /><span className="wb-mute wb-sm">{fmtDateTime(m.at)}</span></div><div className="tx">{m.body}</div></article>)}
    </div>
    <footer className="wb-ib-foot">
      {reply === null ? <div className="wb-row"><Btn pri onClick={() => setReply(`\n\n${ws.settings.signature}`)}><Icon name="reply" /> Reply</Btn>
        <Btn onClick={() => openCompose({ kind: 'forward', mailboxId: t.mailboxId, subject: `Fwd: ${t.subject.replace(/^(Re|Fwd):\s*/i, '')}`, body: `\n\n---------- Forwarded message ----------\n${t.messages.map(m => `From: ${m.from}\n${m.body}`).join('\n\n')}` })}><Icon name="forward" /> Forward</Btn></div>
        : <div><textarea aria-label="Reply" autoFocus value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply…" style={{ minHeight: 110 }} />
          <div className="wb-row" style={{ marginTop: 8 }}><Btn onClick={() => setReply(draftReply(t, c, ws.settings.signature))}><Icon name="sparkles" /> AI draft</Btn>
            <Btn onClick={() => { dispatch({ type: 'draft/save', draft: { id: '', kind: 'reply', mailboxId: t.mailboxId, to: c.email, subject: `Re: ${t.subject.replace(/^Re:\s*/i, '')}`, body: reply, threadId: t.id, createdAt: new Date().toISOString() } }); setReply(null); toast('Draft saved'); }}>Save draft</Btn>
            <Btn onClick={() => dispatch({ type: 'deal/save', deal: { id: '', title: `${c.company || c.email} opportunity`, contactId: c.id, stageId: ws.stages[0]?.id ?? '', value: 5000, status: 'open', createdAt: new Date().toISOString() } }).then(() => toast('Deal created'))}>+ Deal</Btn>
            <span className="wb-sp" /><Btn onClick={() => setReply(null)}>Discard</Btn><Btn pri disabled={!reply.trim()} onClick={send}>Send reply</Btn></div></div>}
    </footer></>;
}

function ComposeModal({ d, onClose }: { d: Draft; onClose: () => void }) {
  const { ws, dispatch, toast, adapter } = useWb(); const [x, setX] = useState(d); const [later, setLater] = useState(!!d.scheduledAt);
  const set = (p: Partial<Draft>) => setX(v => ({ ...v, ...p }));
  const toOk = EMAIL.test(x.to.trim()); const when = later && x.scheduledAt ? new Date(x.scheduledAt) : null; const whenBad = later && (!when || when <= adapter.now());
  const val = (iso?: string) => iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  const canSend = toOk && !!x.body.trim() && !whenBad && !!x.mailboxId;
  return <Modal title={x.kind === 'forward' ? 'Forward' : x.kind === 'reply' ? 'Reply' : 'New message'} onClose={onClose} footer={<>
    {x.id && <Btn dng onClick={() => { dispatch({ type: 'draft/delete', id: x.id }); toast('Draft discarded'); onClose(); }}>Discard</Btn>}<span className="wb-sp" />
    <Btn onClick={() => { dispatch({ type: 'draft/save', draft: { ...x, scheduledAt: later ? x.scheduledAt : undefined } }); toast('Draft saved'); onClose(); }}>Save draft</Btn>
    <Btn pri disabled={!canSend} onClick={() => { dispatch({ type: 'draft/send', draft: { ...x, scheduledAt: later ? x.scheduledAt : undefined } }); toast(later ? `Scheduled for ${fmtDateTime(x.scheduledAt)}` : 'Message sent'); onClose(); }}>{later ? 'Schedule send' : 'Send'}</Btn></>}>
    <Field label="From">{id => <select id={id} value={x.mailboxId} onChange={e => set({ mailboxId: e.target.value })}>{ws.mailboxes.map(m => <option key={m.id} value={m.id}>{m.name} &lt;{m.email}&gt;</option>)}</select>}</Field>
    <Field label="To">{id => <><input id={id} list="wb-contacts" value={x.to} onChange={e => set({ to: e.target.value })} placeholder="name@company.com" /><datalist id="wb-contacts">{ws.contacts.slice(0, 80).map(c => <option key={c.id} value={c.email}>{c.firstName} {c.lastName}</option>)}</datalist></>}</Field>
    {x.to && !toOk && <p className="wb-sm" style={{ color: 'var(--bad)', marginTop: -6 }}>Enter a valid email address</p>}
    <Field label="Subject">{id => <input id={id} value={x.subject} onChange={e => set({ subject: e.target.value })} />}</Field>
    <Field label="Message">{id => <textarea id={id} value={x.body} onChange={e => set({ body: e.target.value })} style={{ minHeight: 180 }} />}</Field>
    <label className="wb-row"><input type="checkbox" style={{ width: 'auto' }} checked={later} onChange={e => { setLater(e.target.checked); if (e.target.checked && !x.scheduledAt) set({ scheduledAt: new Date(adapter.now().getTime() + 3_600_000).toISOString() }); }} /><span>Send later</span></label>
    {later && <div style={{ marginTop: 8 }}><input aria-label="Send at" type="datetime-local" value={val(x.scheduledAt)} onChange={e => e.target.value && set({ scheduledAt: new Date(e.target.value).toISOString() })} />{whenBad && <p className="wb-sm" style={{ color: 'var(--bad)' }}>Pick a time in the future</p>}</div>}
  </Modal>;
}
