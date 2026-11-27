// [remix] "Personalized layouts" tab of the Add to timeline window: one-click layouts built from the previewed contact's logo, photo and details.
import { useRef, useState } from 'react';
import { personalizedLayouts } from '@cinegen/lib/overlays/personalized-layouts';
import { ContactCheckPanel } from './contact-check-panel';
import { usePreviewContact } from '@cinegen/lib/personalize/preview-contact';
import '../../styles/edit-panels.css';

type AllReady = (h: { onProgress: (done: number, total: number, who: string) => void; notify: (message: string, kind?: 'info' | 'error' | 'success') => void }) => Promise<{ total: number; done: number; message: string }>;

export function PersonalizedLayoutsPanel({ onPick, onMakeAllVideoReady, getOverlays }: { onPick: (layoutId: string) => { ok: boolean; message: string }; onMakeAllVideoReady?: AllReady; getOverlays?: () => Array<{ type: string; addon?: unknown }> }) {
  const contact = usePreviewContact();
  const [view, setView] = useState<'layouts' | 'check'>('layouts');
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null);
  const [ready, setReady] = useState<{ running: boolean; line: string }>({ running: false, line: '' });
  const lastError = useRef('');
  const runAll = async () => {
    if (!onMakeAllVideoReady || ready.running) return;
    lastError.current = '';
    setReady({ running: true, line: 'Starting…' });
    try {
      const r = await onMakeAllVideoReady({
        onProgress: (done, total, who) => setReady({ running: true, line: who ? `Making images Video Ready: ${done + 1} of ${total} (${who})…` : 'Finishing…' }),
        notify: (m, kind) => { if (kind === 'error') lastError.current = m; },
      });
      setReady({ running: false, line: `${r.message}${lastError.current ? ` ${lastError.current}` : ''}` });
    } catch (e) { setReady({ running: false, line: `Video Ready failed: ${(e as Error)?.message ?? e}` }); }
  };
  if (view === 'check' && getOverlays) return <ContactCheckPanel getOverlays={getOverlays} onBack={() => setView('layouts')} />;
  return (
    <div data-testid="personalized-layouts" className="cg-stack">
      <p className="cg-note" style={{ margin: '0 0 4px' }}>
        {contact.profile
          ? <>Layouts use <strong>{contact.nameOf(contact.profile)}</strong> (change it with “Preview as” above the video). Each contact gets their own logo, photo and details in their own video.</>
          : 'Pick a contact in “Preview as” above the video, or make one with the Personalization button. Layouts use that contact’s logo, photo and details, and every contact gets their own.'}
      </p>
      {personalizedLayouts().map((l) => (
        <div key={l.id} className="cg-row" data-testid={`layout-${l.id}`}>
          <span aria-hidden className="cg-row__icon">{l.icon}</span>
          <div className="cg-row__body">
            <div className="cg-row__title">{l.label}</div>
            <div className="cg-row__desc">{l.description}</div>
          </div>
          <button type="button" className="cg-btn" data-testid={`layout-add-${l.id}`} onClick={() => setNote(onPick(l.id))}>Add at playhead</button>
        </div>
      ))}
      {getOverlays && (
        <div className="cg-row" style={{ marginTop: 6 }} data-testid="check-contacts-row">
          <span aria-hidden className="cg-row__icon">🗂️</span>
          <div className="cg-row__body">
            <div className="cg-row__title">Check contacts</div>
            <div className="cg-row__desc">See every contact's pictures for this video, fill the missing ones with AI, and approve what it made.</div>
          </div>
          <button type="button" className="cg-btn" data-testid="check-contacts-btn" onClick={() => setView('check')}>Check contacts</button>
        </div>
      )}
      {onMakeAllVideoReady && (
        <div className="cg-row" style={{ marginTop: 6 }} data-testid="make-all-ready">
          <span aria-hidden className="cg-row__icon">✨</span>
          <div className="cg-row__body">
            <div className="cg-row__title">Make all Video Ready</div>
            <div className="cg-row__desc">Cleans up every contact's picture this video uses (background removal, fixes, a quality check), one after the other. Uses your OpenAI key.</div>
            {ready.line && <div role="status" data-testid="make-all-ready-status" className="cg-note" style={{ marginTop: 6, color: ready.running ? 'var(--text-primary)' : undefined }}>{ready.line}</div>}
          </div>
          <button type="button" className="cg-btn" data-testid="make-all-ready-btn" disabled={ready.running} onClick={() => void runAll()}>{ready.running ? 'Working…' : 'Make all Video Ready'}</button>
        </div>
      )}
      {note && !note.ok && <p role="status" data-testid="layout-note" className="cg-error" style={{ margin: 0 }}>{note.message}</p>}
    </div>
  );
}
