// [remix] Publish > Email. Honest by design: this does not send email. It adds your contacts to YOUR MailerLite account, each with the video
// link in a "video page url" field, so your own campaign there sends it. Four steps on one page: connect, choose who, add the link, send.
// Kit can already receive NEW leads from your video forms (set up in the form's settings); pushing a contact list to Kit is not built yet.
import { useEffect, useMemo, useState } from 'react';
// @ts-expect-error plain JS MailerLite sync client (the same one the landing pages use)
import { callSync, getSyncKey, pushInBatches, setSyncKey } from '../../../lib/landingPages/syncClient.js';
// @ts-expect-error plain JS
import { watchUrl } from '../../../lib/editor/publish/publishClient.js';
import { usePublished } from '../leads/use-publish';
import { CONTACT_SOURCE_LABEL, filterContacts, sourceCounts, type SourceFilter } from '@cinegen/lib/publish/contacts';
import { BLOCK_TEXT, cleanLink, describePush, sendBlocker, toPushRows, type PushResult } from '@cinegen/lib/publish/email-sync';
import { useContacts } from './use-contacts';
import { ChipRow, FilterField, PanelHead } from './publish-ui';

type Conn = 'none' | 'checking' | 'ok' | 'bad';
const CHIPS: Array<{ id: SourceFilter; label: string; glyph: string }> = [
  { id: 'all', label: 'Everyone', glyph: '👥' }, { id: 'imported', label: CONTACT_SOURCE_LABEL.imported, glyph: '⬆' },
  { id: 'leads', label: CONTACT_SOURCE_LABEL.leads, glyph: '📝' }, { id: 'landing', label: CONTACT_SOURCE_LABEL.landing, glyph: '🌐' },
];

