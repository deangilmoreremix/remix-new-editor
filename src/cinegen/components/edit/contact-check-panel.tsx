// [remix] "Check contacts": a table of every contact's picture for the slots this video uses (classic editor's "Contact images" window).
import { useMemo, useRef, useState } from 'react';
import { usePreviewContact } from '@cinegen/lib/personalize/preview-contact';
import { approveAiImage, buildContactCheck, fillMissingWithAi, previewAs, removeContactImage, type CheckCell } from '@cinegen/lib/personalize/contact-check';

type Overlays = Array<{ type: string; addon?: unknown }>;
const chip = (extra: object = {}) => ({ display: 'inline-block', fontSize: 11, padding: '1px 7px', borderRadius: 999, border: '1px solid rgba(255,255,255,.2)', ...extra }) as const;

export function ContactCheckPanel({ getOverlays, onBack }: { getOverlays: () => Overlays; onBack: () => void }) {
  const contact = usePreviewContact();
  const [tick, setTick] = useState(0); // bumps after an action so the table is read again
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState('');
  const lastError = useRef('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const check = useMemo(() => buildContactCheck(getOverlays()), [contact.version, tick]);
  const kinds = [...new Set(check.jobs.map((j) => j.label))];

  const fill = async () => {
    setBusy(true); lastError.current = '';
    try {
      await fillMissingWithAi(check.jobs, { notify: () => undefined, onProgress: setLine });
    } finally { setBusy(false); setTick((n) => n + 1); }
  };
  const cell = (rowId: string, c: CheckCell) => {
    if (!c.url) return <span data-testid={`cell-${rowId}-${c.key}`} style={chip({ borderColor: '#d9a441', color: '#f2c879' })}>⚠ Missing</span>;
    return (
      <span data-testid={`cell-${rowId}-${c.key}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span aria-hidden style={{ width: 36, height: 36, borderRadius: 6, background: `#111 center / cover no-repeat url(${JSON.stringify(c.url)})`, border: '1px solid rgba(255,255,255,.15)', flex: 'none' }} />
        {c.needsReview
          ? (<>
              <span style={chip({ borderColor: '#d9a441', color: '#f2c879' })} title={c.aiPrompt ?? 'AI-made image'}>AI · review</span>
              <button type="button" className="cg-btn" data-testid={`approve-${rowId}-${c.key}`} onClick={() => { if (c.assetId) approveAiImage(rowId, c.assetId); setTick((n) => n + 1); }}>Approve</button>
              <button type="button" className="cg-btn" data-testid={`remove-${rowId}-${c.key}`} onClick={() => { if (c.assetId) removeContactImage(rowId, c.assetId); setTick((n) => n + 1); }}>Remove</button>
            </>)
          : (<>{c.aiGenerated && <span style={chip()}>AI</span>}{c.videoReady && <span style={chip()}>✓ Ready</span>}</>)}
      </span>
    );
  };

  return (
    <div data-testid="contact-check" style={{ display: 'grid', gap: 12, padding: '4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="cg-btn" data-testid="contact-check-back" onClick={onBack}>← Layouts</button>
        <strong>Contact images</strong>
      </div>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.75, lineHeight: 1.6 }}>
        {check.fromTimeline ? 'The pictures this video uses, for every contact.' : 'No Personalized Images on the timeline yet: showing the main contact pictures.'} Click a name to preview the video as that contact.
      </p>
      {!check.rows.length && <p data-testid="contact-check-empty" style={{ margin: 0, fontSize: 13 }}>Add contacts with the Personalization button on the Overlays lane first.</p>}
      {check.jobs.length > 0 && (
        <div data-testid="ai-fill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-input)' }}>
          <span style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.8 }}>{check.jobs.length} missing picture{check.jobs.length === 1 ? '' : 's'} ({kinds.join(', ')}) can be made with AI from each contact's business details. Each one is a paid AI call on your OpenAI key, and they stay marked "AI · review" until you approve them.</span>
          <button type="button" className="cg-btn" data-testid="ai-fill-btn" disabled={busy} onClick={() => void fill()}>{busy ? 'Working…' : `✨ Fill ${check.jobs.length} with AI`}</button>
        </div>
      )}
      {check.skipped.length > 0 && (
        <p data-testid="ai-skipped" style={{ margin: 0, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>{check.skipped.length} missing picture{check.skipped.length === 1 ? '' : 's'} can't be made with AI yet: add business details (name, industry or product / service) in the Personalize window. Logos, photos and call-to-action graphics are never made with AI.</p>
      )}
      {line && <p role="status" data-testid="ai-fill-status" style={{ margin: 0, fontSize: 12 }}>{line}</p>}
      {check.rows.length > 0 && (
        <div style={{ overflow: 'auto', maxHeight: '48vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={{ textAlign: 'left', padding: '6px 8px' }}>Contact</th>{check.columns.map((c) => <th key={c.key} style={{ textAlign: 'left', padding: '6px 8px' }}>{c.label}</th>)}</tr></thead>
            <tbody>
              {check.rows.map((r) => (
                <tr key={r.id} data-testid={`row-${r.id}`} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                  <td style={{ padding: '8px' }}>
                    <button type="button" className="cg-btn" data-testid={`preview-${r.id}`} title={`Preview the video as ${r.name}`} aria-pressed={contact.profile?.id === r.id} onClick={() => previewAs(r.id)}>{r.name}</button>
                  </td>
                  {r.cells.map((c) => <td key={c.key} style={{ padding: '8px' }}>{cell(r.id, c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
