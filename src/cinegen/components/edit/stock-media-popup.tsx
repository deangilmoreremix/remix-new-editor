// [remix] Media browser for the Edit tab: AI-generated media first, then Pexels + Pixabay stock (videos and photos),
// all organised by category. Stock search/normalising/caching is shared with the classic timeline editor
// (lib/editor/addons/stockMedia.js); API keys stay on the server proxies (/api/pexels, /api/pixabay).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createStockSearch, STOCK_HOME } from '../../../lib/editor/addons/stockMedia.js';
import { searchPixabayImages, searchPixabayVideos } from '../../../lib/pixabayApi.js';
import { searchPhotos as searchPexelsPhotos, searchVideos as searchPexelsVideos } from '../../../lib/pexelsApi.js';
import type { Asset } from '@cinegen/types/project';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import { MEDIA_CATEGORIES } from './stock-categories';

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
const SOURCES: Array<[MediaSource, string]> = [['ai', '✨ AI'], ['pixabay', 'Pixabay'], ['pexels', 'Pexels']];
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
  onGenerate: (prompt: string, kind: StockKind, aspect: AiAspect, onProgress: (msg: string) => void) => Promise<void>;
  /** The project's media pool (AI-generated assets are listed first). */
  assets: Asset[];
  /** Put an existing pool asset on the timeline at the playhead. */
  onAddAsset: (asset: Asset) => void;
}

const INK = 'rgba(229,237,245,.9)';
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'inherit', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '11px 12px', fontSize: 13 };
const label: CSSProperties = { fontSize: 11, letterSpacing: '.06em', fontWeight: 600, textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 };
const pill = (on: boolean, strong = false): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: strong ? '10px 16px' : '8px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
  border: `1px solid ${on ? 'var(--accent)' : 'var(--border-medium)'}`, color: on ? 'var(--accent)' : 'inherit', background: on ? 'var(--accent-dim)' : 'var(--bg-elevated)',
});
const SOURCE_NOTE: Record<MediaSource, string> = {
  ai: 'Describe it and generate, or pick one you already made. Click a card to add it at the playhead.',
  pixabay: 'Free stock footage and photos. Click a card to add it at the playhead.',
  pexels: 'Free stock footage and photos. Click a card to add it at the playhead.',
};

