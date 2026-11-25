// [remix] "Landing pages" tab of the Add to timeline window: every editable landing page design as a button. Clicking one
// opens the full page with its editor (the shared picker modal) with this project's video attached.
import { useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/edit-panels.css';

type Design = { id: string; name: string; description: string; theme?: { bg?: string; accent?: string }; editable?: unknown; editorData?: unknown };

/** Live, scaled picture of the real page (drawn when the card scrolls into view). */
function DesignThumb({ data }: { data: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let handle: { destroy: () => void } | null = null;
    let gone = false;
    // @ts-expect-error plain JS module
    void import('../../../lib/landingPages/designPreview.js').then((m: { attachDesignPreview: (h: HTMLElement, d: unknown) => { destroy: () => void } }) => {
      if (!gone) handle = m.attachDesignPreview(el, data);
    });
    return () => { gone = true; handle?.destroy(); };
  }, [data]);
  return <div ref={ref} className="cg-landing-thumb" />;
}

/** Pure: designs matching a search text. */
export function searchDesigns<T extends { name: string; description: string }>(items: T[], q: string): T[] {
  const s = q.trim().toLowerCase();
  return s ? items.filter((d) => `${d.name} ${d.description}`.toLowerCase().includes(s)) : items;
}

export function LandingPagesPanel({ onPick }: { onPick: (designId: string) => void }) {
  const [all, setAll] = useState<Design[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    let live = true;
    // @ts-expect-error plain JS module
    void import('../../../lib/landingPages/templates.js').then((m: { TEMPLATES: Design[] }) => { if (live) setAll(m.TEMPLATES.filter((t) => t.editable)); });
    return () => { live = false; };
  }, []);
  const shown = useMemo(() => searchDesigns(all ?? [], q), [all, q]);
  return (
    <>
      <input type="text" placeholder="Search landing pages…" aria-label="Search landing pages" value={q} onChange={(e) => setQ(e.target.value)} className="cg-field" style={{ marginBottom: 12 }} />
      <div className="cg-note" style={{ marginBottom: 12 }}>Click a design to see the full page with your video in it and edit every word. Saving puts it in Video Pages.</div>
      <div className="cg-landing-grid">
        {all === null && <div className="cg-note">Loading…</div>}
        {all !== null && !shown.length && <div className="cg-empty">No landing pages match.</div>}
        {shown.map((d) => (
          <button key={d.id} type="button" className="cg-card" data-testid={`landing-design-${d.id}`} onClick={() => onPick(d.id)}>
            <DesignThumb data={d.editorData} />
            <div className="cg-card__name">{d.name}</div>
            <div className="cg-landing-desc">{d.description}</div>
          </button>
        ))}
      </div>
    </>
  );
}
