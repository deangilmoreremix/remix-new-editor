// [remix] "Check contacts": a table of every contact's picture for the slots this video uses (classic editor's "Contact images" window).
import { useMemo, useRef, useState } from 'react';
import { usePreviewContact } from '@cinegen/lib/personalize/preview-contact';
import '../../styles/edit-panels.css';
import { approveAiImage, buildContactCheck, fillMissingWithAi, previewAs, removeContactImage, type CheckCell } from '@cinegen/lib/personalize/contact-check';

type Overlays = Array<{ type: string; addon?: unknown }>;

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
    if (!c.url) return <span data-testid={`cell-${rowId}-${c.key}`} className="cg-pill cg-pill--warn">⚠ Missing</span>;
    return (
      <span data-testid={`cell-${rowId}-${c.key}`} className="cg-cell">
        <span aria-hidden className="cg-swatch" style={{ backgroundImage: `url(${JSON.stringify(c.url)})` }} />
        {c.needsReview
          ? (<>
              <span className="cg-pill cg-pill--warn" title={c.aiPrompt ?? 'AI-made image'}>AI · review</span>
              <button type="button" className="cg-btn" data-testid={`approve-${rowId}-${c.key}`} onClick={() => { if (c.assetId) approveAiImage(rowId, c.assetId); setTick((n) => n + 1); }}>Approve</button>
              <button type="button" className="cg-btn" data-testid={`remove-${rowId}-${c.key}`} onClick={() => { if (c.assetId) removeContactImage(rowId, c.assetId); setTick((n) => n + 1); }}>Remove</button>
            </>)
          : (<>{c.aiGenerated && <span className="cg-pill">AI</span>}{c.videoReady && <span className="cg-pill">✓ Ready</span>}</>)}
      </span>
    );
  };

  return (
    <div data-testid="contact-check" className="cg-stack" style={{ gap: 12 }}>
      <div className="cg-head">
        <button type="button" className="cg-btn" data-testid="contact-check-back" onClick={onBack}>← Layouts</button>
        <strong>Contact images</strong>
      </div>
      <p className="cg-note" style={{ margin: 0 }}>
        {check.fromTimeline ? 'The pictures this video uses, for every contact.' : 'No Personalized Images on the timeline yet: showing the main contact pictures.'} Click a name to preview the video as that contact.
      </p>
      {!check.rows.length && <p data-testid="contact-check-empty" className="cg-empty" style={{ margin: 0 }}>Add contacts with the Personalization button on the Overlays lane first.</p>}
      {check.jobs.length > 0 && (
        <div data-testid="ai-fill" className="cg-row cg-row--banner">
          <span className="cg-note">{check.jobs.length} missing picture{check.jobs.length === 1 ? '' : 's'} ({kinds.join(', ')}) can be made with AI from each contact's business details. Each one is a paid AI call on your OpenAI key, and they stay marked "AI · review" until you approve them.</span>
          <button type="button" className="cg-btn" data-testid="ai-fill-btn" disabled={busy} onClick={() => void fill()}>{busy ? 'Working…' : `✨ Fill ${check.jobs.length} with AI`}</button>
        </div>
      )}
      {check.skipped.length > 0 && (
        <p data-testid="ai-skipped" className="cg-note" style={{ margin: 0 }}>{check.skipped.length} missing picture{check.skipped.length === 1 ? '' : 's'} can't be made with AI yet: add business details (name, industry or product / service) in the Personalize window. Logos, photos and call-to-action graphics are never made with AI.</p>
      )}
      {line && <p role="status" data-testid="ai-fill-status" className="cg-note" style={{ margin: 0 }}>{line}</p>}
      {check.rows.length > 0 && (
        <div className="cg-table-wrap">
          <table className="cg-table">
            <thead><tr><th>Contact</th>{check.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>
              {check.rows.map((r) => (
                <tr key={r.id} data-testid={`row-${r.id}`}>
                  <td>
                    <button type="button" className="cg-btn" data-testid={`preview-${r.id}`} title={`Preview the video as ${r.name}`} aria-pressed={contact.profile?.id === r.id} onClick={() => previewAs(r.id)}>{r.name}</button>
                  </td>
                  {r.cells.map((c) => <td key={c.key}>{cell(r.id, c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
