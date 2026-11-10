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
  return <div ref={host} aria-label={`Preview of ${item.title}`} style={{ position: 'relative', width: '100%', aspectRatio: String(ratio), maxHeight: 260, background: 'repeating-conic-gradient(#1b2230 0% 25%, #121722 0% 50%) 50% / 16px 16px', borderRadius: 6, overflow: 'hidden' }} />;
}

export function HyperframesModal({ onClose, onPick }: { onClose: () => void; onPick: (item: HfItem) => void }) {
  const all = useMemo(() => hyperframesItems(), []);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('all');
  const [sel, setSel] = useState<HfItem | null>(null);
  const tags = useMemo(() => ['all', ...[...new Set(all.flatMap((i) => [i.category]))].sort()], [all]);
  const list = searchHyperframes(all, q, tag);
  return (
    <div role="dialog" aria-label="HyperFrames animations" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' }} onClick={onClose}>
      <div style={{ width: 'min(900px, 94vw)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', background: '#0b1016', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, padding: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <strong style={{ flex: 1 }}>HyperFrames animations</strong>
          <button className="clip-properties-panel__toggle-btn" onClick={onClose}>Close</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input type="text" placeholder="Search" aria-label="Search animations" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, background: 'transparent', color: 'inherit', border: '1px solid rgba(255,255,255,.18)', borderRadius: 6, padding: '4px 8px' }} />
          <select aria-label="Category" value={tag} onChange={(e) => setTag(e.target.value)} style={{ background: 'transparent', color: 'inherit', border: '1px solid rgba(255,255,255,.18)', borderRadius: 6 }}>{tags.map((c) => <option key={c} value={c} style={{ color: '#000' }}>{c}</option>)}</select>
        </div>
        <div style={{ display: 'flex', gap: 12, minHeight: 0, flex: 1 }}>
          <div style={{ overflow: 'auto', flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, alignContent: 'start' }}>
            {list.map((i) => (
              <button key={i.id} title={i.description} onClick={() => setSel(i)}
                style={{ textAlign: 'left', padding: 8, borderRadius: 8, border: `1px solid ${sel?.id === i.id ? '#4cc9f0' : 'rgba(255,255,255,.14)'}`, background: 'rgba(255,255,255,.04)', color: 'inherit', cursor: 'pointer' }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{i.title}</div>
                <div style={{ fontSize: 10, opacity: 0.65 }}>{i.category} · {i.dimensions.width}×{i.dimensions.height} · {i.duration.toFixed(1)}s</div>
              </button>
            ))}
            {!list.length && <span style={{ fontSize: 12, opacity: 0.7 }}>No verified animations match.</span>}
          </div>
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sel ? (
              <>
                <Preview item={sel} />
                <div style={{ fontSize: 12, fontWeight: 600 }}>{sel.title}</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>{sel.description}</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>Editable: {sel.editables.length ? sel.editables.map((e) => e.label).join(', ') : 'none'}</div>
                <button className="clip-properties-panel__toggle-btn" onClick={() => onPick(sel)}>Add to timeline at playhead</button>
              </>
            ) : <span style={{ fontSize: 12, opacity: 0.7 }}>Select an animation to preview it.</span>}
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8 }}>{all.length} verified animations (pinned upstream catalog). Others are not offered until they pass browser-export checks.</div>
      </div>
    </div>
  );
}
