// [remix] "Landing pages" tab of the Add to timeline window: every editable landing page design as a button. Clicking one
// opens the full page with its editor (the shared picker modal) with this project's video attached.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

type Design = { id: string; name: string; description: string; theme?: { bg?: string; accent?: string }; puck?: unknown; puckData?: unknown };

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
  return <div ref={ref} style={{ marginBottom: 10 }} />;
}

const field: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'inherit', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '11px 12px', fontSize: 13, marginBottom: 12 };

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
    void import('../../../lib/landingPages/templates.js').then((m: { TEMPLATES: Design[] }) => { if (live) setAll(m.TEMPLATES.filter((t) => t.puck)); });
    return () => { live = false; };
  }, []);
  const shown = useMemo(() => searchDesigns(all ?? [], q), [all, q]);
  return (
    <>
      <input type="text" placeholder="Search landing pages…" aria-label="Search landing pages" value={q} onChange={(e) => setQ(e.target.value)} style={field} />
      <div style={{ fontSize: 12.5, opacity: 0.7, marginBottom: 12 }}>Click a design to see the full page with your video in it and edit every word. Saving puts it in Video Pages.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, overflowY: 'auto', alignContent: 'start' }}>
        {all === null && <div style={{ opacity: 0.7 }}>Loading…</div>}
        {all !== null && !shown.length && <div style={{ opacity: 0.7 }}>No landing pages match.</div>}
        {shown.map((d) => (
          <button key={d.id} type="button" data-testid={`landing-design-${d.id}`} onClick={() => onPick(d.id)}
            style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)', borderRadius: 14, padding: 12 }}>
            <DesignThumb data={d.puckData} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>{d.name}</div>
            <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 4 }}>{d.description}</div>
          </button>
        ))}
      </div>
    </>
  );
}
