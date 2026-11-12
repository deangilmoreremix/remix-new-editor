// [remix] One place to add anything to the timeline (replaces the "+ Add overlay…" dropdown): Animations, Motion graphics,
// Smart Speech, Template Generator, Personalization, the basic overlays and the End screen / Connect form templates.
// The cards come from add-to-timeline-registry.ts (every entry carries its own preview) and are drawn by preview-card.tsx.
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { HyperframesPanel } from './hyperframes-modal';
import { MgTemplatesPanel } from './mg-templates-modal';
import { PreviewCard } from './preview-card';
import { buildCatalog, type AddToTimelineActions, type CatalogEntry } from './add-to-timeline-registry';

export type { AddToTimelineActions } from './add-to-timeline-registry';

type Tab = 'all' | 'animations' | 'motion' | CatalogEntry['tab'];

const INK = 'rgba(229,237,245,.9)';
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'inherit', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '11px 12px', fontSize: 13 };

export function AddToTimelineModal({ onClose, actions }: { onClose: () => void; actions: AddToTimelineActions }) {
  const [tab, setTab] = useState<Tab>(actions.onPickAnimation ? 'animations' : 'motion');
  const [q, setQ] = useState('');
  const [connect, setConnect] = useState<string | null>(null); // Connect Form template waiting for its phone number
  const [phone, setPhone] = useState('');
  const a = actions;

  // Everything that is a single click lives in one catalog, so adding a feature later is one more entry there.
  // The parent passes fresh closures on every render; the catalog is built once and calls the latest ones through a ref, so card
  // previews keep their identity (a rebuilt preview would restart every live render).
  const latest = useRef({ a, onClose });
  latest.current = { a, onClose };
  const [hasGen, hasPers] = [!!a.onOpenGenerator, !!a.onOpenPersonalization];
  const entries = useMemo(() => {
    const L = () => latest.current.a;
    const proxy: AddToTimelineActions = {
      onPickMotion: (t) => L().onPickMotion(t), onAddKind: (k) => L().onAddKind(k), onAddTemplate: (id, p) => L().onAddTemplate(id, p),
      onOpenGenerator: hasGen ? () => L().onOpenGenerator?.() : undefined, onOpenPersonalization: hasPers ? () => L().onOpenPersonalization?.() : undefined,
    };
    return buildCatalog(proxy, { close: () => latest.current.onClose(), askPhone: (id) => { setConnect(id); setPhone(''); } });
  }, [hasGen, hasPers]);

  const TABS: Array<{ id: Tab; label: string; glyph: string; count?: number; hidden?: boolean }> = [
    { id: 'all', label: 'All', glyph: '▦' },
    { id: 'animations', label: 'Animations', glyph: '✦', hidden: !a.onPickAnimation },
    { id: 'motion', label: 'Motion graphics', glyph: '✺' },
    { id: 'ai', label: 'AI & personalization', glyph: '✦', count: entries.filter((e) => e.tab === 'ai').length },
    { id: 'overlays', label: 'Overlays & forms', glyph: '▭', count: entries.filter((e) => e.tab === 'overlays').length },
    { id: 'endscreens', label: 'End screens & connect forms', glyph: '▶', count: entries.filter((e) => e.tab === 'endscreens').length },
  ];

  const needle = q.trim().toLowerCase();
  const shown = entries.filter((e) => (tab === 'all' || e.tab === tab) && (!needle || `${e.label} ${e.blurb}`.toLowerCase().includes(needle)));
  const isPanel = tab === 'animations' || tab === 'motion';
  const pending = connect ? entries.find((e) => e.id === `tpl:${connect}`) : undefined;

  return (
    <div role="dialog" aria-label="Add to timeline" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', padding: 16 }} onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <style>{'.add-card:hover{border-color:var(--accent)!important}'}</style>
      <div style={{ width: 'min(1480px, 96vw)', height: 'min(900px, 92vh)', display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', border: '1px solid var(--border-medium)', borderRadius: 26, color: INK, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '24px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 20 }}>＋</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Add to timeline</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, maxWidth: 720 }}>Animations, motion graphics, overlays, forms and end screens. Hover a card to preview it, click to place it at the playhead, then edit it in the panel.</div>
          </div>
          <button aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 0, color: 'inherit', fontSize: 22, cursor: 'pointer', padding: 6 }}>×</button>
        </div>
        <div role="tablist" aria-label="Categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 20px 0' }}>
          {TABS.filter((t) => !t.hidden).map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-medium)'}`, color: on ? 'var(--accent)' : 'inherit', background: on ? 'var(--accent-dim)' : 'var(--bg-elevated)' }}>
                <span style={{ opacity: 0.8, fontSize: 12 }}>{t.glyph}</span>{t.label}
                {t.count !== undefined && <span style={{ minWidth: 22, height: 20, padding: '0 6px', borderRadius: 999, boxSizing: 'border-box', display: 'inline-grid', placeItems: 'center', fontSize: 11, background: on ? 'var(--accent-dim)' : 'var(--bg-overlay)' }}>{t.count}</span>}
              </button>
            );
          })}
        </div>
        {isPanel ? (
          // These two are big catalogs with their own search, categories and filters
          <div style={{ margin: '14px 20px 20px', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, background: 'var(--bg-base)' }}>
            {tab === 'animations' && a.onPickAnimation && <HyperframesPanel onPick={(i) => { a.onPickAnimation?.(i); onClose(); }} />}
            {tab === 'motion' && <MgTemplatesPanel onPick={(t) => { a.onPickMotion(t); onClose(); }} />}
          </div>
        ) : (
          <div style={{ margin: '14px 20px 20px', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, background: 'var(--bg-base)' }}>
            <input type="text" autoFocus placeholder="⌕  Search overlays, forms, end screens…" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...field, marginBottom: 12 }} />
            {tab === 'all' && !needle && <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 10 }}>Animations and Motion graphics have their own tabs with search and filters.</div>}
            {pending && (
              <form onSubmit={(e) => { e.preventDefault(); a.onAddTemplate(pending.id.slice(4), phone.trim() || undefined); onClose(); }}
                style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, padding: 12, border: '1px solid var(--accent)', borderRadius: 12, background: 'var(--accent-dim)' }}>
                <span style={{ fontSize: 13, flex: '0 0 auto' }}>Phone number the buttons should dial</span>
                <input type="tel" autoFocus placeholder="212 555 0147" aria-label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...field, flex: 1, padding: '8px 10px' }} />
                <button type="submit" style={{ padding: '8px 14px', borderRadius: 10, border: 0, background: 'var(--accent)', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Add</button>
                <button type="button" onClick={() => setConnect(null)} style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer' }}>Cancel</button>
              </form>
            )}
            <div style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start', paddingRight: 4, minHeight: 0 }}>
              {shown.map((e) => (
                <PreviewCard key={e.id} preview={e.preview} title={e.label} sub={e.blurb} badge={e.badge} onClick={e.run} testId={`add-${e.id}`} />
              ))}
              {!shown.length && <span style={{ fontSize: 13, opacity: 0.7 }}>Nothing matches your search.</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
