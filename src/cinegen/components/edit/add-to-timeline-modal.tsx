// [remix] One place to add anything to the timeline (replaces the "+ Add overlay…" dropdown): Animations, Motion graphics,
// the basic overlays and the End screen / Connect form templates. Smart Speech, Template Generator and Personalization have
// their own modals (buttons in the overlay lane header), so they are not part of this one.
// The cards come from add-to-timeline-registry.ts (every entry carries its own preview) and are drawn by preview-card.tsx.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { hyperframesItems } from '@cinegen/lib/hyperframes/overlay';
import { loadMgTemplates, type MgTemplate } from '@cinegen/lib/occ/mg-templates';
import { HyperframesPanel } from './hyperframes-modal';
import { MgTemplatesPanel, MgLoadError } from './mg-templates-modal';
import { PreviewCard, CARD_CSS } from './preview-card';
import { buildCatalog, hfEntries, mgEntries, type AddToTimelineActions, type CatalogEntry, type CatalogTab } from './add-to-timeline-registry';

export type { AddToTimelineActions } from './add-to-timeline-registry';

type Tab = 'all' | CatalogTab;

// The hover-help layer also opens a card when a field gets keyboard focus. These two fields are focused automatically, so a help card would pop up
// over the cards every time a tab opens; their labels are constants (not literals) so no help entry is looked up for them.
const SEARCH_LABEL = 'Search';
const PHONE_LABEL = 'Phone number';
const INK = 'rgba(229,237,245,.9)';
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'inherit', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '11px 12px', fontSize: 13 };
const SECTIONS: Array<{ tab: CatalogTab; title: string }> = [
  { tab: 'animations', title: 'Animations' }, { tab: 'motion', title: 'Motion graphics' }, { tab: 'overlays', title: 'Overlays & forms' }, { tab: 'endscreens', title: 'End screens & connect forms' },
];
const chip = (on: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-medium)'}`, color: on ? 'var(--accent)' : 'inherit', background: on ? 'var(--accent-dim)' : 'var(--bg-elevated)' });
const badge = (on: boolean): CSSProperties => ({ minWidth: 22, height: 20, padding: '0 6px', borderRadius: 999, boxSizing: 'border-box', display: 'inline-grid', placeItems: 'center', fontSize: 11, background: on ? 'var(--accent-dim)' : 'var(--bg-overlay)' });
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start' };

