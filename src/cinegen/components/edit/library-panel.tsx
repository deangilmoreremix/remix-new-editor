// [remix] Library: one browsable place for everything you can add to a timeline that is not your own media: motion-graphics
// templates, effects, transitions, colour looks (LUTs), overlays and forms (lead generator, CTA, text, stickers, end screens) and sound
// effects. It reuses the data and thumbnails of the existing browsers (MgTemplatesModal, OccLibraryModal, SoundLibraryPopup, the
// overlay lane's "Add overlay" menu); this panel only gathers them. Elements stay the four subject categories.
// Every card shows what it is (picture, video poster or live preview). Clicking a card opens the big Add to timeline window on that item; the
// small + adds it at the playhead; dragging it onto the timeline places it there. One search box looks through every category at once.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OverlayKind } from '@cinegen/types/workspace';
import { OVERLAY_KINDS, overlayTemplates, isConnectTemplate } from '@cinegen/lib/overlays/overlays';
import { loadMgTemplates, type MgTemplate } from '@cinegen/lib/occ/mg-templates';
import { buildAnimationCatalog, animationGroups, filterAnimations } from '@cinegen/lib/occ/animation-catalog';
import { hyperframesItems, type HfItem } from '@cinegen/lib/hyperframes/overlay';
import { groupOf, thumbOf } from './hyperframes-modal';
import { buildCatalog, hfPreview, mgPreview, openAddToTimeline, type AddModalTab, type CatalogEntry } from './add-to-timeline-registry';
import { LibraryCard } from './library-card';
import { useLibraryMemory } from '@cinegen/lib/occ/library-memory';
import { CARD_CSS } from './preview-card';
import { aspectBucket, searchTemplateVideos, type TemplateVideo } from './template-videos-modal';
// @ts-expect-error plain JS data module (same import as add-to-timeline-modal.tsx)
import { templateVideos } from '../../../data/templateVideoLibrary.js';
// @ts-expect-error plain JS flag module
import { isHyperframesEnabled } from '../../../lib/hyperframes/featureFlag.js';
import { GL_TRANSITION_ORDER, glTransitionLabel } from '@cinegen/lib/occ/transitions';
import { GLT_IDS } from '../../../openchatcut/gl/glt';
import { userLutIds } from '@cinegen/lib/occ/user-luts';
import { availableSounds, soundEffectSrc } from '@cinegen/lib/occ/sound-library';
import { SOUND_GROUPS, formatSoundDuration, type SoundEffect } from '../../../openchatcut/audio/soundLibrary';
import { ALL_FX, FX_IDS, LUT_IDS } from '../../../openchatcut/gl/fx/effects';
import { t } from '../../../openchatcut/i18n/t';
import { FxThumb } from '../../../openchatcut/library/FxThumb';
import { TransitionThumb } from '../../../openchatcut/library/TransitionThumb';
import { PreviewCleanupContext } from '../../../openchatcut/library/ResourcePreviewContext';
import { usePluginPacks, pluginResourceItems } from '../../../openchatcut/library/pluginResources';
import { getCustomTransition } from '../../../openchatcut/gl/customTransitions';
import '../../../openchatcut/library/library.css';
import { LIBRARY_DND, encodeLibraryDrag, type LibraryKind, type LibraryDropCtx } from '@cinegen/lib/occ/library-dnd';

/** Props that make a card draggable onto the timeline. */
const dragProps = (kind: LibraryKind, id: string) => ({
  draggable: true,
  onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData(LIBRARY_DND, encodeLibraryDrag({ kind, id })); e.dataTransfer.effectAllowed = 'copy'; },
});

export type LibraryCategory = 'animations' | 'effects' | 'transitions' | 'looks' | 'overlays' | 'videos' | 'sounds' | 'stock';

export const LIBRARY_CATEGORIES: Array<{ id: LibraryCategory; label: string; hint: string }> = [
  { id: 'animations', label: 'Animations', hint: 'Animated titles, lower thirds and call-outs' },
  { id: 'effects', label: 'Effects', hint: 'Visual effects for the selected clip' },
  { id: 'transitions', label: 'Transitions', hint: 'How the selected clip changes into the next one' },
  { id: 'looks', label: 'Looks', hint: 'Colour grades (LUTs) for the selected clip' },
  { id: 'overlays', label: 'Overlays & forms', hint: 'Lead forms, buttons, text, stickers and end screens' },
  { id: 'videos', label: 'Template videos', hint: 'Ready-made AI video clips to drop on a video track' },
  { id: 'sounds', label: 'Sounds', hint: 'Sound effects placed at the playhead' },
  { id: 'stock', label: 'Stock & AI media', hint: 'Free stock photos and videos, or make a clip with AI' },
];

