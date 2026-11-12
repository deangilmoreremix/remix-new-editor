// [remix] Pexels + Pixabay stock videos and photos inside the Edit tab (ported from the classic timeline's Stock Media panel).
// Search, normalising and caching are shared with the classic editor (lib/editor/addons/stockMedia.js);
// API keys stay on the server proxies (/api/pexels, /api/pixabay).
import { useEffect, useMemo, useRef, useState } from 'react';
import { createStockSearch, STOCK_HOME, STOCK_SOURCES } from '../../../lib/editor/addons/stockMedia.js';
import { STOCK_SUGGESTIONS } from '../../../lib/editor/addons/stockBrowser.js';
import { searchPixabayImages, searchPixabayVideos } from '../../../lib/pixabayApi.js';
import { searchPhotos as searchPexelsPhotos, searchVideos as searchPexelsVideos } from '../../../lib/pexelsApi.js';

export type StockKind = 'videos' | 'images';

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

const sources = STOCK_SOURCES as unknown as Array<[string, string]>;
const home = STOCK_HOME as Record<string, string>;
const suggestions = STOCK_SUGGESTIONS as Record<StockKind, string[]>;

export function StockMediaPopup({ onClose, onAdd }: { onClose: () => void; onAdd: (item: StockItem, kind: StockKind) => Promise<void> | void }) {
  const search = useMemo(() => createStockSearch({
    pixabay: { searchImages: searchPixabayImages, searchVideos: searchPixabayVideos },
    pexels: { searchPhotos: searchPexelsPhotos, searchVideos: searchPexelsVideos },
  }) as Search, []);
  const [kind, setKind] = useState<StockKind>('videos');
  const [source, setSource] = useState<string>(sources[0][0]);
  const [query, setQuery] = useState(suggestions.videos[0]);
  const [draft, setDraft] = useState(suggestions.videos[0]);
  const [state, setState] = useState<{ loading: boolean; items: StockItem[]; error: string | null }>({ loading: true, items: [], error: null });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    if (!query.trim()) { setState({ loading: false, items: [], error: null }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));
    search(kind, source, query)
      .then((r) => { if (mine === seq.current) setState({ loading: false, items: r.items ?? [], error: r.ok ? null : (r.error || 'Search failed') }); })
      .catch((e: unknown) => { if (mine === seq.current) setState({ loading: false, items: [], error: e instanceof Error ? e.message : 'Search failed' }); });
  }, [search, kind, source, query]);

  const pick = async (item: StockItem) => {
    if (busyId) return;
    setBusyId(item.id);
    try { await onAdd(item, kind); setAdded(item.id); } finally { setBusyId(null); }
  };
  const sourceLabel = sources.find(([id]) => id === source)?.[1] ?? source;
  const tab = (active: boolean) => ({ borderColor: active ? '#22d3ee' : undefined, color: active ? '#22d3ee' : undefined });

  return (
    <div role="dialog" aria-label="Stock media" data-testid="stock-media-popup" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' }} onClick={onClose}>
      <div style={{ width: 'min(860px, 94vw)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', background: '#0b1016', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, padding: 14, color: '#e5e7eb' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13 }}>Stock media</strong>
          <button className="clip-properties-panel__toggle-btn" style={tab(kind === 'videos')} onClick={() => setKind('videos')}>🎬 Videos</button>
          <button className="clip-properties-panel__toggle-btn" style={tab(kind === 'images')} onClick={() => setKind('images')}>🖼️ Images</button>
          <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.14)' }} />
          {sources.map(([id, label]) => (
            <button key={id} className="clip-properties-panel__toggle-btn" style={tab(source === id)} onClick={() => setSource(id)}>{label}</button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="clip-properties-panel__toggle-btn" aria-label="Close stock media" onClick={onClose}>×</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setQuery(draft.trim()); }} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input aria-label={`Search stock ${kind}`} placeholder={`Search ${sourceLabel} ${kind}`} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ flex: 1, background: '#0d1218', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '4px 8px', fontSize: 12 }} />
          <button type="submit" className="clip-properties-panel__toggle-btn">Search</button>
        </form>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {(suggestions[kind] ?? []).map((q) => (
            <button key={q} className="clip-properties-panel__toggle-btn" style={tab(q === query)} onClick={() => { setDraft(q); setQuery(q); }}>{q}</button>
          ))}
        </div>
        <div style={{ overflow: 'auto', minHeight: 120, paddingRight: 4 }}>
          {state.loading ? <div style={{ opacity: 0.6, fontSize: 12 }}>Loading…</div>
            : state.error ? <div role="alert" style={{ color: '#f87171', fontSize: 12 }}>{state.error}</div>
            : !state.items.length ? <div style={{ opacity: 0.6, fontSize: 12 }}>Nothing found.</div>
            : (
              <div role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                {state.items.map((it) => (
                  <button key={it.id} role="listitem" data-testid={`stock-${it.id}`} disabled={busyId !== null} onClick={() => void pick(it)}
                    title={`${it.name}${it.user ? ` by ${it.user}` : ''} — add at playhead`}
                    style={{ position: 'relative', aspectRatio: '16 / 9', border: '1px solid rgba(255,255,255,.14)', borderRadius: 6, padding: 0, cursor: busyId ? 'progress' : 'pointer', color: '#fff', background: `#0d1218 url(${JSON.stringify(it.thumbnail || it.preview || '')}) center / cover no-repeat`, opacity: busyId && busyId !== it.id ? 0.5 : 1 }}>
                    {kind === 'videos' && <span style={{ position: 'absolute', right: 4, bottom: 4, fontSize: 10, background: 'rgba(0,0,0,.7)', borderRadius: 3, padding: '1px 4px' }}>{Math.round(it.duration || 0)}s</span>}
                    <span style={{ position: 'absolute', left: 4, top: 4, fontSize: 11, background: 'rgba(0,0,0,.7)', borderRadius: 3, padding: '0 5px' }}>{busyId === it.id ? '…' : added === it.id ? '✓' : '＋'}</span>
                  </button>
                ))}
              </div>
            )}
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
          Click a result to add it at the playhead. {kind === 'videos' ? 'Videos' : 'Images'} from{' '}
          <a href={home[source] || '#'} target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee' }}>{sourceLabel}</a>.
        </div>
      </div>
    </div>
  );
}
