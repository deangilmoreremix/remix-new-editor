// [remix] Publish > Contacts: everyone you can reach, in one list. Imported contacts, people who filled in a form on your video, and
// contacts on your landing pages, with the same person shown once. Import a CSV, search, filter by where they came from, export a CSV.
import { useMemo, useRef, useState } from 'react';
import { CONTACT_SOURCE_LABEL, contactsToCsv, filterContacts, sourceCounts, type SourceFilter } from '@cinegen/lib/publish/contacts';
import { useContacts } from './use-contacts';
import { ChipRow, FilterField, PanelHead } from './publish-ui';

const CHIPS: Array<{ id: SourceFilter; label: string; glyph: string }> = [
  { id: 'all', label: 'Everyone', glyph: '👥' }, { id: 'imported', label: CONTACT_SOURCE_LABEL.imported, glyph: '⬆' },
  { id: 'leads', label: CONTACT_SOURCE_LABEL.leads, glyph: '📝' }, { id: 'landing', label: CONTACT_SOURCE_LABEL.landing, glyph: '🌐' },
];
const PAGE = 50;

export function ContactsPanel() {
  const data = useContacts();
  const [source, setSource] = useState<SourceFilter>('all');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [note, setNote] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => sourceCounts(data.contacts, q), [data.contacts, q]);
  const list = useMemo(() => filterContacts(data.contacts, source, q), [data.contacts, source, q]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const r = data.importCsv(await f.text());
    if (!r.hasEmailColumn) { setNote('That file has no email column, so nothing was imported. Add a column named “Email” and try again.'); return; }
    const why = [...new Set(r.skipped.map((s) => s.reason))].join(', ');
    setNote(`${r.added} contact${r.added === 1 ? '' : 's'} imported${r.skipped.length ? `, ${r.skipped.length} skipped (${why})` : ''}.`);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([contactsToCsv(list)], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'contacts.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="pub-panel" data-testid="publish-contacts">
      <PanelHead title="Contacts" sub="Everyone you can reach, in one list. The same email is shown once, even if it came from more than one place."
        right={<div className="pub-actions">
          <input ref={file} type="file" accept=".csv,text/csv,text/plain" hidden data-testid="contacts-file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f); }} />
          <button type="button" className="pub-btn pub-btn--primary" data-testid="contacts-import" onClick={() => file.current?.click()}>Import CSV</button>
          <button type="button" className="pub-btn" data-testid="contacts-export" disabled={!list.length} onClick={download}>Download CSV</button>
          <button type="button" className="pub-btn" onClick={() => void data.reload()} disabled={data.loading}>{data.loading ? 'Loading…' : 'Refresh'}</button>
        </div>} />
      <ChipRow label="Where they came from" active={source} onPick={(id) => { setSource(id as SourceFilter); setShown(PAGE); }} chips={CHIPS.map((c) => ({ ...c, count: counts[c.id] }))} />
      <div className="pub-filters"><FilterField label="Search"><input className="pub-input" type="search" placeholder="Search name, email, company…" aria-label="Search contacts" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} /></FilterField></div>
      {note && <p className="pub-note" role="status" data-testid="contacts-note">{note}</p>}
      {(Object.entries(data.problems) as Array<[keyof typeof CONTACT_SOURCE_LABEL, string]>).map(([s, msg]) => <p key={s} className="pub-warn" data-testid={`contacts-problem-${s}`}>{CONTACT_SOURCE_LABEL[s]} could not be loaded: {msg}. The other sources are still shown.</p>)}
      <div className="pub-summary">Showing {Math.min(shown, list.length)} of {list.length} contacts</div>
      {list.length ? (
        <div className="pub-tablewrap">
          <table className="pub-table" data-testid="contacts-table">
            <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Came from</th><th /></tr></thead>
            <tbody>
              {list.slice(0, shown).map((c) => (
                <tr key={c.key} data-testid="contact-row">
                  <td>{c.name || '—'}</td><td>{c.email || '—'}</td><td>{c.company || '—'}</td>
                  <td>{c.sources.map((s) => <span key={s} className="pub-pill">{CONTACT_SOURCE_LABEL[s]}</span>)}</td>
                  <td>{c.removableId && <button type="button" className="pub-link" aria-label={`Remove ${c.email || c.name}`} onClick={() => data.remove(c)}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="pub-empty" data-testid="contacts-empty">{data.contacts.length ? 'No contacts match.' : 'No contacts yet. Import a CSV with an Email column, or publish your video and collect leads from its forms.'}</p>
      )}
      {shown < list.length && <button type="button" className="pub-more" onClick={() => setShown((n) => n + PAGE)}>Show more ({list.length - shown} left)</button>}
    </div>
  );
}