/** What happens when you click a card. A handler may return a short message to show (for example "Select a clip first"). */
export interface LibraryActions {
  onAddOverlay: (kind: OverlayKind, ctx?: LibraryDropCtx) => string | void;
  onAddTemplate: (templateId: string, ctx?: LibraryDropCtx) => string | void;
  onAddMg: (template: MgTemplate, ctx?: LibraryDropCtx) => string | void;
  onAddHf: (item: HfItem, ctx?: LibraryDropCtx) => string | void;
  onApplyFx: (id: string, ctx?: LibraryDropCtx) => string | void | Promise<string | void>;
  onApplyLut: (id: string, ctx?: LibraryDropCtx) => string | void | Promise<string | void>;
  onApplyTransition: (id: string, ctx?: LibraryDropCtx) => string | void | Promise<string | void>;
  onAddSound: (effect: SoundEffect, ctx?: LibraryDropCtx) => string | void;
  onAddTemplateVideo: (item: TemplateVideo, ctx?: LibraryDropCtx) => string | void;
  /** Opens the Stock & AI media browser (the same window as the toolbar button). */
  onOpenStock?: () => void;
}

/** Cards are div role=button (Chromium does not start a native drag from a <button>). */
const keyActivate = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } };

const noop = () => undefined;
const ALL_VIDEOS = templateVideos as unknown as TemplateVideo[];
const PAGE = 24;
const SEARCH_CAP = 6;
type AnimItem = ReturnType<typeof buildAnimationCatalog>[number];

const card: React.CSSProperties = { textAlign: 'left', padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 };

