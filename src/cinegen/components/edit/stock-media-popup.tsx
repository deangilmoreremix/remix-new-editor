// [remix] Media browser for the Edit tab: AI-generated media first, then Pexels + Pixabay stock (videos and photos),
// all organised by category. Stock search/normalising/caching is shared with the classic timeline editor
// (lib/editor/addons/stockMedia.js); API keys stay on the server proxies (/api/pexels, /api/pixabay).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createStockSearch, STOCK_HOME } from '../../../lib/editor/addons/stockMedia.js';
import { searchPixabayImages, searchPixabayVideos } from '../../../lib/pixabayApi.js';
import { searchPhotos as searchPexelsPhotos, searchVideos as searchPexelsVideos } from '../../../lib/pexelsApi.js';
import type { Asset } from '@cinegen/types/project';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import { MEDIA_CATEGORIES, MEDIA_GROUPS, aiPrompt, topicLabel } from './stock-categories';

export type StockKind = 'videos' | 'images';
export type MediaSource = 'ai' | 'pixabay' | 'pexels';
export type AiAspect = '16:9' | '9:16' | '1:1';

/** Common shape produced by the stockMedia.js normalizers. */
export interface StockItem {
  id: string;
  source: 'pixabay' | 'pexels';
  name: string;
  src: string;
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
type Search = (kind: StockKind, source: string, query: string) => Promise<SearchResult>;

const home = STOCK_HOME as Record<string, string>;
const SOURCES: Array<[MediaSource, string]> = [['ai', 'AI'], ['pexels', 'Pexels'], ['pixabay', 'Pixabay']];
// Header tabs: Pexels and Pixabay, each with a videos tab and an images tab. AI videos / AI images are pills inside the panel.
const TABS: Array<[MediaSource, StockKind]> = SOURCES.filter(([id]) => id !== 'ai').flatMap(([id]) => [[id, 'videos'], [id, 'images']] as Array<[MediaSource, StockKind]>);
// Assets that came from a generator (not from an upload or an attached reference).
const NOT_AI = new Set(['studio-attachment', 'studio-frame']);
export const isAiAsset = (a: Asset): boolean => {
  const via = (a.metadata as Record<string, unknown> | undefined)?.generatedVia;
  return typeof via === 'string' && !NOT_AI.has(via) && (a.type === 'image' || a.type === 'video');
};

interface Props {
  onClose: () => void;
  /** Add a Pixabay / Pexels result to the timeline at the playhead. */
  onAdd: (item: StockItem, kind: StockKind) => Promise<void> | void;
  /** Generate AI media from a prompt and add it at the playhead. */
  /** Resolves with an optional warning to show instead of the plain success message (e.g. no durable copy could be saved). */
  onGenerate: (prompt: string, kind: StockKind, aspect: AiAspect, onProgress: (msg: string) => void) => Promise<void | string>;
  /** The project's media pool (AI-generated assets are listed first). */
  assets: Asset[];
  /** Put an existing pool asset on the timeline at the playhead. */
  onAddAsset: (asset: Asset) => void;
}

const INK = 'rgba(229,237,245,.9)';
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'inherit', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '11px 12px', fontSize: 13 };
const label: CSSProperties = { fontSize: 11, letterSpacing: '.06em', fontWeight: 600, textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 };
const SOURCE_NOTE: Record<MediaSource, string> = {
  ai: 'Describe it and generate, or pick one you already made. Click a card to add it at the playhead.',
  pixabay: 'Free stock footage and photos. Click a card to add it at the playhead.',
  pexels: 'Free stock footage and photos. Click a card to add it at the playhead.',
};

