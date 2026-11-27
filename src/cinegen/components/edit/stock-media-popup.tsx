// [remix] Media browser for the Edit tab: AI-generated media first, then Pexels + Pixabay stock (videos and photos),
// all organised by category. Stock search/normalising/caching is shared with the classic timeline editor
// (lib/editor/addons/stockMedia.js); API keys stay on the server proxies (/api/pexels, /api/pixabay).
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createStockSearch, STOCK_HOME } from '../../../lib/editor/addons/stockMedia.js';
import { searchPixabayImages, searchPixabayVideos } from '../../../lib/pixabayApi.js';
import { searchPhotos as searchPexelsPhotos, searchVideos as searchPexelsVideos } from '../../../lib/pexelsApi.js';
import type { Asset } from '@cinegen/types/project';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import { ModalShell } from '../ui/modal-shell';
import '../../styles/edit-modal-stock-sound.css';
import { MEDIA_CATEGORIES, MEDIA_GROUPS, aiPrompt, topicLabel, IMAGE_QUALITIES, VIDEO_RESOLUTIONS, VIDEO_DURATIONS, DEFAULT_AI_OPTIONS, type AiOptions } from './stock-categories';

export type StockKind = 'videos' | 'images';
export type MediaSource = 'ai' | 'pixabay' | 'pexels';
export type AiAspect = '16:9' | '9:16' | '1:1';

/** Common shape produced by the stockMedia.js normalizers. */
export interface StockItem {
  id: string;
  source: 'pixabay' | 'pexels';
  name: string;
  src: string;
  /** Smaller rendition to retry with when the full file cannot be copied. */
  fallbackSrc?: string;
  preview?: string;
  thumbnail?: string;
  duration?: number;
  width?: number;
  height?: number;
  user?: string;
  pageURL?: string;
  /** Pixabay images may not be hotlinked permanently: copy to storage before use. */
  mustCopy?: boolean;
}

interface SearchResult { ok: boolean; items: StockItem[]; error?: string }
type Search = (kind: StockKind, source: string, query: string, page?: number) => Promise<SearchResult>;
const PAGE_SIZE = 24; // matches createStockSearch's perPage: a full page means there may be more

const home = STOCK_HOME as Record<string, string>;
const SOURCES: Array<[MediaSource, string]> = [['ai', 'AI'], ['pexels', 'Pexels'], ['pixabay', 'Pixabay']];
// Header tabs: Pexels and Pixabay, each with a videos tab and an images tab. AI videos / AI images are pills inside the panel.
const TABS: Array<[MediaSource, StockKind]> = SOURCES.filter(([id]) => id !== 'ai').flatMap(([id]) => [[id, 'videos'], [id, 'images']] as Array<[MediaSource, StockKind]>);
// Assets that came from a generator (not from an upload or an attached reference).
const NOT_AI = new Set(['studio-attachment', 'studio-frame']);
export const isAiAsset = (a: Asset): boolean => {
  const m = (a.metadata ?? {}) as Record<string, unknown>;
  const via = m.generatedVia;
  if (typeof via !== 'string' || NOT_AI.has(via) || (a.type !== 'image' && a.type !== 'video')) return false;
  // Same exclusions as the media pool, plus failed generations: only finished media with a usable source can be placed.
  if (m.generating || m.error || m.pendingMusic || m.pendingFillGap || m.pendingExtend) return false;
  return Boolean(a.url?.trim() || a.fileRef?.trim());
};

interface Props {
  onClose: () => void;
  /** Add a Pixabay / Pexels result to the timeline at the playhead. */
  /** May resolve with a note to show (e.g. the copy only lasts for this session). */
  onAdd: (item: StockItem, kind: StockKind) => Promise<void | string> | void | string;
  /** Generate AI media from a prompt and add it at the playhead. */
  /** Resolves with an optional warning to show instead of the plain success message (e.g. no durable copy could be saved). */
  onGenerate: (prompt: string, kind: StockKind, aspect: AiAspect, onProgress: (msg: string) => void, opts: AiOptions) => Promise<void | string>;
  /** The project's media pool (AI-generated assets are listed first). */
  assets: Asset[];
  /** Put an existing pool asset on the timeline at the playhead. */
  onAddAsset: (asset: Asset) => void;
}

const MODAL_TITLE = 'Add media to timeline';
const SOURCE_NOTE: Record<MediaSource, string> = {
  ai: 'Describe it and generate, or pick one you already made. Click a card to add it at the playhead.',
  pixabay: 'Free stock footage and photos. Click a card to add it at the playhead.',
  pexels: 'Free stock footage and photos. Click a card to add it at the playhead.',
};