export function LibraryPanel(actions: LibraryActions & { initialCategory?: LibraryCategory }) {
  const [cat, setCat] = useState<LibraryCategory>(actions.initialCategory ?? 'animations');
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  const [mg, setMg] = useState<MgTemplate[] | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false); // true once a category was chosen: the search then filters that category instead of showing results from all of them
  const [videosShown, setVideosShown] = useState(PAGE);
  const [phoneFor, setPhoneFor] = useState<{ id: string; name: string } | null>(null); // Connect Form waiting for its phone number
  const [phone, setPhone] = useState('');
  const fixedRef = useRef<Map<string, CatalogEntry> | null>(null);
  const memory = useLibraryMemory(); // Recents + Favorites (this browser only)
  const audio = useRef<HTMLAudioElement | null>(null);
  const noteTimer = useRef<number | undefined>(undefined);
  const packs = usePluginPacks();

  useEffect(() => { void loadMgTemplates().then(setMg); }, []);
  useEffect(() => () => { audio.current?.pause(); window.clearTimeout(noteTimer.current); }, []);

  const say = (m: string | void) => {
    if (!m) { setNote(''); return; }
    setNote(m);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(''), 4000);
  };
  const run = async (fn: () => string | void | Promise<string | void>) => { try { say(await fn()); } catch (e) { say(e instanceof Error ? e.message : 'That did not work.'); } };
  const match = (...parts: Array<string | undefined>) => !q.trim() || parts.filter(Boolean).join(' ').toLowerCase().includes(q.trim().toLowerCase());

  const fxIds = useMemo(() => [...FX_IDS, ...pluginResourceItems(packs, 'fx').map((i) => i.id)], [packs]);
  const lutIds = useMemo(() => [...LUT_IDS, ...userLutIds(), ...pluginResourceItems(packs, 'lut').map((i) => i.id)], [packs]);
  const trIds = useMemo(() => [...GL_TRANSITION_ORDER, ...GLT_IDS, ...pluginResourceItems(packs, 'transition').map((i) => i.id)], [packs]);
  const fxName = (id: string) => t(ALL_FX[id]?.name ?? id);
  const trName = (id: string) => (id.startsWith('plugin:') ? getCustomTransition(id)?.label ?? id : glTransitionLabel(id));
  const hfItems = useMemo(() => (isHyperframesEnabled() ? hyperframesItems() : []), []);
  const sounds = useMemo(() => availableSounds(), []);

  const play = (s: SoundEffect) => {
    audio.current?.pause();
    if (playing === s.id) { setPlaying(null); return; }
    const a = new Audio(soundEffectSrc(s.id));
    audio.current = a; setPlaying(s.id);
    a.onended = () => setPlaying(null);
    void a.play().catch(() => setPlaying(null));
  };

  const thumbGrid = (ids: string[], kind: 'fx' | 'tr', pick: (id: string) => void, dndKind: LibraryKind) => (
    <PreviewCleanupContext.Provider value={() => {}}>
      <div className="library-panel__grid">
        {ids.filter((id) => match(kind === 'tr' ? trName(id) : fxName(id))).map((id) => (
          <div role="button" tabIndex={0} onKeyDown={keyActivate} key={id} {...dragProps(dndKind, id)} className={`cc-resource-card${hover === id ? ' hovered' : ''}`} data-testid={`library-card-${id}`}
            onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onClick={() => void run(() => pick(id))}>
            <div className="cc-resource-thumb">
              {kind === 'tr' && !id.startsWith('plugin:') ? <TransitionThumb type={id as never} playing={hover === id} /> : kind === 'fx' ? <FxThumb assetId={id} playing={hover === id} /> : null}
            </div>
            <span className="cc-resource-name">{kind === 'tr' ? trName(id) : fxName(id)}</span>
          </div>
        ))}
      </div>
    </PreviewCleanupContext.Provider>
  );

  const animItems = useMemo(() => (hfItems.length || mg ? buildAnimationCatalog({ mg: mg ?? [], hf: hfItems, hfGroup: groupOf }) : []), [hfItems, mg]);
  const fixed = () => (fixedRef.current ??= new Map(buildCatalog({ onAddKind: noop, onAddTemplate: noop }, { close: noop, askPhone: noop }).map((e) => [e.id, e])));
  const openModal = (tab: AddModalTab, query: string) => { if (!openAddToTimeline(tab, query, query || undefined)) say('Open the timeline first.'); };

  // ── picture cards ──────────────────────────────────────────────────────────
  const animCard = (x: AnimItem) => {
    const preview = x.kind === 'hf' && x.hf ? hfPreview(x.hf) : mgPreview(x.mg!);
    const mid = `anim:${x.id}`;
    return <LibraryCard key={x.id} testId={`library-mg-${x.id}`} favorite={memory.isFavorite(mid)} onToggleFavorite={() => memory.toggleFavorite(mid)} title={x.name} sub={`${x.group} · ${x.seconds.toFixed(x.seconds < 10 ? 1 : 0)}s`} image={preview.image} preview={preview} drag={dragProps(x.kind === 'hf' ? 'hf' : 'mg', x.id)}
      onOpen={() => openModal('all', x.name)} onAdd={() => { memory.remember(mid); void run(() => (x.kind === 'hf' && x.hf ? actions.onAddHf(x.hf) : actions.onAddMg(x.mg!))); }} />;
  };
  const overlayCard = (k: (typeof OVERLAY_KINDS)[number]) => {
    const e = fixed().get(k.kind);
    const mid = `overlay:${k.kind}`;
    return <LibraryCard key={k.kind} testId={`library-overlay-${k.kind}`} favorite={memory.isFavorite(mid)} onToggleFavorite={() => memory.toggleFavorite(mid)} title={k.label} sub={k.blurb} badge="Overlay" preview={e?.preview} drag={dragProps('overlay', k.kind)}
      onOpen={() => openModal('overlays', k.label)} onAdd={() => { memory.remember(mid); void run(() => actions.onAddOverlay(k.kind)); }} />;
  };
  const templateCard = (x: ReturnType<typeof overlayTemplates>[number]) => {
    const e = fixed().get(`tpl:${x.id}`);
    const mid = `tpl:${x.id}`;
    return <LibraryCard key={x.id} testId={`library-template-${x.id}`} favorite={memory.isFavorite(mid)} onToggleFavorite={() => memory.toggleFavorite(mid)} title={x.name} sub={x.description} badge={e?.badge} preview={e?.preview} drag={dragProps('template', x.id)}
      onOpen={() => openModal('endscreens', x.name)} onAdd={() => { memory.remember(mid); if (isConnectTemplate(x.id)) { setPhoneFor({ id: x.id, name: x.name }); setPhone(''); return; } void run(() => actions.onAddTemplate(x.id)); }} />;
  };
  // Template videos: the "+" puts the clip on a video track at the playhead; clicking the card opens the big window on that clip.
  const videoCard = (v: TemplateVideo) => (
    <LibraryCard key={v.id} testId={`library-video-${v.id}`} favorite={memory.isFavorite(`video:${v.id}`)} onToggleFavorite={() => memory.toggleFavorite(`video:${v.id}`)} title={v.title} sub={`${v.duration ? `${Math.round(v.duration)}s · ` : ''}${aspectBucket(v.aspectRatio)}`} image={v.posterSrc} video={v.videoSrc}
      onOpen={() => openModal('videos', v.title)} onAdd={() => { memory.remember(`video:${v.id}`); void run(() => actions.onAddTemplateVideo(v)); }} />
  );
  const soundRow = (s: SoundEffect) => (
    <div key={s.id} {...dragProps('sound', s.id)} className="library-panel__sound" data-testid={`library-sound-${s.id}`}>
      <span style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</strong><span style={{ fontSize: 10, opacity: 0.65 }}>{formatSoundDuration(s.seconds)}</span></span>
      <button className="clip-properties-panel__toggle-btn" aria-label={`${playing === s.id ? 'Stop' : 'Play'} ${s.name}`} data-help="preview sound" onClick={() => play(s)}>{playing === s.id ? '■' : '▶'}</button>
      <button className="clip-properties-panel__toggle-btn" aria-label={`Add ${s.name}`} data-help="add sound to timeline" onClick={() => void run(() => actions.onAddSound(s))}>Add</button>
    </div>
  );

  // ── what each category / search matches ────────────────────────────────────
  const kindMatches = OVERLAY_KINDS.filter((k) => match(k.label, k.blurb));
  const tplMatches = overlayTemplates().filter((x) => match(x.name, x.description, x.library));
  const animMatches = filterAnimations(animItems, group, q);
  const videoMatches = searchTemplateVideos(ALL_VIDEOS, q);
  const soundMatches = sounds.filter((s) => match(s.name, s.desc, s.keywords.join(' '), SOUND_GROUPS.find((g) => g.id === s.group)?.nameEn));
  const idMatches = (ids: string[], name: (id: string) => string) => ids.filter((id) => match(name(id)));

  const counts: Record<LibraryCategory, number> = { animations: animItems.length, effects: fxIds.length, transitions: trIds.length, looks: lutIds.length, overlays: OVERLAY_KINDS.length + overlayTemplates().length, videos: ALL_VIDEOS.length, sounds: sounds.length, stock: 3 };

  const head = (label: string, n: number, c: LibraryCategory) => (
    <div className="library-panel__group-head"><span>{label}</span><span style={{ opacity: 0.6 }}>{n}</span>{n > SEARCH_CAP && <button type="button" onClick={() => { setCat(c); setPinned(true); }}>See all {n}</button>}</div>
  );

  // One search for everything: a few picture results from each category, each with "See all".
  const results = () => {
    const sections: Array<React.ReactNode> = [];
    if (animMatches.length) sections.push(<div key="a">{head('Animations', animMatches.length, 'animations')}<div className="library-panel__cards">{animMatches.slice(0, SEARCH_CAP).map(animCard)}</div></div>);
    if (kindMatches.length || tplMatches.length) sections.push(<div key="o">{head('Overlays, forms & end screens', kindMatches.length + tplMatches.length, 'overlays')}<div className="library-panel__cards">{kindMatches.slice(0, SEARCH_CAP).map(overlayCard)}{tplMatches.slice(0, Math.max(0, SEARCH_CAP - kindMatches.length)).map(templateCard)}</div></div>);
    if (videoMatches.length) sections.push(<div key="v">{head('Template videos', videoMatches.length, 'videos')}<div className="library-panel__cards">{videoMatches.slice(0, SEARCH_CAP).map(videoCard)}</div></div>);
    if (match('stock', 'ai media', 'pexels', 'pixabay', 'photos', 'ai video')) sections.push(<div key="k">{head('Stock & AI media', 3, 'stock')}{stockBody()}</div>);
    if (soundMatches.length) sections.push(<div key="s">{head('Sounds', soundMatches.length, 'sounds')}<div className="library-panel__stack">{soundMatches.slice(0, 3).map(soundRow)}</div></div>);
    const fx = idMatches(fxIds, fxName); const lk = idMatches(lutIds, fxName); const tr = idMatches(trIds, trName);
    if (fx.length) sections.push(<div key="e">{head('Effects', fx.length, 'effects')}{thumbGrid(fx.slice(0, SEARCH_CAP), 'fx', actions.onApplyFx, 'fx')}</div>);
    if (lk.length) sections.push(<div key="l">{head('Looks', lk.length, 'looks')}{thumbGrid(lk.slice(0, SEARCH_CAP), 'fx', actions.onApplyLut, 'lut')}</div>);
    if (tr.length) sections.push(<div key="t">{head('Transitions', tr.length, 'transitions')}{thumbGrid(tr.slice(0, SEARCH_CAP), 'tr', actions.onApplyTransition, 'transition')}</div>);
    return sections.length ? <div className="library-panel__stack">{sections}</div> : <span className="library-panel__empty">Nothing matches “{q.trim()}”.</span>;
  };

  // ── Recent and Favorites: the same cards, found again by id ────────────────
  const cardFor = (id: string): React.ReactNode => {
    const [type, ...rest] = id.split(':'); const key = rest.join(':');
    if (type === 'anim') { const x = animItems.find((a) => a.id === key); return x ? animCard(x) : null; }
    if (type === 'overlay') { const k = OVERLAY_KINDS.find((o) => o.kind === key); return k ? overlayCard(k) : null; }
    if (type === 'tpl') { const x = overlayTemplates().find((t) => t.id === key); return x ? templateCard(x) : null; }
    if (type === 'video') { const v = ALL_VIDEOS.find((c) => c.id === key); return v ? videoCard(v) : null; }
    return null;
  };
  const strip = (label: string, ids: string[], testId: string) => {
    const cards = ids.map((id) => ({ id, node: cardFor(id) })).filter((c) => c.node).slice(0, SEARCH_CAP);
    if (!cards.length) return null;
    return <div key={testId} data-testid={testId}><div className="library-panel__group-head"><span>{label}</span><span style={{ opacity: 0.6 }}>{cards.length}</span></div><div className="library-panel__cards">{cards.map((c) => <div key={c.id}>{c.node}</div>)}</div></div>;
  };

  const body = () => {
    if (q.trim() && !pinned) return results();
    const strips = [strip('★ Favorites', memory.favorites, 'library-favorites'), strip('Recent', memory.recent, 'library-recent')].filter(Boolean);
    const main = bodyOf();
    return strips.length ? <div className="library-panel__stack">{strips}{main}</div> : main;
  };
  const stockBody = () => (
    <div className="library-panel__stack" data-testid="library-stock">
      <div className="library-panel__hint">Search free Pexels and Pixabay photos and videos, or make a clip with AI. Anything you pick lands on the timeline with its real pictures.</div>
      <button type="button" className="library-panel__chip library-panel__chip--on" data-testid="library-open-stock" disabled={!actions.onOpenStock} onClick={() => actions.onOpenStock?.()} style={{ alignSelf: 'flex-start' }}>Open Stock &amp; AI media</button>
    </div>
  );
  const bodyOf = () => {
    if (cat === 'animations') {
      return (
        <div className="library-panel__stack">
          <div className="library-panel__chips" role="tablist" aria-label="Animation groups">
            <button className={`library-panel__chip${group === null ? ' library-panel__chip--on' : ''}`} data-testid="library-group-everything" data-help="library group" onClick={() => setGroup(null)}>Everything</button>
            {animationGroups(animItems).map((g) => (
              <button key={g.group} className={`library-panel__chip${group === g.group ? ' library-panel__chip--on' : ''}`} data-testid={`library-group-${g.group}`} data-help="library group" onClick={() => setGroup(g.group)}>{g.group} <span style={{ opacity: 0.6 }}>{g.count}</span></button>
            ))}
          </div>
          <div className="library-panel__cards">
            {!mg && <span className="library-panel__empty">Loading…</span>}
            {mg && !animMatches.length && <span className="library-panel__empty">No animations match.</span>}
            {animMatches.map(animCard)}
          </div>
        </div>
      );
    }
    if (cat === 'stock') return stockBody();
    if (cat === 'effects') return thumbGrid(fxIds, 'fx', actions.onApplyFx, 'fx');
    if (cat === 'looks') return thumbGrid(lutIds, 'fx', actions.onApplyLut, 'lut');
    if (cat === 'transitions') return thumbGrid(trIds, 'tr', actions.onApplyTransition, 'transition');
    if (cat === 'overlays') {
      return (
        <div className="library-panel__stack">
          <div className="library-panel__cards">{kindMatches.map(overlayCard)}</div>
          {tplMatches.length > 0 && <div className="library-panel__subhead">End screens and connect forms</div>}
          <div className="library-panel__cards">{tplMatches.map(templateCard)}</div>
          {!kindMatches.length && !tplMatches.length && <span className="library-panel__empty">No overlays match.</span>}
        </div>
      );
    }
    if (cat === 'videos') {
      return (
        <div className="library-panel__stack">
          <div className="library-panel__cards">{videoMatches.slice(0, videosShown).map(videoCard)}</div>
          {!videoMatches.length && <span className="library-panel__empty">No template videos match.</span>}
          {videosShown < videoMatches.length && <button type="button" className="library-panel__chip" style={{ alignSelf: 'center' }} data-testid="library-videos-more" onClick={() => setVideosShown((n) => n + PAGE)}>Show more ({videoMatches.length - videosShown} left)</button>}
          <button type="button" className="library-panel__chip" data-testid="library-open-template-videos" onClick={() => openModal('videos', q.trim())} style={{ alignSelf: 'flex-start' }}>Open the full template video browser</button>
        </div>
      );
    }
    return (
      <div className="library-panel__stack">
        {soundMatches.map(soundRow)}
        {!soundMatches.length && <span className="library-panel__empty">No sounds match.</span>}
      </div>
    );
  };

  const active = LIBRARY_CATEGORIES.find((c) => c.id === cat)!;
  return (
    <div className="library-panel" data-testid="library-panel">
      <input className="library-panel__search" type="search" placeholder="Search animations, templates, videos, sounds…" aria-label="Search the library" value={q} onChange={(e) => { setQ(e.target.value); setPinned(false); setVideosShown(PAGE); }} />
      <div className="library-panel__chips" role="tablist" aria-label="Library categories">
        {LIBRARY_CATEGORIES.map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} data-testid={`library-cat-${c.id}`} className={`library-panel__chip${cat === c.id ? ' library-panel__chip--on' : ''}`} data-help={`library ${c.id}`} onClick={() => { setCat(c.id); setPinned(true); setNote(''); }}>{c.label}<small>{counts[c.id]}</small></button>
        ))}
      </div>
      <div className="library-panel__hint">{q.trim() && !pinned ? `Results for “${q.trim()}” from every category` : active.hint}</div>
      <button type="button" className="library-panel__chip" data-testid="library-open-add" title="Open the Add to timeline window: every animation, motion graphic, overlay, form and end screen with previews" onClick={() => { if (!openAddToTimeline()) say('Open the timeline first.'); }} style={{ alignSelf: 'flex-start', margin: '2px 0 6px' }}>+ Browse everything with previews</button>
      {phoneFor && (
        <form className="library-panel__note" data-testid="library-phone-form" onSubmit={(e) => { e.preventDefault(); const id = phoneFor.id; const ph = phone.trim(); setPhoneFor(null); void run(() => actions.onAddTemplate(id, { time: undefined as never, phone: ph } as LibraryDropCtx)); }} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12 }}>Phone number for “{phoneFor.name}” (with area code)
            <input autoFocus type="tel" inputMode="tel" aria-label="Phone number to call" data-testid="library-phone-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="212 555 0147" style={{ display: 'block', width: '100%', marginTop: 4 }} />
          </label>
          <span style={{ display: 'flex', gap: 6 }}><button type="submit" className="library-panel__chip library-panel__chip--on" data-testid="library-phone-add">Add</button><button type="button" className="library-panel__chip" onClick={() => setPhoneFor(null)}>Cancel</button></span>
        </form>
      )}
      {note && <div className="library-panel__note" role="status">{note}</div>}
      <style>{CARD_CSS}</style>
      <div className="library-panel__body">{body()}</div>
    </div>
  );
}