/** Pill: monochrome glyph, label and a count badge (the same pill the Animations / Add to timeline libraries use). */
function Pill({ on, glyph, text, count, onClick, testId, title, role = 'tab', size = 'md' }: { on: boolean; glyph: string; text: string; count?: number; onClick: () => void; testId?: string; title?: string; role?: string; size?: 'md' | 'lg' }) {
  return (
    <button role={role} aria-selected={role === 'tab' ? on : undefined} aria-pressed={role === 'tab' ? undefined : on} data-testid={testId} title={title} onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: size === 'lg' ? '10px 16px' : '8px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
        border: `1px solid ${on ? 'var(--accent)' : 'var(--border-medium)'}`, color: on ? 'var(--accent)' : 'inherit', background: on ? 'var(--accent-dim)' : 'var(--bg-elevated)' }}>
      <span aria-hidden style={{ opacity: on ? 1 : 0.8, fontSize: 12 }}>{glyph}{'\uFE0E'}</span>{text}
      {count !== undefined && (
        <span style={{ minWidth: 22, height: 20, padding: '0 6px', borderRadius: 999, boxSizing: 'border-box', display: 'inline-grid', placeItems: 'center', fontSize: 11, background: on ? 'var(--accent-dim)' : 'var(--bg-overlay)' }}>{count}</span>
      )}
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
  const [fetched, setFetched] = useState<{ loading: boolean; items: StockItem[]; error: string | null; for: string }>({ loading: false, items: [], error: null, for: '' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<AiAspect>('16:9');
  const [gen, setGen] = useState<{ busy: boolean; msg: string; error: string | null }>({ busy: false, msg: '', error: null });
  const seq = useRef(0);

  useEffect(() => {
    if (source === 'ai') return;
    const mine = ++seq.current;
    const tag = `${source}:${kind}`;
    if (!query.trim()) { setFetched({ loading: false, items: [], error: null, for: tag }); return; }
    setFetched({ loading: true, items: [], error: null, for: tag });
    search(kind, source, query)
      .then((r) => { if (mine === seq.current) setFetched({ loading: false, items: r.items ?? [], error: r.ok ? null : (r.error || 'Search failed'), for: tag }); })
      .catch((e: unknown) => { if (mine === seq.current) setFetched({ loading: false, items: [], error: e instanceof Error ? e.message : 'Search failed', for: tag }); });
  }, [search, kind, source, query]);
  // Until the new tab's request starts (first render after a switch) show nothing rather than the previous tab's items.
  const state = fetched.for === `${source}:${kind}` ? fetched : { loading: true, items: [] as StockItem[], error: null as string | null, for: '' };

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
    setAddError(null);
    setSource(s);
    setKind(k);
    if (s === 'ai') { if (topic) setPrompt(aiPrompt(topic, k)); return; }
    if (!query) { const c = cat ?? MEDIA_GROUPS[0].categories[0]; setCatId(c.id); applyTopic(topic ?? c.topics[0], s, k); }
  };
  const pick = async (item: StockItem) => {
    if (busyId) return;
    setBusyId(item.id);
    setAddError(null);
    try { await onAdd(item, state.for.endsWith(':images') ? 'images' : 'videos'); setAdded(item.id); }
    catch (e) { setAddError(e instanceof Error ? e.message : 'Could not add this to the timeline.'); }
    finally { setBusyId(null); }
  };
  const generate = async () => {
    if (gen.busy || !prompt.trim()) return;
    setGen({ busy: true, msg: 'Submitting…', error: null });
    try {
      const note = await onGenerate(prompt.trim(), kind, aspect, (msg) => setGen((g) => ({ ...g, msg })));
      setGen({ busy: false, msg: note || 'Added to the timeline and your media pool.', error: null });
    } catch (e) {
      setGen({ busy: false, msg: '', error: e instanceof Error ? e.message : 'Generation failed' });
    }
  };

  const sourceLabel = SOURCES.find(([id]) => id === source)?.[1] ?? source;
  const noun = kind === 'videos' ? 'videos' : 'images';
  const shown = source === 'ai' ? aiAssets.length : state.items.length;
  const sourceText: Record<MediaSource, string> = { ai: 'AI', pexels: 'Pexels', pixabay: 'Pixabay' };
  // Layout follows the Add to timeline / Animations libraries: header, source tabs, rounded panel, group + category pills, labelled filters, cards.
  return (
    <div role="dialog" aria-modal="true" aria-label="AI and stock media" data-testid="stock-media-popup" onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', padding: 16 }} onClick={onClose}>
      <style>{'.media-card:hover{border-color:var(--accent)!important}.media-card:disabled{opacity:.55;cursor:progress}'}</style>
      <div style={{ width: 'min(1480px, 96vw)', height: 'min(900px, 94vh)', display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', border: '1px solid var(--border-medium)', borderRadius: 26, color: INK, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '22px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 20 }}>＋</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Add media to timeline</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, maxWidth: 760 }}>Generate AI videos and images, or add free Pexels and Pixabay footage and photos. Click one to place it at the playhead.</div>
          </div>
          <button aria-label="Close media browser" onClick={onClose} style={{ background: 'transparent', border: 0, color: 'inherit', fontSize: 22, cursor: 'pointer', padding: 6 }}>×</button>
        </div>

        <div role="tablist" aria-label="Media" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '16px 20px 0' }}>
          {TABS.map(([id, k], i) => (
            <span key={`${id}-${k}`} style={{ display: 'contents' }}>
              {k === 'videos' && i > 0 && <span aria-hidden style={{ width: 1, height: 26, background: 'var(--border-medium)', margin: '0 4px' }} />}
              <Pill size="lg" on={source === id && kind === k} glyph={k === 'videos' ? '▶' : '▦'} text={`${sourceText[id]} ${k}`} testId={`tab-${id}-${k}`}
                title={`${sourceText[id]} ${k}`} onClick={() => openTab(id, k)} />
            </span>
          ))}
        </div>

        <div style={{ margin: '14px 20px 20px', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, background: 'var(--bg-base)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <strong style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>▣ Choose {sourceText[source]} {kind}</strong>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, opacity: 0.6 }}>{MEDIA_CATEGORIES.length} categories</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.65, margin: '4px 0 12px' }}>{SOURCE_NOTE[source]}</div>

          <div role="tablist" aria-label="Groups" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {(['videos', 'images'] as StockKind[]).map((k) => (
              <Pill key={`ai-${k}`} on={source === 'ai' && kind === k} glyph="✦" text={`AI ${k}`} testId={`pill-ai-${k}`} title={`Generate or reuse AI ${k}`}
                count={aiAll.filter((a) => a.type === (k === 'videos' ? 'video' : 'image')).length} onClick={() => openTab('ai', k)} />
            ))}
            <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-medium)', margin: '0 4px' }} />
            <Pill on={groupId === 'all'} glyph="▦" text="All" count={MEDIA_CATEGORIES.length} testId="group-all" onClick={() => pickGroup('all')} />
            {MEDIA_GROUPS.map((g) => <Pill key={g.id} on={groupId === g.id} glyph={g.glyph} text={g.label} count={g.categories.length} testId={`group-${g.id}`} onClick={() => pickGroup(g.id)} />)}
          </div>
          <div role="group" aria-label="Categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, maxHeight: 130, overflowY: 'auto', paddingRight: 4 }}>
            {cats.map((c) => <Pill key={c.id} role="button" on={catId === c.id} glyph={c.glyph} text={c.label} count={c.topics.length} testId={`cat-${c.id}`} title={`${c.topics.length} topics`} onClick={() => pickCategory(c.id)} />)}
          </div>
          {cat && (
            <div role="group" aria-label="Topics" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{ ...label, margin: '0 6px 0 2px' }}>{source === 'ai' ? 'Ideas' : 'Refine'}</span>
              {cat.topics.map((t) => (
                <button key={t} data-testid={`topic-${t.replace(/\s+/g, '-')}`} aria-pressed={topic === t} onClick={() => applyTopic(t)}
                  style={{ padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: `1px solid ${topic === t ? 'var(--accent)' : 'var(--border-subtle)'}`, color: topic === t ? 'var(--accent)' : 'inherit', background: topic === t ? 'var(--accent-dim)' : 'transparent' }}>{topicLabel(t)}</button>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: source === 'ai' ? '3fr 1fr' : '1fr', gap: 18, marginBottom: 10 }}>
            {source === 'ai' ? (
              <div><div style={label}>Describe it</div>
                <textarea aria-label={`Describe the AI ${kind === 'videos' ? 'video' : 'image'}`} data-testid="ai-prompt" rows={2} placeholder={`Describe the ${kind === 'videos' ? 'video' : 'image'} you want, or pick a category for an idea…`} value={prompt} onChange={(e) => { setPrompt(e.target.value); setTopic(null); }} style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }} /></div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setCatId(null); setTopic(null); setQuery(draft.trim()); }}><div style={label}>Search</div>
                <input type="text" placeholder={`⌕  Search ${sourceLabel} ${noun}…`} aria-label={`Search stock ${noun}`} value={draft} onChange={(e) => setDraft(e.target.value)} style={field} /></form>
            )}
            {source === 'ai' && (
              <div><div style={label}>Aspect ratio</div>
                <select aria-label="Aspect ratio" value={aspect} onChange={(e) => setAspect(e.target.value as AiAspect)} style={field}><option value="16:9">16:9 landscape</option><option value="9:16">9:16 portrait</option><option value="1:1">1:1 square</option></select></div>
            )}
          </div>
          {source === 'ai' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0 6px' }}>
              <button data-testid="ai-generate" disabled={gen.busy || !prompt.trim()} onClick={() => void generate()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'var(--accent-dim)', opacity: gen.busy || !prompt.trim() ? 0.55 : 1, cursor: gen.busy ? 'progress' : 'pointer' }}>{gen.busy ? 'Generating…' : `✦ Generate ${kind === 'videos' ? 'video' : 'image'}`}</button>
              {gen.busy && <span role="status" style={{ fontSize: 12, color: 'var(--accent)' }}>{gen.msg} {kind === 'videos' ? 'Videos can take a minute or two.' : ''}</span>}
              {!gen.busy && gen.msg && <span role="status" style={{ fontSize: 12, color: '#34d399' }}>{gen.msg}</span>}
              {gen.error && <span role="alert" style={{ fontSize: 12, color: '#f87171' }}>{gen.error}</span>}
            </div>
          )}
          {addError && <div role="alert" data-testid="add-error" style={{ fontSize: 12, color: '#f87171', margin: '4px 0' }}>{addError}</div>}
          <div style={{ fontSize: 12, opacity: 0.6, margin: '6px 0 10px' }}>
            {source === 'ai' ? `Your AI ${noun} in this project: ${shown}` : state.loading ? 'Loading…' : state.error ? '' : `Showing ${shown} ${noun} from ${sourceLabel}`}
          </div>

          <div style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start', paddingRight: 4, minHeight: 0, flex: 1 }}>
            {source === 'ai' ? (
              aiAssets.length ? aiAssets.map((a) => (
                <Card key={a.id} testId={`ai-${a.id}`} badge={`AI ${a.type}`} title={a.name} meta={`${a.type === 'video' ? `${Math.round(a.duration || 0)}s · ` : ''}${String((a.metadata as Record<string, unknown> | undefined)?.aspect ?? '16:9')}`} thumb={a.thumbnailUrl || (a.type === 'image' ? a.url : '')} onClick={() => onAddAsset(a)} />
              )) : <span style={{ fontSize: 13, opacity: 0.7, gridColumn: '1 / -1' }}>Nothing generated yet. Describe something above and press Generate. Anything you create in Spaces, Studio or the Director also shows up here.</span>
            ) : state.error ? <span role="alert" style={{ color: '#f87171', fontSize: 13, gridColumn: '1 / -1' }}>{state.error}</span>
              : !state.loading && !state.items.length ? <span style={{ fontSize: 13, opacity: 0.7, gridColumn: '1 / -1' }}>{query ? 'Nothing found. Try another search or category.' : 'Pick a category or search above.'}</span>
              : state.items.map((it) => (
                <Card key={it.id} testId={`stock-${it.id}`} disabled={busyId !== null} badge={`${it.source} ${kind === 'videos' ? 'video' : 'photo'}`} title={it.name}
                  meta={`${kind === 'videos' ? `${Math.round(it.duration || 0)}s` : it.width && it.height ? `${it.width}×${it.height}` : 'photo'}${it.user ? ` · by ${it.user}` : ''}${added === it.id ? ' · ✓ added' : busyId === it.id ? ' · adding…' : ''}`}
                  thumb={it.thumbnail || it.preview || ''} onClick={() => void pick(it)} />
              ))}
          </div>
          {source !== 'ai' && (
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 10 }}>{kind === 'videos' ? 'Videos' : 'Photos'} from <a href={home[source] || '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{sourceLabel}</a>.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ testId, title, meta, badge, thumb, onClick, disabled }: { testId: string; title: string; meta: string; badge: string; thumb: string; onClick: () => void; disabled?: boolean }) {
  const url = thumb ? toFileUrl(thumb) : '';
  return (
    <button className="media-card" data-testid={testId} aria-label={title} disabled={disabled} onClick={onClick}
      style={{ textAlign: 'left', padding: 12, borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'inherit', cursor: 'pointer' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
        {url ? <img src={url} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 26, opacity: 0.5 }}>🎬</span>}
        <span style={{ position: 'absolute', left: 8, top: 8, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,.55)' }}>{badge}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{meta}</div>
    </button>
  );
}
