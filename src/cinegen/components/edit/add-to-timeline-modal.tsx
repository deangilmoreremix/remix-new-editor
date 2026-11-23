// [remix] One place to add anything to the timeline (replaces the "+ Add overlay…" dropdown): Animations, Motion graphics,
// the basic overlays and the End screen / Connect form templates. Smart Speech, Template Generator and Personalization have
// their own modals (buttons in the overlay lane header), so they are not part of this one.
// The cards come from add-to-timeline-registry.ts (every entry carries its own preview) and are drawn by preview-card.tsx.
// Presentation: the shared Edit-tab ModalShell (tabs with counts in the toolbar, hint in the footer); behaviour is unchanged.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { hyperframesItems } from '@cinegen/lib/hyperframes/overlay';
import { loadMgTemplates, type MgTemplate } from '@cinegen/lib/occ/mg-templates';
import { HyperframesPanel } from './hyperframes-modal';
import { MgTemplatesPanel, MgLoadError } from './mg-templates-modal';
import { TemplateVideosPanel } from './template-videos-modal';
import { LandingPagesPanel } from './landing-pages-panel';
// @ts-expect-error plain JS data module
import { templateVideos } from '../../../data/templateVideoLibrary.js';
import { PreviewCard, CARD_CSS } from './preview-card';
import { ModalShell } from '../ui/modal-shell';
import '../../styles/edit-modal-templates.css';
import { MyPresetsPanel } from './my-presets-panel';
import { PersonalizedLayoutsPanel } from './personalized-layouts-panel';
import { personalizedLayouts } from '@cinegen/lib/overlays/personalized-layouts';
import { listOverlayPresets } from '@cinegen/lib/overlays/overlay-presets';
import { buildCatalog, clearPendingAddTab, hfEntries, mgEntries, peekPendingAddFocus, peekPendingAddQuery, peekPendingAddTab, type AddModalTab, type AddToTimelineActions, type CatalogEntry, type CatalogTab } from './add-to-timeline-registry';

export type { AddToTimelineActions } from './add-to-timeline-registry';

// 'videos' is a panel tab like Animations / Motion graphics, but its 184 live clips are not mixed into the All tab
type Tab = AddModalTab;

// The hover-help layer also opens a card when a field gets keyboard focus. These two fields are focused automatically, so a help card would pop up
// over the cards every time a tab opens; their labels are constants (not literals) so no help entry is looked up for them.
const SEARCH_LABEL = 'Search';
const PHONE_LABEL = 'Phone number';
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SECTIONS: Array<{ tab: CatalogTab; title: string }> = [
  { tab: 'animations', title: 'Animations' }, { tab: 'motion', title: 'Motion graphics' }, { tab: 'overlays', title: 'Overlays & forms' }, { tab: 'endscreens', title: 'End screens & connect forms' },
];
// constants (not literals) so the help-coverage scan only sees the labels that are real controls
const MODAL_TITLE = 'Add to timeline';