/** Pill: monochrome glyph, label and a count badge. `seg` pills sit in the segmented header; the rest are shell chips. */
function Pill({ on, glyph, text, count, onClick, testId, title, role = 'tab', seg = false }: { on: boolean; glyph: string; text: string; count?: number; onClick: () => void; testId?: string; title?: string; role?: string; seg?: boolean }) {
  return (
    <button type="button" role={role} className={seg ? 'cg-seg__btn' : 'cg-chip'} aria-selected={role === 'tab' ? on : undefined} aria-pressed={role === 'tab' ? undefined : on} data-testid={testId} title={title} onClick={onClick}>
      <span aria-hidden="true">{glyph}{'\uFE0E'}</span>{text}
      {count !== undefined && <span className="cg-count">{count}</span>}
    </button>
  );
}

export function StockMediaPopup({ onClose, onAdd, onGenerate, assets, onAddAsset }: Props) {
  const search = useMemo(() => createStockSearch({
    pixabay: { searchImages: searchPixabayImages, searchVideos: searchPixabayVideos },
    pexels: { searchPhotos: searchPexelsPhotos, searchVideos: searchPexelsVideos },
  }) as Search, []);
  const [source, setSource] = useState<MediaSource>('ai');
  const [kind, setKind] = useState<StockKind>('videos');
  const [groupId, setGroupId] = useState<string>('all');
  const [catId, setCatId] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  // `for` records which tab (source:kind) the items were fetched for, so results never show or import under a different media type.
  const [fetched, setFetched] = useState<{ loading: boolean; items: StockItem[]; error: string | null; for: string; page: number; more: boolean; loadingMore: boolean }>({ loading: false, items: [], error: null, for: '', page: 1, more: false, loadingMore: false });
  const [ai, setAi] = useState<AiOptions>(DEFAULT_AI_OPTIONS);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [addNote, setAddNote] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<AiAspect>('16:9');
  const [gen, setGen] = useState<{ busy: boolean; msg: string; error: string | null }>({ busy: false, msg: '', error: null });
  const seq = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ModalShell moves focus into the dialog on open, restores it on close and handles Escape. Keep Tab inside the dialog.
  const trapTab = (e: KeyboardEvent) => {
    const panel = wrapRef.current?.querySelector<HTMLElement>('.cg-modal');
    if (e.key !== 'Tab' || !panel) return;
    const items = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href]')].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0]; const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };

  useEffect(() => {
    if (source === 'ai') return;
    const mine = ++seq.current;
    const tag = `${source}:${kind}`;
    if (!query.trim()) { setFetched({ loading: false, items: [], error: null, for: tag, page: 1, more: false, loadingMore: false }); return; }
    setFetched({ loading: true, items: [], error: null, for: tag, page: 1, more: false, loadingMore: false });
    search(kind, source, query)
      .then((r) => { if (mine === seq.current) setFetched({ loading: false, items: r.items ?? [], error: r.ok ? null : (r.error || 'Search failed'), for: tag, page: 1, more: r.ok && (r.items?.length ?? 0) >= PAGE_SIZE, loadingMore: false }); })
      .catch((e: unknown) => { if (mine === seq.current) setFetched({ loading: false, items: [], error: e instanceof Error ? e.message : 'Search failed', for: tag, page: 1, more: false, loadingMore: false }); });
  }, [search, kind, source, query]);
  // Until the new tab's request starts (first render after a switch) show nothing rather than the previous tab's items.
  const state = fetched.for === `${source}:${kind}` ? fetched : { loading: true, items: [] as StockItem[], error: null as string | null, for: '', page: 1, more: false, loadingMore: false };

  const aiAll = useMemo(() => assets.filter(isAiAsset), [assets]);
  const aiAssets = useMemo(
    () => aiAll.filter((a) => a.type === (kind === 'videos' ? 'video' : 'image')).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [aiAll, kind],
  );
  const group = MEDIA_GROUPS.find((g) => g.id === groupId);
  const cats = group ? group.categories : MEDIA_CATEGORIES;
  const cat = MEDIA_CATEGORIES.find((c) => c.id === catId) ?? null;

  const applyTopic = (t: string, src: MediaSource = source, k: StockKind = kind) => {
    setTopic(t);
    if (src === 'ai') setPrompt(aiPrompt(t, k));
    else { setQuery(t); setDraft(t); }
  };
  const pickCategory = (id: string) => {
    const c = MEDIA_CATEGORIES.find((x) => x.id === id);
    if (!c) return;
    setCatId(id);
    applyTopic(c.topics[0]);
  };
  const pickGroup = (id: string) => { setGroupId(id); if (cat && id !== 'all' && cat.group !== id) { setCatId(null); setTopic(null); } };
  /** One main tab per source and media type, so it is always clear whether you are browsing videos or images. */
  const openTab = (s: MediaSource, k: StockKind) => {
    setAddError(null); setAddNote(null);
    setSource(s);
    setKind(k);
    if (s === 'ai') { if (topic) setPrompt(aiPrompt(topic, k)); return; }
    if (!query) { const c = cat ?? MEDIA_GROUPS[0].categories[0]; setCatId(c.id); applyTopic(topic ?? c.topics[0], s, k); }
  };
  const pick = async (item: StockItem) => {
    if (busyId) return;
    setBusyId(item.id);
    setAddError(null);
    setAddNote(null);
    try { const note = await onAdd(item, state.for.endsWith(':images') ? 'images' : 'videos'); setAdded(item.id); if (typeof note === 'string') setAddNote(note); }
    catch (e) { setAddError(e instanceof Error ? e.message : 'Could not add this to the timeline.'); }
    finally { setBusyId(null); }
  };
  const loadMore = () => {
    if (state.loadingMore || !state.more) return;
    const mine = seq.current; // a new search or tab bumps seq, which discards this page
    const tag = `${source}:${kind}`;
    const next = state.page + 1;
    setFetched((f) => ({ ...f, loadingMore: true }));
    search(kind, source, query, next)
      .then((r) => {
        if (mine !== seq.current) return;
        setFetched((f) => {
          const seen = new Set(f.items.map((i) => i.id));
          const fresh = (r.items ?? []).filter((i) => !seen.has(i.id));
          return { ...f, for: tag, items: [...f.items, ...fresh], page: r.ok ? next : f.page, more: r.ok && fresh.length > 0 && (r.items?.length ?? 0) >= PAGE_SIZE, loadingMore: false, error: null };
        });
        if (!r.ok) setAddError(r.error || 'Could not load more results.');
      })
      .catch((e: unknown) => { if (mine === seq.current) { setFetched((f) => ({ ...f, loadingMore: false })); setAddError(e instanceof Error ? e.message : 'Could not load more results.'); } });
  };
  const generate = async () => {
    if (gen.busy || !prompt.trim()) return;
    setGen({ busy: true, msg: 'Submitting…', error: null });
    try {
      const note = await onGenerate(prompt.trim(), kind, aspect, (msg) => setGen((g) => ({ ...g, msg })), ai);
      setGen({ busy: false, msg: note || 'Added to the timeline and your media pool.', error: null });
    } catch (e) {
      setGen({ busy: false, msg: '', error: e instanceof Error ? e.message : 'Generation failed' });
    }
  };


  const sourceLabel = SOURCES.find(([id]) => id === source)?.[1] ?? source;
  const noun = kind === 'videos' ? 'videos' : 'images';
  const shown = source === 'ai' ? aiAssets.length : state.items.length;
  const sourceText: Record<MediaSource, string> = { ai: 'AI', pexels: 'Pexels', pixabay: 'Pixabay' };
  // Layout follows the Effects library: shell header, segmented source tabs, then chip filters, labelled fields and cards.
  return (
    <div ref={wrapRef} style={{ display: 'contents' }} onKeyDown={(e) => { e.stopPropagation(); trapTab(e); }}>
      <ModalShell
        title={MODAL_TITLE}
        subtitle="Generate AI videos and images, or add free Pexels and Pixabay footage and photos. Click one to place it at the playhead."
        icon="＋"
        ariaLabel="AI and stock media"
        closeLabel="Close media browser"
        width="min(1480px, 96vw)"
        height="min(900px, 94vh)"
        testId="stock-media-popup"
        onClose={onClose}
        toolbar={(
          <div className="cg-seg cg-seg--wrap" role="tablist" aria-label="Media">
            {TABS.map(([id, k], i) => (
              <span key={`${id}-${k}`} style={{ display: 'contents' }}>
                {k === 'videos' && i > 0 && <span aria-hidden="true" className="cg-seg__sep" />}
                <Pill seg on={source === id && kind === k} glyph={k === 'videos' ? '▶' : '▦'} text={`${sourceText[id]} ${k}`} testId={`tab-${id}-${k}`}
                  title={`${sourceText[id]} ${k}`} onClick={() => openTab(id, k)} />
              </span>
            ))}
          </div>
        )}
        footer={(
          <>
            <span>{SOURCE_NOTE[source]}</span>
            {source !== 'ai' && <span className="cg-stock__credit">{kind === 'videos' ? 'Videos' : 'Photos'} from <a href={home[source] || '#'} target="_blank" rel="noopener noreferrer">{sourceLabel}</a>.</span>}
            <span className="cg-modal__footer-spacer" />
            <span className="cg-kbd" aria-hidden="true">Esc</span>
          </>
        )}
      >
        <div className="cg-stock">
          <div className="cg-stock__head">
            <span className="cg-label">▣ Choose {sourceText[source]} {kind}</span>
            <span className="cg-note">{MEDIA_CATEGORIES.length} categories</span>
          </div>

          <div role="tablist" aria-label="Groups" className="cg-chips">
            {(['videos', 'images'] as StockKind[]).map((k) => (
              <Pill key={`ai-${k}`} on={source === 'ai' && kind === k} glyph="✦" text={`AI ${k}`} testId={`pill-ai-${k}`} title={`Generate or reuse AI ${k}`}
                count={aiAll.filter((a) => a.type === (k === 'videos' ? 'video' : 'image')).length} onClick={() => openTab('ai', k)} />
            ))}
            <span aria-hidden="true" className="cg-chips__sep" />
            <Pill on={groupId === 'all'} glyph="▦" text="All" count={MEDIA_CATEGORIES.length} testId="group-all" onClick={() => pickGroup('all')} />
            {MEDIA_GROUPS.map((g) => <Pill key={g.id} on={groupId === g.id} glyph={g.glyph} text={g.label} count={g.categories.length} testId={`group-${g.id}`} onClick={() => pickGroup(g.id)} />)}
          </div>
          <div role="group" aria-label="Categories" className="cg-chips cg-stock__cats">
            {cats.map((c) => <Pill key={c.id} role="button" on={catId === c.id} glyph={c.glyph} text={c.label} count={c.topics.length} testId={`cat-${c.id}`} title={`${c.topics.length} topics`} onClick={() => pickCategory(c.id)} />)}
          </div>
          {cat && (
            <div role="group" aria-label="Topics" className="cg-chips" style={{ alignItems: 'center' }}>
              <span className="cg-label" style={{ margin: '0 6px 0 2px' }}>{source === 'ai' ? 'Ideas' : 'Refine'}</span>
              {cat.topics.map((t) => (
                <button key={t} type="button" className="cg-chip" data-testid={`topic-${t.replace(/\s+/g, '-')}`} aria-pressed={topic === t} onClick={() => applyTopic(t)}>{topicLabel(t)}</button>
              ))}
            </div>
          )}

          <div className={`cg-stock__form ${source === 'ai' ? 'cg-stock__form--ai' : 'cg-stock__form--one'}`}>
            {source === 'ai' ? (
              <div><div className="cg-label">Describe it</div>
                <textarea className="cg-field cg-stock__prompt" aria-label={`Describe the AI ${kind === 'videos' ? 'video' : 'image'}`} data-testid="ai-prompt" rows={2} placeholder={`Describe the ${kind === 'videos' ? 'video' : 'image'} you want, or pick a category for an idea…`} value={prompt} onChange={(e) => { setPrompt(e.target.value); setTopic(null); }} /></div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setCatId(null); setTopic(null); setQuery(draft.trim()); }}><div className="cg-label">Search</div>
                <input type="text" className="cg-field" placeholder={`⌕  Search ${sourceLabel} ${noun}…`} aria-label={`Search stock ${noun}`} value={draft} onChange={(e) => setDraft(e.target.value)} /></form>
            )}
            {source === 'ai' && (
              <div><div className="cg-label">Aspect ratio</div>
                <select className="cg-field" aria-label="Aspect ratio" value={aspect} onChange={(e) => setAspect(e.target.value as AiAspect)}><option value="16:9">16:9 landscape</option><option value="9:16">9:16 portrait</option><option value="1:1">1:1 square</option></select></div>
            )}
            {source === 'ai' && kind === 'images' && (
              <div><div className="cg-label">Quality</div>
                <select aria-label="Image quality" data-testid="ai-quality" value={ai.size} onChange={(e) => setAi((o) => ({ ...o, size: Number(e.target.value) }))} className="cg-field">{IMAGE_QUALITIES.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}</select></div>
            )}
            {source === 'ai' && kind === 'videos' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div className="cg-label">Resolution</div>
                  <select aria-label="Video resolution" data-testid="ai-resolution" value={ai.resolution} onChange={(e) => setAi((o) => ({ ...o, resolution: e.target.value as AiOptions['resolution'] }))} className="cg-field">{VIDEO_RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                <div><div className="cg-label">Length</div>
                  <select aria-label="Video length" data-testid="ai-duration" value={ai.duration} onChange={(e) => setAi((o) => ({ ...o, duration: Number(e.target.value) }))} className="cg-field">{VIDEO_DURATIONS.map((d) => <option key={d} value={d}>{d} s</option>)}</select></div>
              </div>
            )}
          </div>
          {source === 'ai' && (
            <div className="cg-stock__actions">
              <button type="button" className="cg-btn cg-btn--primary" data-testid="ai-generate" disabled={gen.busy || !prompt.trim()} style={gen.busy ? { cursor: 'progress' } : undefined} onClick={() => void generate()}>{gen.busy ? 'Generating…' : `✦ Generate ${kind === 'videos' ? 'video' : 'image'}`}</button>
              {gen.busy && <span role="status" className="cg-stock__status">{gen.msg} {kind === 'videos' ? 'Videos can take a minute or two.' : ''}</span>}
              {!gen.busy && gen.msg && <span role="status" className="cg-ok">{gen.msg}</span>}
              {gen.error && <span role="alert" className="cg-error">{gen.error}</span>}
            </div>
          )}
          {addNote && <div role="status" data-testid="add-note" className="cg-note" style={{ color: '#fbbf24' }}>{addNote}</div>}
          {addError && <div role="alert" data-testid="add-error" className="cg-error">{addError}</div>}
          <div className="cg-note">
            {source === 'ai' ? `Your AI ${noun} in this project: ${shown}` : state.loading ? 'Loading…' : state.error ? '' : `Showing ${shown} ${noun} from ${sourceLabel}`}
          </div>

          <div className="cg-grid cg-stock__grid">
            {source === 'ai' ? (
              aiAssets.length ? aiAssets.map((a) => (
                <Card key={a.id} testId={`ai-${a.id}`} badge={`AI ${a.type}`} title={a.name} meta={`${a.type === 'video' ? `${Math.round(a.duration || 0)}s · ` : ''}${String((a.metadata as Record<string, unknown> | undefined)?.aspect ?? '16:9')}`} thumb={a.thumbnailUrl || (a.type === 'image' ? a.url : '')} onClick={() => onAddAsset(a)} />
              )) : <span className="cg-empty cg-stock__wide">Nothing generated yet. Describe something above and press Generate. Anything you create in Spaces, Studio or the Director also shows up here.</span>
            ) : state.error ? <span role="alert" className="cg-error cg-stock__wide">{state.error}</span>
              : !state.loading && !state.items.length ? <span className="cg-empty cg-stock__wide">{query ? 'Nothing found. Try another search or category.' : 'Pick a category or search above.'}</span>
              : state.items.map((it) => (
                <Card key={it.id} testId={`stock-${it.id}`} disabled={busyId !== null} badge={`${it.source} ${kind === 'videos' ? 'video' : 'photo'}`} title={it.name}
                  meta={`${kind === 'videos' ? `${Math.round(it.duration || 0)}s` : it.width && it.height ? `${it.width}×${it.height}` : 'photo'}${it.user ? ` · by ${it.user}` : ''}${added === it.id ? ' · ✓ added' : busyId === it.id ? ' · adding…' : ''}`}
                  thumb={it.thumbnail || it.preview || ''} onClick={() => void pick(it)} />
              ))}
          </div>
          {source !== 'ai' && state.more && !state.error && (
            <button data-testid="load-more" className="cg-pill" disabled={state.loadingMore} onClick={loadMore}
              style={{ alignSelf: 'center', marginTop: 10, padding: '9px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, border: '1px solid var(--border-medium)', color: 'inherit', background: 'var(--bg-elevated)', cursor: state.loadingMore ? 'progress' : 'pointer' }}>{state.loadingMore ? 'Loading…' : 'Load more'}</button>
          )}
        </div>
      </ModalShell>
    </div>
  );
}

function Card({ testId, title, meta, badge, thumb, onClick, disabled }: { testId: string; title: string; meta: string; badge: string; thumb: string; onClick: () => void; disabled?: boolean }) {
  const url = thumb ? toFileUrl(thumb) : '';
  return (
    <button type="button" className="cg-card cg-media-card" data-testid={testId} aria-label={title} disabled={disabled} onClick={onClick}>
      <div className="cg-card__thumb">
        {url ? <img className="cg-media-card__img" src={url} alt="" loading="lazy" /> : <span className="cg-media-card__ph">🎬</span>}
        <span className="cg-media-card__badge">{badge}</span>
      </div>
      <div className="cg-media-card__title">{title}</div>
      <div className="cg-media-card__meta">{meta}</div>
    </button>
  );
}