export function StockMediaPopup({ onClose, onAdd, onGenerate, assets, onAddAsset }: Props) {
  const search = useMemo(() => createStockSearch({
    pixabay: { searchImages: searchPixabayImages, searchVideos: searchPixabayVideos },
    pexels: { searchPhotos: searchPexelsPhotos, searchVideos: searchPexelsVideos },
  }) as Search, []);
  const [source, setSource] = useState<MediaSource>('ai');
  const [kind, setKind] = useState<StockKind>('videos');
  const [catId, setCatId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<{ loading: boolean; items: StockItem[]; error: string | null }>({ loading: false, items: [], error: null });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<AiAspect>('16:9');
  const [gen, setGen] = useState<{ busy: boolean; msg: string; error: string | null }>({ busy: false, msg: '', error: null });
  const seq = useRef(0);

  useEffect(() => {
    if (source === 'ai') return;
    const mine = ++seq.current;
    if (!query.trim()) { setState({ loading: false, items: [], error: null }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));
    search(kind, source, query)
      .then((r) => { if (mine === seq.current) setState({ loading: false, items: r.items ?? [], error: r.ok ? null : (r.error || 'Search failed') }); })
      .catch((e: unknown) => { if (mine === seq.current) setState({ loading: false, items: [], error: e instanceof Error ? e.message : 'Search failed' }); });
  }, [search, kind, source, query]);

  const aiAssets = useMemo(
    () => assets.filter((a) => isAiAsset(a) && a.type === (kind === 'videos' ? 'video' : 'image'))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [assets, kind],
  );

  const pickCategory = (id: string) => {
    const cat = MEDIA_CATEGORIES.find((c) => c.id === id);
    if (!cat) return;
    setCatId(id);
    if (source === 'ai') setPrompt(cat.ai);
    else { setQuery(cat.query); setDraft(cat.query); }
  };
  const switchSource = (s: MediaSource) => {
    setSource(s);
    if (s !== 'ai' && !query) { const c = MEDIA_CATEGORIES.find((x) => x.id === (catId ?? 'nature')) ?? MEDIA_CATEGORIES[0]; setCatId(c.id); setQuery(c.query); setDraft(c.query); }
  };
  const pick = async (item: StockItem) => {
    if (busyId) return;
    setBusyId(item.id);
    try { await onAdd(item, kind); setAdded(item.id); } finally { setBusyId(null); }
  };
  const generate = async () => {
    if (gen.busy || !prompt.trim()) return;
    setGen({ busy: true, msg: 'Submitting…', error: null });
    try {
      await onGenerate(prompt.trim(), kind, aspect, (msg) => setGen((g) => ({ ...g, msg })));
      setGen({ busy: false, msg: 'Added to the timeline and your media pool.', error: null });
    } catch (e) {
      setGen({ busy: false, msg: '', error: e instanceof Error ? e.message : 'Generation failed' });
    }
  };

  const sourceLabel = SOURCES.find(([id]) => id === source)?.[1] ?? source;
  const noun = kind === 'videos' ? 'videos' : 'images';
  const shown = source === 'ai' ? aiAssets.length : state.items.length;
  // Layout follows the Animations library: header, rounded panel, category pills, labelled filters, cards.
  return (
    <div role="dialog" aria-label="AI and stock media" data-testid="stock-media-popup" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', padding: 16 }} onClick={onClose}>
      <style>{'.media-card:hover{border-color:var(--accent)!important}.media-card:disabled{opacity:.55;cursor:progress}'}</style>
      <div style={{ width: 'min(1480px, 96vw)', height: 'min(900px, 92vh)', display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', border: '1px solid var(--border-medium)', borderRadius: 26, color: INK, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '24px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 20 }}>✦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>AI &amp; stock media</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, maxWidth: 720 }}>Generate AI videos and images, or add free Pexels and Pixabay footage and photos. Click one to place it at the playhead.</div>
          </div>
          <button aria-label="Close media browser" onClick={onClose} style={{ background: 'transparent', border: 0, color: 'inherit', fontSize: 22, cursor: 'pointer', padding: 6 }}>×</button>
        </div>
        <div style={{ margin: '18px 20px 20px', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, background: 'var(--bg-base)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <strong style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>▣ Choose {source === 'ai' ? 'AI media' : 'stock media'}</strong>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, opacity: 0.6 }}>{MEDIA_CATEGORIES.length} categories</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.65, margin: '4px 0 12px' }}>{SOURCE_NOTE[source]}</div>

          <div role="tablist" aria-label="Source" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {SOURCES.map(([id, text]) => (
              <button key={id} role="tab" aria-selected={source === id} data-testid={`source-${id}`} onClick={() => switchSource(id)} style={pill(source === id, true)}>{text}</button>
            ))}
          </div>
          <div role="group" aria-label="Categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {MEDIA_CATEGORIES.map((c) => (
              <button key={c.id} data-testid={`cat-${c.id}`} aria-pressed={catId === c.id} onClick={() => pickCategory(c.id)} style={pill(catId === c.id)}><span style={{ fontSize: 12 }}>{c.icon}</span>{c.label}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: source === 'ai' ? '2fr 1fr 1fr' : '1.1fr 1fr', gap: 18, marginBottom: 10 }}>
            {source === 'ai' ? (
              <div><div style={label}>Describe it</div>
                <textarea aria-label={`Describe the AI ${kind === 'videos' ? 'video' : 'image'}`} data-testid="ai-prompt" rows={2} placeholder={`Describe the ${kind === 'videos' ? 'video' : 'image'} you want, or pick a category for an idea…`} value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }} /></div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setCatId(null); setQuery(draft.trim()); }}><div style={label}>Search</div>
                <input type="text" placeholder={`⌕  Search ${sourceLabel} ${noun}…`} aria-label={`Search stock ${noun}`} value={draft} onChange={(e) => setDraft(e.target.value)} style={field} /></form>
            )}
            <div><div style={label}>Type</div>
              <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as StockKind)} style={field}><option value="videos">🎬 Videos</option><option value="images">🖼️ Images</option></select></div>
            {source === 'ai' && (
              <div><div style={label}>Aspect ratio</div>
                <select aria-label="Aspect ratio" value={aspect} onChange={(e) => setAspect(e.target.value as AiAspect)} style={field}><option value="16:9">16:9 landscape</option><option value="9:16">9:16 portrait</option><option value="1:1">1:1 square</option></select></div>
            )}
          </div>
          {source === 'ai' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0 6px' }}>
              <button data-testid="ai-generate" disabled={gen.busy || !prompt.trim()} onClick={() => void generate()} style={{ ...pill(true, true), opacity: gen.busy || !prompt.trim() ? 0.55 : 1, cursor: gen.busy ? 'progress' : 'pointer' }}>{gen.busy ? 'Generating…' : `✨ Generate ${kind === 'videos' ? 'video' : 'image'}`}</button>
              {gen.busy && <span role="status" style={{ fontSize: 12, color: 'var(--accent)' }}>{gen.msg} {kind === 'videos' ? 'Videos can take a minute or two.' : ''}</span>}
              {!gen.busy && gen.msg && <span role="status" style={{ fontSize: 12, color: '#34d399' }}>{gen.msg}</span>}
              {gen.error && <span role="alert" style={{ fontSize: 12, color: '#f87171' }}>{gen.error}</span>}
            </div>
          )}
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