export function AddToTimelineModal({ onClose, actions }: { onClose: () => void; actions: AddToTimelineActions }) {
  const hasAnimations = !!actions.onPickAnimation;
  const hasVideos = !!actions.onPickTemplateVideo;
  const hasLanding = !!actions.onPickLandingPage;
  // [remix] the Library can open this window on a given tab (ignored when that tab is not available); read without clearing so a double render keeps it
  const [requested] = useState(peekPendingAddTab);
  const [requestedQuery] = useState(peekPendingAddQuery);
  const [focusTitle] = useState(peekPendingAddFocus); // the exact card the user clicked in the Library
  useEffect(() => { clearPendingAddTab(); }, []);
  const startTab: Tab = requested && (requested !== 'videos' || hasVideos) && (requested !== 'landing' || hasLanding) && (requested !== 'animations' || hasAnimations) ? requested : hasAnimations ? 'animations' : 'motion';
  const [tab, setTab] = useState<Tab>(startTab);
  const [q, setQ] = useState(requestedQuery ?? '');
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
  // The shell owns the dialog elements; this anchor (inside the body) is how the focus trap and the card finder reach them.
  const anchorRef = useRef<HTMLDivElement>(null);
  const getDialog = () => anchorRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null;
  const getPanel = () => anchorRef.current?.closest<HTMLElement>('.cg-modal') ?? null;

  // The parent passes fresh closures on every render; entries are built once and call the latest ones through a ref, so card
  // previews keep their identity (a rebuilt preview would restart every live render).
  const latest = useRef({ actions, onClose });
  latest.current = { actions, onClose };
  // Esc closes from any tab. Registered in the capture phase so that, while this window is open, the editor's own keyboard shortcuts
  // (Delete removes the selected clips, M adds a marker, ...) cannot act on the page behind it, even when focus is still out there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); latest.current.onClose(); return; }
      const dlg = getDialog();
      if (e.key === 'Tab' && dlg) { // keep Tab (and Shift+Tab) inside the window
        const items = Array.from(dlg.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
        const active = document.activeElement as HTMLElement | null;
        const inside = !!active && dlg.contains(active);
        if (!items.length) { e.preventDefault(); getPanel()?.focus(); }
        else if (e.shiftKey && (!inside || active === items[0] || active === getPanel())) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && (!inside || active === items[items.length - 1])) { e.preventDefault(); items[0].focus(); }
        e.stopPropagation();
        return;
      }
      if (!dlg?.contains(e.target as Node)) e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  // Focus moves into the window when it opens and goes back to what opened it (the + Add button) when it closes: both done by ModalShell.
  const done = () => latest.current.onClose();
  const fixed = useMemo(() => buildCatalog(
    { onAddKind: (k, d) => latest.current.actions.onAddKind(k, d), onAddTemplate: (id, p) => latest.current.actions.onAddTemplate(id, p) },
    { close: done, askPhone: (id) => { setConnect(id); setPhone(''); } },
  ), []); // eslint-disable-line react-hooks/exhaustive-deps
  const animations = useMemo(() => (hasAnimations ? hfEntries(hyperframesItems(), (i) => { latest.current.actions.onPickAnimation?.(i); done(); }) : []), [hasAnimations]); // eslint-disable-line react-hooks/exhaustive-deps
  const motion = useMemo(() => mgEntries(mg ?? [], (t) => { latest.current.actions.onPickMotion(t); done(); }), [mg]); // eslint-disable-line react-hooks/exhaustive-deps
  const entries = useMemo<CatalogEntry[]>(() => [...animations, ...motion, ...fixed], [animations, motion, fixed]);
  const count = (t: CatalogTab) => entries.filter((e) => e.tab === t).length;
  const presetCount = actions.onPickPreset ? listOverlayPresets().length : 0;

  const TABS: Array<{ id: Tab; label: string; glyph: string; count: number; hidden?: boolean }> = [
    { id: 'all', label: 'All', glyph: '▦', count: entries.length },
    { id: 'animations', label: 'Animations', glyph: '✦', count: count('animations'), hidden: !hasAnimations },
    { id: 'motion', label: 'Motion graphics', glyph: '✺', count: count('motion') },
    { id: 'overlays', label: 'Overlays & forms', glyph: '▭', count: count('overlays') },
    { id: 'endscreens', label: 'End screens & connect forms', glyph: '▶', count: count('endscreens') },
    { id: 'videos', label: 'Template videos', glyph: '🎬', count: (templateVideos as unknown[]).length, hidden: !hasVideos },
    { id: 'landing', label: 'Landing pages', glyph: '▤', count: 34, hidden: !hasLanding },
    { id: 'layouts', label: 'Personalized layouts', glyph: '👤', count: personalizedLayouts().length, hidden: !actions.onAddLayout },
    { id: 'presets', label: 'My presets', glyph: '★', count: presetCount, hidden: !actions.onPickPreset },
  ];

  // Scroll to and ring the exact card that was clicked (cards render lazily, so keep looking until it shows up)
  useEffect(() => {
    if (!focusTitle) return undefined;
    let tries = 0;
    const find = () => {
      const el = Array.from(getPanel()?.querySelectorAll<HTMLElement>('[data-card-title]') ?? []).find((n) => n.dataset.cardTitle === focusTitle);
      if (el) { el.scrollIntoView?.({ block: 'center' }); el.style.outline = '2px solid var(--accent)'; el.style.outlineOffset = '2px'; el.dataset.focused = 'true'; return; }
      if (tries++ < 20) timer = window.setTimeout(find, 150);
    };
    let timer = window.setTimeout(find, 0);
    return () => window.clearTimeout(timer);
  }, [focusTitle, tab, mg]);
  const needle = q.trim().toLowerCase();
  const shown = entries.filter((e) => (tab === 'all' || e.tab === tab) && (!needle || `${e.label} ${e.blurb} ${e.keywords ?? ''}`.toLowerCase().includes(needle)));
  // Animations and Motion graphics have their own tabs with category chips and filters; every other tab is a search + grid
  const isPanel = tab === 'animations' || tab === 'motion' || tab === 'videos' || tab === 'landing' || tab === 'presets' || tab === 'layouts';
  const pending = connect ? entries.find((e) => e.id === `tpl:${connect}`) : undefined;
  const renderCard = (e: CatalogEntry) => <PreviewCard key={e.id} preview={e.preview} title={e.label} sub={e.blurb} badge={e.badge} onClick={e.run} testId={e.testId} />;

  // Portaled to <body>: inside the editor the dialog sits in the edit tab's own stacking context and the app's side rail would paint over it.
  // The wrapper keeps React key / click events inside the window from bubbling (through the portal) to the editor's handlers.
  // ModalShell closes on backdrop mousedown (not click), so a text selection that starts inside and ends on the backdrop does not close the window.
  return createPortal(
    <div style={{ display: 'contents' }} onKeyDown={(e) => e.stopPropagation()} onClick={(e) => { if ((e.target as HTMLElement).closest('.cg-modal')) e.stopPropagation(); }}>
      <style>{CARD_CSS}</style>
      <ModalShell
        title={MODAL_TITLE}
        subtitle="Animations, motion graphics, overlays, forms and end screens. Hover a card to preview it, click to place it at the playhead, then edit it in the panel."
        icon="＋"
        width="min(1480px, 96vw)"
        height="min(900px, 92vh)"
        toolbar={(
          <>
            <div role="tablist" aria-label="Categories" className="cg-seg etm-seg">
              {TABS.filter((t) => !t.hidden).map((t) => {
                const on = tab === t.id;
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={on} className="cg-seg__btn" onClick={() => setTab(t.id)}>
                    <span className="etm-glyph">{t.glyph}</span>{t.label}
                    <span className="cg-count">{t.count}</span>
                  </button>
                );
              })}
            </div>
            {!isPanel && (
              <label className="cg-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input type="text" autoFocus placeholder={tab === 'all' ? 'Search everything: animations, motion graphics, overlays, end screens…' : 'Search…'} aria-label={SEARCH_LABEL} value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            )}
          </>
        )}
        footer={<><span>Hover a card to preview it, click it to place it at the playhead.</span><span className="cg-modal__footer-spacer" /><span className="cg-kbd" aria-hidden="true">Esc</span></>}
        onClose={onClose}
      >
        <div ref={anchorRef} className="etm-fill">
          {tab === 'animations' && hasAnimations && <HyperframesPanel onPick={(i) => { actions.onPickAnimation?.(i); onClose(); }} />}
          {tab === 'videos' && hasVideos && <TemplateVideosPanel initialQuery={requestedQuery} onPick={(v) => { actions.onPickTemplateVideo?.(v); onClose(); }} />}
          {tab === 'layouts' && actions.onAddLayout && <PersonalizedLayoutsPanel getOverlays={actions.getOverlays} onMakeAllVideoReady={actions.onMakeAllVideoReady} onPick={(id) => { const r = actions.onAddLayout!(id); if (r.ok) onClose(); return r; }} />}
          {tab === 'presets' && actions.onPickPreset && <MyPresetsPanel onPick={(p) => { actions.onPickPreset?.(p); onClose(); }} />}
          {tab === 'landing' && hasLanding && <LandingPagesPanel onPick={(id) => { actions.onPickLandingPage?.(id); onClose(); }} />}
          {tab === 'motion' && <MgTemplatesPanel templates={mg} error={mgError} onRetry={loadMg} onPick={(t) => { actions.onPickMotion(t); onClose(); }} />}
          {!isPanel && (
            <>
              {mgError && tab === 'all' && <div style={{ marginBottom: 12 }}><MgLoadError onRetry={loadMg} /></div>}
              {pending && (
                <form className="etm-form" onSubmit={(e) => { e.preventDefault(); actions.onAddTemplate(pending.id.slice(4), phone.trim() || undefined); onClose(); }}>
                  <span>Phone number the buttons should dial</span>
                  <input type="tel" className="cg-field" autoFocus placeholder="212 555 0147" aria-label={PHONE_LABEL} value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <button type="submit" className="cg-btn cg-btn--primary">Add</button>
                  <button type="button" className="cg-btn" onClick={() => setConnect(null)}>Cancel</button>
                </form>
              )}
              <div className="etm-scroll">
                {tab === 'all' ? (
                  <>
                    {SECTIONS.map((s) => {
                      const items = shown.filter((e) => e.tab === s.tab);
                      if (!items.length) return null;
                      return (
                        <section key={s.tab} aria-label={s.title} className="etm-section">
                          <div className="etm-section-head">
                            <span className="cg-label">{s.title}</span>
                            <span className="cg-count">{items.length}</span>
                            <span className="etm-spacer" />
                            {s.tab !== 'overlays' && s.tab !== 'endscreens' && <button type="button" className="etm-link" onClick={() => setTab(s.tab)}>Browse with filters →</button>}
                          </div>
                          <div className="etm-cards-plain">{items.map(renderCard)}</div>
                        </section>
                      );
                    })}
                    {!shown.length && <div className="cg-empty">Nothing matches your search.</div>}
                  </>
                ) : (
                  <div className="etm-cards-plain">
                    {shown.map(renderCard)}
                    {!shown.length && <div className="cg-empty etm-wide" style={{ gridColumn: '1 / -1' }}>Nothing matches your search.</div>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ModalShell>
    </div>,
    document.body,
  );
}
