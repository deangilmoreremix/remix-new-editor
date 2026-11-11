// [hyperframes] Library for verified HyperFrames animations (flag-gated, additive). Same pattern as mg-templates-modal.tsx:
// search + category filter + cards; the chosen animation is added to the overlay lane at the playhead.
// Previews run in the editor's sandboxed code-preview frame (never in this page).
import { useEffect, useMemo, useRef, useState } from 'react';
import { hyperframesItems, searchHyperframes, hyperframesOverlayLayer, createHyperframesOverlay, type HfItem } from '@cinegen/lib/hyperframes/overlay';

const FPS = 30;

function Preview({ item }: { item: HfItem }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current; if (!el) return;
    let live = true; let timer = 0; let handle: { update: (m: unknown) => Promise<void>; frame: (f: number) => void; destroy: () => void } | null = null;
    void import('../../../lib/editor/remotion/codePreviewClient.js').then(async ({ createCodePreview }: { createCodePreview: (h: HTMLElement) => NonNullable<typeof handle> }) => {
      if (!live) return;
      handle = createCodePreview(el);
      const overlay = createHyperframesOverlay(item, 0);
      const layer = hyperframesOverlayLayer(overlay, FPS);
      await handle.update({ version: 1, fps: FPS, width: item.dimensions.width, height: item.dimensions.height, durationInFrames: layer.durationInFrames, background: 'transparent', layers: [layer], audio: [], transitions: [], fonts: [] });
      let f = 0; timer = window.setInterval(() => { f = (f + 1) % layer.durationInFrames; handle?.frame(f); }, 1000 / FPS);
    });
    return () => { live = false; window.clearInterval(timer); handle?.destroy(); };
  }, [item.id]);
  const ratio = item.dimensions.width / item.dimensions.height;
  return <div ref={host} aria-label={`Preview of ${item.title}`} style={{ position: 'relative', width: '100%', aspectRatio: String(ratio), maxHeight: '100%', margin: '0 auto', height: '100%', overflow: 'hidden' }} />;
}

export function HyperframesModal({ onClose, onPick }: { onClose: () => void; onPick: (item: HfItem) => void }) {
  const all = useMemo(() => hyperframesItems(), []);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('all');
  const [hover, setHover] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null); // the hovered card starts its live preview after a short pause
  useEffect(() => { setLive(null); if (!hover) return undefined; const t = window.setTimeout(() => setLive(hover), 350); return () => window.clearTimeout(t); }, [hover]);
  const tags = useMemo(() => ['all', ...[...new Set(all.flatMap((i) => [i.category]))].sort()], [all]);
  const list = searchHyperframes(all, q, tag);
  // Same look as the effects / LUTs / transitions library (occ-library-modal): same dialog, tab row, cards (cc-resource-card) and footer line.
  return (
    <div className="occ-library" role="dialog" aria-label="Animations" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' }} onClick={onClose}>
      <div style={{ width: 'min(760px, 94vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#0b1016', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, padding: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <button className="clip-properties-panel__toggle-btn" style={{ borderColor: '#22d3ee' }}>{`Animations (${all.length})`}</button>
          <input type="text" placeholder="Search animations" aria-label="Search animations" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 120, background: '#0d1218', color: 'inherit', border: '1px solid rgba(255,255,255,.18)', borderRadius: 6, padding: '4px 8px' }} />
          <select aria-label="Category" value={tag} onChange={(e) => setTag(e.target.value)} style={{ background: '#0d1218', color: 'inherit', border: '1px solid rgba(255,255,255,.18)', borderRadius: 6, padding: '4px 6px' }}>{tags.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}</select>
          <button className="clip-properties-panel__toggle-btn" aria-label="Close library" onClick={onClose}>×</button>
        </div>
        <div style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 10, paddingRight: 4 }}>
          {list.map((i) => (
            <button key={i.id} className={`cc-resource-card${hover === i.id ? ' hovered' : ''}`} onMouseEnter={() => setHover(i.id)} onMouseLeave={() => setHover(null)} onClick={() => onPick(i)} aria-label={i.title} data-testid={`animation-${i.id}`}>
              <div className="cc-resource-thumb" style={{ background: '#000' }}>
                <img src={`/hyperframes/thumbs/${i.id}.jpg`} alt="" loading="lazy" style={{ objectFit: 'contain' }} />
                {live === i.id && <div style={{ position: 'absolute', inset: 0, background: '#000' }}><Preview item={i} /></div>}
              </div>
              <span className="cc-resource-name">{i.title}</span>
            </button>
          ))}
          {!list.length && <span style={{ fontSize: 12, opacity: 0.7 }}>No animations match your search.</span>}
        </div>
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8 }}>Click a card to add it to the timeline at the playhead. Hover to preview.</div>
      </div>
    </div>
  );
}
