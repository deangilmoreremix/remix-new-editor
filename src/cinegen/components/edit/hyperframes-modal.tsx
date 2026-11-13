// [hyperframes] Library for verified HyperFrames animations (flag-gated, additive). Same pattern as mg-templates-modal.tsx:
// search + category filter + cards; the chosen animation is added to the overlay lane at the playhead.
// Previews run in the editor's sandboxed code-preview frame (never in this page).
import { useMemo, useState, type CSSProperties } from 'react';
import { hyperframesItems, searchHyperframes, type HfItem } from '@cinegen/lib/hyperframes/overlay';
import { PreviewCard } from './preview-card';
import { hfPreview } from './add-to-timeline-registry';

/** The catalog has 24 raw categories; the library shows a handful of customer-friendly groups (display only, the catalog data is unchanged). */
export const GROUPS: Array<[string, string[]]> = [
  ['Lower thirds', ['lower-third', 'broadcast']],
  ['Titles & text', ['handwritten', 'typography', 'annotation', 'branding', 'logo']],
  ['Social & UI', ['social', 'showcase', 'video-primitive']],
  ['Data & charts', ['data', 'data-viz', 'diagram', 'instrument']],
  ['Code', ['code']],
  ['Transitions', ['transition']],
  ['Backgrounds & effects', ['background', 'snow', 'starfield', 'vfx', 'camcorder', 'motion-primitive', 'placeholder']],
];
// Items that come from the second vendored library already carry customer-friendly categories; they are shown as they are.
export const RUI_CATEGORIES = ['Scenes', 'Primitives', 'Compositions', 'Data & media', 'Paths & shapes', 'Motion graphics', 'Maps & device', '3D', 'Shaders'];
export const groupOf = (i: HfItem): string => (i.type === 'remotionui' ? i.category : (GROUPS.find(([, cats]) => cats.includes(i.category))?.[0] ?? 'More'));
const typeOf = (i: HfItem): string => (i.type === 'remotionui' ? 'block' : (i.type ?? 'block'));
export { thumbOf } from './add-to-timeline-registry'; // the Library panel imports it from here
const GLYPH: Record<string, string> = { All: '▦', 'Lower thirds': '▭', 'Titles & text': 'T', 'Social & UI': '◎', 'Data & charts': '▤', Code: '</>', Transitions: '⇄', 'Backgrounds & effects': '▨', Scenes: '▣', Primitives: '◇', Compositions: '▶', 'Data & media': '♪', 'Paths & shapes': '✎', 'Motion graphics': '✺', 'Maps & device': '⌖', '3D': '◈', Shaders: '◐', More: '…' };
const TYPE_LABEL: Record<string, string> = { block: 'Animation', component: 'Component', example: 'Scene template', remotionui: 'Animation' };
const aspectOf = (w: number, h: number) => (Math.abs(w - h) < 8 ? '1:1' : w > h ? '16:9' : '9:16');
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'inherit', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '11px 12px', fontSize: 13 };
const label: CSSProperties = { fontSize: 11, letterSpacing: '.06em', fontWeight: 600, textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 };

export function HyperframesPanel({ onPick }: { onPick: (item: HfItem) => void }) {
  const all = useMemo(() => hyperframesItems(), []);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('all');
  const [type, setType] = useState('all');
  const [ratio, setRatio] = useState('all');
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const i of all) m.set(groupOf(i), (m.get(groupOf(i)) ?? 0) + 1); return m; }, [all]);
  const tags = useMemo(() => ['All', ...[...GROUPS.map(([g]) => g), ...RUI_CATEGORIES.filter((g) => !GROUPS.some(([n]) => n === g)), 'More'].filter((g) => counts.has(g))], [counts]);
  const types = useMemo(() => [...new Set(all.map(typeOf))], [all]);
  const list = searchHyperframes(all, q, 'all').filter((i) => (tag === 'all' || groupOf(i) === tag) && (type === 'all' || typeOf(i) === type) && (ratio === 'all' || aspectOf(i.dimensions.width, i.dimensions.height) === ratio));
  return (
 <>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <strong style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>▣ Choose an animation</strong>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, opacity: 0.6 }}>{all.length} animations</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.65, margin: '4px 0 12px' }}>Hover a card to play it. Click a card to add it to the timeline.</div>
          <div role="tablist" aria-label="Categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {tags.map((c) => {
              const on = tag === (c === 'All' ? 'all' : c);
              return (
                <button key={c} role="tab" aria-selected={on} onClick={() => setTag(c === 'All' ? 'all' : c)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-medium)'}`, color: on ? 'var(--accent)' : 'inherit', background: on ? 'var(--accent-dim)' : 'var(--bg-elevated)' }}>
                  <span style={{ opacity: 0.8, fontSize: 12 }}>{GLYPH[c] ?? '•'}</span>{c}
                  <span style={{ minWidth: 22, height: 20, padding: '0 6px', borderRadius: 999, boxSizing: 'border-box', display: 'inline-grid', placeItems: 'center', fontSize: 11, background: on ? 'var(--accent-dim)' : 'var(--bg-overlay)' }}>{c === 'All' ? all.length : counts.get(c)}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 18, marginBottom: 10 }}>
            <div><div style={label}>Search</div><input type="text" placeholder="⌕  Search animations…" aria-label="Search animations" value={q} onChange={(e) => setQ(e.target.value)} style={field} /></div>
            <div><div style={label}>Type</div><select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} style={field}><option value="all">All types</option>{types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}</select></div>
            <div><div style={label}>Aspect ratio</div><select aria-label="Aspect ratio" value={ratio} onChange={(e) => setRatio(e.target.value)} style={field}><option value="all">All aspect ratios</option><option value="16:9">16:9 landscape</option><option value="9:16">9:16 portrait</option><option value="1:1">1:1 square</option></select></div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, margin: '6px 0 10px' }}>Showing {list.length} of {all.length} animations</div>
          <div style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start', paddingRight: 4, minHeight: 0 }}>
            {list.map((i) => (
              <PreviewCard key={i.id} preview={hfPreview(i)} title={i.title} badge={TYPE_LABEL[typeOf(i)]} sub={`${i.duration.toFixed(0)}s · ${aspectOf(i.dimensions.width, i.dimensions.height)}${i.slow ? ' · slower export' : ''}`} onClick={() => onPick(i)} testId={`animation-${i.id}`} />
            ))}
            {!list.length && <span style={{ fontSize: 13, opacity: 0.7 }}>No animations match your search.</span>}
          </div>
        </div>
    </>
  );
}
