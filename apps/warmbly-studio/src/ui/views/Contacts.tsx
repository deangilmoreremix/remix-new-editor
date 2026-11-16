import { useMemo, useRef, useState } from 'react';
import { useWb } from '../store';
import { Badge, Btn, Card, Empty, Field, Modal, download, useConfirm } from '../kit';
import { parseCSV, toCSV } from '../../domain/analytics';
import { dedupeContacts } from '../../domain/campaign';
import type { Contact } from '../../types';

const blank = (): Omit<Contact, 'id' | 'createdAt'> => ({ email: '', firstName: '', lastName: '', company: '', title: '', tags: [], status: 'lead', fields: {} });

export function Contacts() {
  const { ws, dispatch, toast } = useWb();
  const [q, setQ] = useState(''); const [status, setStatus] = useState('any'); const [tag, setTag] = useState('any');
  const [picked, setPicked] = useState<string[]>([]);
  const [edit, setEdit] = useState<Contact | null>(null); const [adding, setAdding] = useState(false); const [importing, setImporting] = useState(false);
  const { confirm, el } = useConfirm();
  const tags = useMemo(() => [...new Set(ws.contacts.flatMap(c => c.tags))].sort(), [ws.contacts]);
  const list = ws.contacts.filter(c => (status === 'any' || c.status === status) && (tag === 'any' || c.tags.includes(tag)) && (!q || `${c.firstName} ${c.lastName} ${c.email} ${c.company}`.toLowerCase().includes(q.toLowerCase())));
  const all = list.length > 0 && list.every(c => picked.includes(c.id));
  return <div className="wb-grid">
    <div className="wb-row wrap">
      <input aria-label="Search contacts" placeholder="Search name, email, company…" style={{ width: 260 }} value={q} onChange={e => setQ(e.target.value)} />
      <select aria-label="Status" style={{ width: 140 }} value={status} onChange={e => setStatus(e.target.value)}><option value="any">All statuses</option>{['lead', 'active', 'customer', 'unsubscribed', 'bounced'].map(s => <option key={s}>{s}</option>)}</select>
      <select aria-label="Tag" style={{ width: 130 }} value={tag} onChange={e => setTag(e.target.value)}><option value="any">All tags</option>{tags.map(t => <option key={t}>{t}</option>)}</select>
      <span className="wb-sp" />
      <Btn onClick={() => download('contacts.csv', toCSV(list.map(c => ({ email: c.email, firstName: c.firstName, lastName: c.lastName, company: c.company, title: c.title, status: c.status, tags: c.tags.join(';') }))))}>Export CSV</Btn>
      <Btn onClick={() => setImporting(true)}>Import CSV</Btn><Btn pri onClick={() => setAdding(true)}>+ Contact</Btn></div>
    {picked.length > 0 && <div className="wb-card wb-row"><b>{picked.length} selected</b><Btn sm onClick={() => { const t = prompt('Tag name'); if (t) { dispatch({ type: 'contact/tag', ids: picked, tag: t.trim() }); toast('Tag added'); } }}>Add tag</Btn>
      <Btn sm dng onClick={() => confirm(`Delete ${picked.length} contacts?`, () => { dispatch({ type: 'contact/remove', ids: picked }); setPicked([]); })}>Delete</Btn><Btn sm onClick={() => setPicked([])}>Clear</Btn></div>}
    {list.length === 0 ? <Empty>No contacts match. Import a CSV or add one manually.</Empty> : <Card><table><thead><tr><th style={{ width: 30 }}><input aria-label="Select all" type="checkbox" style={{ width: 'auto' }} checked={all} onChange={() => setPicked(all ? [] : list.map(c => c.id))} /></th><th>Name</th><th>Company</th><th>Status</th><th>Tags</th></tr></thead><tbody>
      {list.map(c => <tr key={c.id} className="click" onClick={() => setEdit(c)}><td onClick={e => e.stopPropagation()}><input aria-label={`Select ${c.firstName}`} type="checkbox" style={{ width: 'auto' }} checked={picked.includes(c.id)} onChange={() => setPicked(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])} /></td>
        <td><b>{c.firstName} {c.lastName}</b><div className="wb-mute wb-sm">{c.email}</div></td><td>{c.company}<div className="wb-mute wb-sm">{c.title}</div></td>
        <td><Badge tone={c.status === 'customer' || c.status === 'active' ? 'good' : c.status === 'bounced' || c.status === 'unsubscribed' ? 'bad' : undefined}>{c.status}</Badge></td><td>{c.tags.map(t => <Badge key={t} tone="acc">{t}</Badge>)}</td></tr>)}</tbody></table></Card>}
    {adding && <ContactForm title="New contact" initial={{ ...blank(), id: '', createdAt: '' }} onClose={() => setAdding(false)} onSave={c => { const { added, skipped } = dedupeContacts(ws.contacts, [c]); if (!added.length) { toast(`Not added: ${skipped[0]}`); return false; } dispatch({ type: 'contact/import', rows: added }); toast('Contact added'); return true; }} />}
    {edit && <ContactForm title="Edit contact" initial={edit} onClose={() => setEdit(null)} onSave={c => { dispatch({ type: 'contact/update', id: c.id, patch: c }); toast('Saved'); return true; }} />}
    {importing && <ImportModal onClose={() => setImporting(false)} />}{el}
  </div>;
}

