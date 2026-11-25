// [hyperframes] Library for verified HyperFrames animations (flag-gated, additive). Same pattern as mg-templates-modal.tsx:
// search + category filter + cards; the chosen animation is added to the overlay lane at the playhead.
// Previews run in the editor's sandboxed code-preview frame (never in this page).
import { useMemo, useState } from 'react';
import { hyperframesItems, searchHyperframes, hfGroupOf, HF_GROUPS, type HfItem } from '@cinegen/lib/hyperframes/overlay';
import { PreviewCard } from './preview-card';
import { hfPreview } from './add-to-timeline-registry';
import '../../styles/modal-shell.css';
import '../../styles/edit-modal-templates.css';

/** The customer-facing groups live in lib/hyperframes/overlay.ts (shared with the Template Generator); re-exported here for the library panel and tests. */
export const GROUPS = HF_GROUPS;
// Items that come from the second vendored library already carry customer-friendly categories; they are shown as they are.
export const RUI_CATEGORIES = ['Scenes', 'Primitives', 'Compositions', 'Data & media', 'Paths & shapes', 'Motion graphics', 'Maps & device', '3D', 'Shaders'];
export const groupOf = hfGroupOf;
const typeOf = (i: HfItem): string => (i.type === 'remotionui' ? 'block' : (i.type ?? 'block'));
export { thumbOf } from './add-to-timeline-registry'; // the Library panel imports it from here
const GLYPH: Record<string, string> = { All: '▦', 'Lower thirds': '▭', 'Titles & text': 'T', 'Social & UI': '◎', 'Data & charts': '▤', Code: '</>', Transitions: '⇄', 'Backgrounds & effects': '▨', Scenes: '▣', Primitives: '◇', Compositions: '▶', 'Data & media': '♪', 'Paths & shapes': '✎', 'Motion graphics': '✺', 'Maps & device': '⌖', '3D': '◈', Shaders: '◐', More: '…' };
const TYPE_LABEL: Record<string, string> = { block: 'Animation', component: 'Component', example: 'Scene template', remotionui: 'Animation' };
const aspectOf = (w: number, h: number) => (Math.abs(w - h) < 8 ? '1:1' : w > h ? '16:9' : '9:16');

export function HyperframesPanel({ onPick }: { onPick: (item: HfItem) => void }) {
  const all = useMemo(() => hyperframesItems(), []);
  const [q, setQ] = useState('');
  const [auto, setAuto] = useState<boolean>(() => {
    try { if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false; return localStorage.getItem('remix.animations.autoplay') !== '0'; } catch { return true; }
  });
  const [tag, setTag] = useState('all');
  const [type, setType] = useState('all');
  const [ratio, setRatio] = useState('all');
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const i of all) m.set(groupOf(i), (m.get(groupOf(i)) ?? 0) + 1); return m; }, [all]);
  const tags = useMemo(() => ['All', ...[...GROUPS.map(([g]) => g), ...RUI_CATEGORIES.filter((g) => !GROUPS.some(([n]) => n === g)), 'More'].filter((g) => counts.has(g))], [counts]);
  const types = useMemo(() => [...new Set(all.map(typeOf))], [all]);
  const list = searchHyperframes(all, q, 'all').filter((i) => (tag === 'all' || groupOf(i) === tag) && (type === 'all' || typeOf(i) === type) && (ratio === 'all' || aspectOf(i.dimensions.width, i.dimensions.height) === ratio));
  return (
    <div className="etm-fill">
      <div className="etm-head">
        <strong>▣ Choose an animation</strong>
        <span className="etm-spacer" />
        <span className="cg-note">{all.length} animations</span>
      </div>
      <div className="cg-note etm-hint"><span>Previews play as you scroll. Click a card to add it to the timeline.</span>
        <label><input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); try { localStorage.setItem('remix.animations.autoplay', e.target.checked ? '1' : '0'); } catch { /* ignore */ } }} /> Auto-play previews</label></div>
      <div role="tablist" aria-label="Categories" className="cg-chips etm-chips">
        {tags.map((c) => {
          const on = tag === (c === 'All' ? 'all' : c);
          return (
            <button key={c} type="button" role="tab" aria-selected={on} className="cg-chip etm-chip" onClick={() => setTag(c === 'All' ? 'all' : c)}>
              <span className="etm-glyph">{GLYPH[c] ?? '•'}</span>{c}
              <span className="cg-count">{c === 'All' ? all.length : counts.get(c)}</span>
            </button>
          );
        })}
      </div>
      <div className="etm-filters">
        <div><div className="cg-label">Search</div><label className="cg-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg><input type="text" placeholder="Search animations…" aria-label="Search animations" value={q} onChange={(e) => setQ(e.target.value)} /></label></div>
        <div><div className="cg-label">Type</div><select className="cg-field" aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option>{types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}</select></div>
        <div><div className="cg-label">Aspect ratio</div><select className="cg-field" aria-label="Aspect ratio" value={ratio} onChange={(e) => setRatio(e.target.value)}><option value="all">All aspect ratios</option><option value="16:9">16:9 landscape</option><option value="9:16">9:16 portrait</option><option value="1:1">1:1 square</option></select></div>
      </div>
      <div className="cg-note etm-count">Showing {list.length} of {all.length} animations</div>
      <div className="etm-cards">
        {list.map((i) => (
          <PreviewCard key={i.id} autoplay={auto} preview={hfPreview(i)} title={i.title} badge={TYPE_LABEL[typeOf(i)]} sub={`${i.duration.toFixed(0)}s · ${aspectOf(i.dimensions.width, i.dimensions.height)}${i.slow ? ' · slower export' : ''}`} onClick={() => onPick(i)} testId={`animation-${i.id}`} />
        ))}
        {!list.length && <div className="cg-empty">No animations match your search.</div>}
      </div>
    </div>
  );
}