export function EmailPanel() {
  const data = useContacts();
  const pub = usePublished();
  const live = !!pub.info?.published && !!pub.id;

  // 1 Connect
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(() => !!getSyncKey());
  const [conn, setConn] = useState<Conn>('none');
  const [connError, setConnError] = useState('');
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [groupId, setGroupId] = useState('');
  const check = async () => {
    setConn('checking'); setConnError('');
    try { await callSync('check'); const g = await callSync('groups'); setGroups(g.groups ?? []); setConn('ok'); }
    catch (e) { setConn('bad'); setConnError(e instanceof Error ? e.message : 'Could not reach MailerLite'); }
  };
  useEffect(() => { if (hasKey) void check(); /* check once when a key is already saved */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const connect = async () => { if (!keyInput.trim()) return; setSyncKey(keyInput.trim()); setKeyInput(''); setHasKey(true); await check(); };
  const disconnect = () => { setSyncKey(''); setHasKey(false); setConn('none'); setGroups([]); setGroupId(''); };

  // 2 Who
  const [source, setSource] = useState<SourceFilter>('all');
  const counts = useMemo(() => sourceCounts(data.contacts, ''), [data.contacts]);
  const audience = useMemo(() => filterContacts(data.contacts, source, '', true), [data.contacts, source]);

  // 3 Link
  const [link, setLink] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!touched && live && pub.id) setLink(watchUrl(pub.id)); }, [live, pub.id, touched]);

  // 4 Send
  const rows = useMemo(() => toPushRows(audience, link), [audience, link]);
  const block = sendBlocker({ hasKey, connected: conn === 'ok', rows: rows.length, link });
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState('');
  const [sendError, setSendError] = useState('');
  const send = async () => {
    setSending(true); setResult(''); setSendError(''); setProgress('');
    try {
      const r = (await pushInBatches(rows, { groupId: groupId || null, onProgress: (done: number, total: number) => setProgress(`Sending… ${done} of ${total}`) })) as PushResult;
      setResult(describePush(r, rows.length, groups.find((g) => g.id === groupId)?.name ?? null));
    } catch (e) { setSendError(e instanceof Error ? e.message : 'Something went wrong. Nothing more was sent.'); }
    setSending(false); setProgress('');
  };

  return (
    <div className="pub-panel" data-testid="publish-email">
      <PanelHead title="Email your contacts" sub="Add your contacts and your video link to your MailerLite account, then send your campaign from there. We don't send the emails." />

      <section className="pub-step" data-testid="email-step-connect">
        <div className="pub-step__title"><span className="pub-step__num">1</span> Connect MailerLite</div>
        {conn === 'ok' ? (
          <div className="pub-row"><span className="pub-pill pub-pill--ok" data-testid="email-connected">Connected</span><button type="button" className="pub-btn" onClick={disconnect}>Disconnect</button></div>
        ) : (
          <>
            <div className="pub-row">
              <input className="pub-input" type="password" autoComplete="off" placeholder="Paste your MailerLite API token" aria-label="MailerLite API token" data-testid="email-key" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} style={{ maxWidth: 420 }} />
              <button type="button" className="pub-btn pub-btn--primary" data-testid="email-connect" disabled={!keyInput.trim() || conn === 'checking'} onClick={() => void connect()}>{conn === 'checking' ? 'Checking…' : 'Connect'}</button>
              {hasKey && conn === 'bad' && <button type="button" className="pub-btn" onClick={disconnect}>Remove saved token</button>}
            </div>
            {conn === 'bad' && <p className="pub-error" role="alert" data-testid="email-conn-error">{connError}</p>}
            <p className="pub-hint">The token stays in this browser and is sent only when you press a button here. Get one in MailerLite under Integrations › API.</p>
          </>
        )}
        <p className="pub-hint" data-testid="email-kit-note">Using Kit? New leads from your video forms can already go to Kit (set it up in the form’s settings). Sending a whole contact list to Kit is not built yet.</p>
      </section>

      <section className="pub-step" data-testid="email-step-who">
        <div className="pub-step__title"><span className="pub-step__num">2</span> Who should get it?</div>
        <ChipRow label="Contacts to send" active={source} onPick={(id) => setSource(id as SourceFilter)} chips={CHIPS.map((c) => ({ ...c, count: counts[c.id] }))} />
        <p className="pub-hint" data-testid="email-audience">{audience.length} contact{audience.length === 1 ? '' : 's'} with an email address{data.contacts.length > audience.length && source === 'all' ? ` (${data.contacts.length - audience.length} without an email are left out)` : ''}. Manage the list in the Contacts section.</p>
      </section>

      <section className="pub-step" data-testid="email-step-link">
        <div className="pub-step__title"><span className="pub-step__num">3</span> Which video link?</div>
        <FilterField label="Video link">
          <input className="pub-input" type="url" placeholder="https://…" aria-label="Video link" data-testid="email-link" value={link} onChange={(e) => { setLink(e.target.value); setTouched(true); }} />
        </FilterField>
        {!live && <p className="pub-hint" data-testid="email-not-published">Your video is not published yet. Publish it in Share & Leads and its link fills in here, or paste any https link.</p>}
        {link && !cleanLink(link) && <p className="pub-warn">That link needs to start with https://</p>}
      </section>

      <section className="pub-step" data-testid="email-step-send">
        <div className="pub-step__title"><span className="pub-step__num">4</span> Add them to MailerLite</div>
        {groups.length > 0 && (
          <FilterField label="Add to group (optional)">
            <select className="pub-input" aria-label="MailerLite group" value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ maxWidth: 420 }}>
              <option value="">No group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </FilterField>
        )}
        <p className="pub-summary" data-testid="email-summary">{rows.length} contact{rows.length === 1 ? '' : 's'} will be added to your MailerLite account{groupId ? ` in the “${groups.find((g) => g.id === groupId)?.name}” group` : ''}, each with the video link saved in a “video page url” field. No email is sent.</p>
        <div className="pub-row">
          <button type="button" className="pub-btn pub-btn--primary" data-testid="email-send" disabled={!!block || sending} onClick={() => void send()}>{sending ? progress || 'Sending…' : 'Add to MailerLite'}</button>
          {block && <span className="pub-hint" data-testid="email-blocker">{BLOCK_TEXT[block]}</span>}
        </div>
        {result && <p className="pub-note" role="status" data-testid="email-result">{result}</p>}
        {sendError && <p className="pub-error" role="alert" data-testid="email-send-error">{sendError}</p>}
      </section>
    </div>
  );
}