function ContactForm({ title, initial, onClose, onSave }: { title: string; initial: Contact; onClose: () => void; onSave: (c: Contact) => boolean }) {
  const [c, setC] = useState(initial); const set = (p: Partial<Contact>) => setC(x => ({ ...x, ...p }));
  const bad = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email);
  return <Modal title={title} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn pri disabled={bad} onClick={() => onSave(c) && onClose()}>Save</Btn></>}>
    <Field label="Email">{id => <input id={id} value={c.email} onChange={e => set({ email: e.target.value })} />}</Field>
    <div className="wb-grid wb-g2"><Field label="First name">{id => <input id={id} value={c.firstName} onChange={e => set({ firstName: e.target.value })} />}</Field><Field label="Last name">{id => <input id={id} value={c.lastName} onChange={e => set({ lastName: e.target.value })} />}</Field>
      <Field label="Company">{id => <input id={id} value={c.company} onChange={e => set({ company: e.target.value })} />}</Field><Field label="Title">{id => <input id={id} value={c.title} onChange={e => set({ title: e.target.value })} />}</Field></div>
    <Field label="Status">{id => <select id={id} value={c.status} onChange={e => set({ status: e.target.value as Contact['status'] })}>{['lead', 'active', 'customer', 'unsubscribed', 'bounced'].map(s => <option key={s}>{s}</option>)}</select>}</Field>
    <Field label="Tags (comma separated)">{id => <input id={id} value={c.tags.join(', ')} onChange={e => set({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />}</Field>
  </Modal>;
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const { ws, dispatch, toast } = useWb();
  const [text, setText] = useState(''); const file = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => parseCSV(text).map(r => ({ email: r.email ?? r.Email ?? '', firstName: r.firstName ?? r.first_name ?? r['First Name'] ?? '', lastName: r.lastName ?? r.last_name ?? r['Last Name'] ?? '',
    company: r.company ?? r.Company ?? '', title: r.title ?? r.Title ?? '', tags: (r.tags ?? '').split(/[;|]/).map(t => t.trim()).filter(Boolean), status: 'lead' as const, fields: {} })), [text]);
  const { added, skipped } = useMemo(() => dedupeContacts(ws.contacts, rows), [ws.contacts, rows]);
  return <Modal title="Import contacts" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn pri disabled={!added.length} onClick={() => { dispatch({ type: 'contact/import', rows: added }); toast(`Imported ${added.length} contacts`); onClose(); }}>Import {added.length}</Btn></>}>
    <p className="wb-mute wb-sm">Columns: email (required), firstName, lastName, company, title, tags (separated by ;).</p>
    <input ref={file} type="file" accept=".csv,text/csv" aria-label="CSV file" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
    <div className="wb-row" style={{ marginBottom: 8 }}><Btn onClick={() => file.current?.click()}>Choose file…</Btn><span className="wb-mute wb-sm">or paste below</span></div>
    <textarea aria-label="CSV text" value={text} onChange={e => setText(e.target.value)} placeholder={'email,firstName,company\nsam@acme.com,Sam,Acme'} style={{ minHeight: 140 }} />
    {text && <p className="wb-sm"><b>{added.length}</b> new · <b>{skipped.length}</b> skipped</p>}
    {skipped.slice(0, 5).map(s => <div key={s} className="wb-sm wb-mute">• {s}</div>)}
  </Modal>;
}