export function AddToTimelineModal({ onClose, actions }: { onClose: () => void; actions: AddToTimelineActions }) {
  const titleId = useId();
  const hasAnimations = !!actions.onPickAnimation;
  const [tab, setTab] = useState<Tab>(hasAnimations ? 'animations' : 'motion');
  const [q, setQ] = useState('');
  const [connect, setConnect] = useState<string | null>(null); // Connect Form template waiting for its phone number
  const [phone, setPhone] = useState('');
  // The motion graphics are loaded once here and shared by the Motion graphics tab and the All tab (null while loading)
  const [mg, setMg] = useState<MgTemplate[] | null>(null);
  const [mgError, setMgError] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const loadMg = useCallback(() => {
    setMgError(false);
    void loadMgTemplates().then((t) => { if (alive.current) setMg(t); }, () => { if (alive.current) { setMg([]); setMgError(true); } });
  }, []);
  useEffect(() => { loadMg(); }, [loadMg]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The parent passes fresh closures on every render; entries are built once and call the latest ones through a ref, so card
  // previews keep their identity (a rebuilt preview would restart every live render).
  const latest = useRef({ actions, onClose });
  latest.current = { actions, onClose };
  // Esc closes from any tab. Registered in the capture phase so that, while this window is open, the editor's own keyboard shortcuts
  // (Delete removes the selected clips, M adds a marker, ...) cannot act on the page behind it, even when focus is still out there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); latest.current.onClose(); return; }
      const dlg = dialogRef.current;
      if (e.key === 'Tab' && dlg) { // keep Tab (and Shift+Tab) inside the window
        const items = Array.from(dlg.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
        const active = document.activeElement as HTMLElement | null;
        const inside = !!active && dlg.contains(active);
        if (!items.length) { e.preventDefault(); panelRef.current?.focus(); }
        else if (e.shiftKey && (!inside || active === items[0] || active === panelRef.current)) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && (!inside || active === items[items.length - 1])) { e.preventDefault(); items[0].focus(); }
        e.stopPropagation();
        return;
      }
      if (!dlg?.contains(e.target as Node)) e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  // Focus moves into the window when it opens and goes back to what opened it (the + Add button) when it closes
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => { if (opener?.isConnected) opener.focus?.({ preventScroll: true }); };
  }, []);
  const done = () => latest.current.onClose();
  const fixed = useMemo(() => buildCatalog(
    { onAddKind: (k) => latest.current.actions.onAddKind(k), onAddTemplate: (id, p) => latest.current.actions.onAddTemplate(id, p) },
    { close: done, askPhone: (id) => { setConnect(id); setPhone(''); } },
  ), []); // eslint-disable-line react-hooks/exhaustive-deps
  const animations = useMemo(() => (hasAnimations ? hfEntries(hyperframesItems(), (i) => { latest.current.actions.onPickAnimation?.(i); done(); }) : []), [hasAnimations]); // eslint-disable-line react-hooks/exhaustive-deps
  const motion = useMemo(() => mgEntries(mg ?? [], (t) => { latest.current.actions.onPickMotion(t); done(); }), [mg]); // eslint-disable-line react-hooks/exhaustive-deps
  const entries = useMemo<CatalogEntry[]>(() => [...animations, ...motion, ...fixed], [animations, motion, fixed]);
  const count = (t: CatalogTab) => entries.filter((e) => e.tab === t).length;

  const TABS: Array<{ id: Tab; label: string; glyph: string; count: number; hidden?: boolean }> = [
    { id: 'all', label: 'All', glyph: '▦', count: entries.length },
    { id: 'animations', label: 'Animations', glyph: '✦', count: count('animations'), hidden: !hasAnimations },
    { id: 'motion', label: 'Motion graphics', glyph: '✺', count: count('motion') },
    { id: 'overlays', label: 'Overlays & forms', glyph: '▭', count: count('overlays') },
    { id: 'endscreens', label: 'End screens & connect forms', glyph: '▶', count: count('endscreens') },
  ];

  const needle = q.trim().toLowerCase();
  const shown = entries.filter((e) => (tab === 'all' || e.tab === tab) && (!needle || `${e.label} ${e.blurb} ${e.keywords ?? ''}`.toLowerCase().includes(needle)));
  // Animations and Motion graphics have their own tabs with category chips and filters; every other tab is a search + grid
  const isPanel = tab === 'animations' || tab === 'motion';
  const pending = connect ? entries.find((e) => e.id === `tpl:${connect}`) : undefined;
  const renderCard = (e: CatalogEntry) => <PreviewCard key={e.id} preview={e.preview} title={e.label} sub={e.blurb} badge={e.badge} onClick={e.run} testId={e.testId} />;

  // Portaled to <body>: inside the editor the dialog sits in the edit tab's own stacking context and the app's side rail would paint over it.
  return createPortal(
    // closing on mousedown (not click) so a text selection that starts inside and ends on the backdrop does not close the window
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={(e) => e.stopPropagation()}>
      <style>{CARD_CSS}</style>
      <div ref={panelRef} tabIndex={-1} style={{ outline: 'none', width: 'min(1480px, 96vw)', height: 'min(900px, 92vh)', display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', border: '1px solid var(--border-medium)', borderRadius: 26, color: INK, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '24px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 20 }}>＋</div>
          <div style={{ flex: 1 }}>
            <div id={titleId} style={{ fontSize: 20, fontWeight: 700 }}>Add to timeline</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, maxWidth: 720 }}>Animations, motion graphics, overlays, forms and end screens. Hover a card to preview it, click to place it at the playhead, then edit it in the panel.</div>
          </div>
          <button aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 0, color: 'inherit', fontSize: 22, cursor: 'pointer', padding: 6 }}>×</button>
        </div>
        <div role="tablist" aria-label="Categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 20px 0' }}>
          {TABS.filter((t) => !t.hidden).map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)} style={chip(on)}>
                <span style={{ opacity: 0.8, fontSize: 12 }}>{t.glyph}</span>{t.label}
                <span style={badge(on)}>{t.count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ margin: '14px 20px 20px', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, background: 'var(--bg-base)' }}>
          {tab === 'animations' && hasAnimations && <HyperframesPanel onPick={(i) => { actions.onPickAnimation?.(i); onClose(); }} />}
          {tab === 'motion' && <MgTemplatesPanel templates={mg} error={mgError} onRetry={loadMg} onPick={(t) => { actions.onPickMotion(t); onClose(); }} />}
          {!isPanel && (
            <>
              <input type="text" autoFocus placeholder={tab === 'all' ? 'Search everything: animations, motion graphics, overlays, end screens…' : 'Search…'} aria-label={SEARCH_LABEL} value={q} onChange={(e) => setQ(e.target.value)} style={{ ...field, marginBottom: 12 }} />
              {mgError && tab === 'all' && <div style={{ marginBottom: 12 }}><MgLoadError onRetry={loadMg} /></div>}
              {pending && (
                <form onSubmit={(e) => { e.preventDefault(); actions.onAddTemplate(pending.id.slice(4), phone.trim() || undefined); onClose(); }}
                  style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, padding: 12, border: '1px solid var(--accent)', borderRadius: 12, background: 'var(--accent-dim)' }}>
                  <span style={{ fontSize: 13, flex: '0 0 auto' }}>Phone number the buttons should dial</span>
                  <input type="tel" autoFocus placeholder="212 555 0147" aria-label={PHONE_LABEL} value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...field, flex: 1, padding: '8px 10px' }} />
                  <button type="submit" style={{ padding: '8px 14px', borderRadius: 10, border: 0, background: 'var(--accent)', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Add</button>
                  <button type="button" onClick={() => setConnect(null)} style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer' }}>Cancel</button>
                </form>
              )}
              <div style={{ overflow: 'auto', paddingRight: 4, minHeight: 0, flex: 1 }}>
                {tab === 'all' ? (
                  <>
                    {SECTIONS.map((s) => {
                      const items = shown.filter((e) => e.tab === s.tab);
                      if (!items.length) return null;
                      return (
                        <section key={s.tab} aria-label={s.title} style={{ marginBottom: 22 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '4px 0 10px' }}>
                            <strong style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>{s.title}</strong>
                            <span style={{ fontSize: 12, opacity: 0.6 }}>{items.length}</span>
                            <span style={{ flex: 1 }} />
                            {s.tab !== 'overlays' && s.tab !== 'endscreens' && <button type="button" onClick={() => setTab(s.tab)} style={{ background: 'transparent', border: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>Browse with filters →</button>}
                          </div>
                          <div style={grid}>{items.map(renderCard)}</div>
                        </section>
                      );
                    })}
                    {!shown.length && <span style={{ fontSize: 13, opacity: 0.7 }}>Nothing matches your search.</span>}
                  </>
                ) : (
                  <div style={grid}>
                    {shown.map(renderCard)}
                    {!shown.length && <span style={{ fontSize: 13, opacity: 0.7 }}>Nothing matches your search.</span>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
