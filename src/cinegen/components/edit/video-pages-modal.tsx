// [remix] "Add to Video Pages": the Template Generator's rendered video is uploaded and turned into a draft landing page. Same window as
// "Add to timeline" (add-to-timeline-modal.tsx): icon badge header, category pills with counts, a "Choose a design" card with search and filters,
// a grid of cards. The designs are the Video Pages templates (src/lib/landingPages/templates.js), grouped the way the studio groups them.
// Upload + draft page use the Video Pages ingest layer (ingest.js createPageFromVideo), the same code as the studio's "Create page".
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
// @ts-expect-error plain JS data module
import { TEMPLATES } from '../../../lib/landingPages/templates.js';
// @ts-expect-error plain JS module
import { wireframeSvg } from '../../../lib/landingPages/wireframes.js';
// @ts-expect-error plain JS module
import { queuePageForEditor } from '../../../lib/landingPages/handoff.js';

/** The video to add: the generator's rendered file (a local blob: URL) and what we know about it. */
export interface VideoPageSource { url: string; title: string; fileSize?: number; duration?: number | null }
export interface CreatedPage { id: string; title: string }
export interface VideoPagesDeps {
  /** `{ ok: true }` when pages can be created, otherwise why not. */
  auth: () => Promise<{ ok: boolean; reason?: string }>;
  /** Upload the video, make the draft page with the chosen design. */
  create: (video: VideoPageSource, opts: { template: string; title: string; onStep: (label: string) => void }) => Promise<CreatedPage>;
  /** Where the studio lives, for "Open in Video Pages". */
  studioUrl: () => string;
  /** "Open in Editor": open the studio on that page's editor. Returns false when it could not be opened. */
  edit: (pageId: string) => boolean;
}

interface Design { id: string; name: string; description: string; theme: { bg: string; accent: string; text: string; mode?: string }; layout: string; puck?: boolean; compose?: string; site?: unknown; intro?: boolean; pitch?: boolean }

export const MAX_VIDEO_MB = 100;
const INK = 'rgba(229,237,245,.9)';
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'inherit', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '11px 12px', fontSize: 13 };
const label: CSSProperties = { fontSize: 11, letterSpacing: '.06em', fontWeight: 600, textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 };
const chip = (on: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-medium)'}`, color: on ? 'var(--accent)' : 'inherit', background: on ? 'var(--accent-dim)' : 'var(--bg-elevated)' });
const badge = (on: boolean): CSSProperties => ({ minWidth: 22, height: 20, padding: '0 6px', borderRadius: 999, boxSizing: 'border-box', display: 'inline-grid', placeItems: 'center', fontSize: 11, background: on ? 'var(--accent-dim)' : 'var(--bg-overlay)' });
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start' };

/** The studio's own grouping of its templates. */
export const GROUPS: Array<{ id: string; label: string; glyph: string; test: (t: Design) => boolean }> = [
  { id: 'editable', label: 'Editable landing pages', glyph: '✦', test: (t) => !!t.puck },
  { id: 'structures', label: 'Page structures', glyph: '▦', test: (t) => !!t.compose && !t.site },
  { id: 'layouts', label: 'Layouts', glyph: '▭', test: (t) => !t.intro && !t.pitch && !t.compose && !t.puck },
  { id: 'intro', label: 'Personal intro', glyph: '◎', test: (t) => !!t.intro },
  { id: 'pitch', label: 'Pitch page', glyph: '▶', test: (t) => !!t.pitch },
];

/** What the studio's New page picker offers: the older fixed-layout website designs were removed from it, so they are not offered here either. */
export const offered = (all: Design[]) => all.filter((t) => !t.site);

const mb = (n?: number) => (n && n > 0 ? `${(n / 1048576).toFixed(1)} MB` : '');
const clock = (s?: number | null) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');

/** The real thing: Clerk sign-in + Supabase, and the Video Pages ingest layer (the studio's own "Create page"). */
export const defaultDeps: VideoPagesDeps = {
  auth: async () => {
    const sb = await import('../../../lib/supabase.js');
    if (!sb.isSupabaseConfigured()) return { ok: false, reason: 'Video pages need the Supabase connection, which is not configured here.' };
    if (!sb.getClerkUserId()) return { ok: false, reason: 'Sign in to add this video to Video Pages.' };
    return { ok: true };
  },
  create: async (video, { template, title, onStep }) => {
    const [ingest, sb, uploads, brands] = await Promise.all([
      import('../../../lib/landingPages/ingest.js'), import('../../../lib/supabase.js'), import('../../../lib/uploadService.js'), import('../../../lib/brandStore.js'),
    ]);
    await sb.primeSupabaseIdentity();
    const upload = (file: File) => {
      const isVideo = String(file.type).startsWith('video/');
      return uploads.uploadFileToSupabase(file, { category: isVideo ? 'video' : 'image', maxSize: isVideo ? ingest.MAX_VIDEO_BYTES : undefined, userId: sb.getClerkUserId() || undefined });
    };
    let brand: Record<string, string> = {};
    try { const b = brands.listBrands()?.[0]; if (b) brand = { accent: Array.isArray(b.primaryColors) ? b.primaryColors[0] : '', logoUrl: b.logoUrl || '' }; } catch { /* no brand saved */ }
    const page = await ingest.createPageFromVideo(sb.supabase, {
      key: `generator:${video.url}`, url: video.url, posterUrl: null, title, duration: video.duration ?? null, source: { kind: 'template-generator' }, createdAt: new Date().toISOString(), permanent: false,
    }, { template, brand, deps: { upload }, onStep });
    return { id: page.id, title: page.title };
  },
  studioUrl: () => `${window.location.origin}${window.location.pathname}#/video-pages`,
  // the studio starts on this page's editor (a tab opened with noopener shares no sessionStorage, so the page id goes through localStorage for a moment)
  edit: (pageId) => {
    if (!queuePageForEditor(pageId)) return false;
    window.open(defaultDeps.studioUrl(), '_blank', 'noopener');   // noopener: it always returns null, so there is nothing to check
    return true;
  },
};

/** The real picture of a design (public/landing-previews, made by scripts/generate-landing-design-previews.mjs); the tinted wireframe stands in if it cannot load. */
export const previewUrl = (id: string) => `/landing-previews/${encodeURIComponent(id)}.jpg`;

function DesignCard({ d, group, on, onPick }: { d: Design; group: string; on: boolean; onPick: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button type="button" aria-pressed={on} data-testid={`design-${d.id}`} onClick={onPick}
      style={{ textAlign: 'left', padding: 12, borderRadius: 14, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-subtle)'}`, boxShadow: on ? '0 0 0 1px var(--accent) inset' : 'none', background: 'var(--bg-elevated)', color: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', height: '100%' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', background: d.theme.bg, color: d.theme.accent, display: 'grid', placeItems: 'center', padding: imgOk ? 0 : 14, boxSizing: 'border-box' }}>
        {imgOk
          ? <img src={previewUrl(d.id)} alt="" loading="lazy" data-design-preview={d.id} onError={() => setImgOk(false)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          : <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: wireframeSvg(d.layout) }} />}
        <span style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,.65)', color: '#fff' }}>{group}</span>
        {on && <span style={{ position: 'absolute', right: 8, top: 8, width: 24, height: 24, borderRadius: 999, background: 'var(--accent)', color: '#04121a', display: 'grid', placeItems: 'center', fontWeight: 800 }}>✓</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>{d.name}</div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.description}</div>
    </button>
  );
}

export function VideoPagesModal({ video, onClose, deps }: { video: VideoPageSource; onClose: () => void; deps?: Partial<VideoPagesDeps> }) {
  const d = { ...defaultDeps, ...deps };
  const titleId = useId();
  const designs = useMemo(() => offered(TEMPLATES as Design[]), []);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [look, setLook] = useState('all');
  const [pick, setPick] = useState('');
  const [title, setTitle] = useState(video.title);
  const [auth, setAuth] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [made, setMade] = useState<CreatedPage | null>(null);
  const [editNote, setEditNote] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };

  useEffect(() => { let on = true; void d.auth().then((a) => { if (on) setAuth(a); }, () => { if (on) setAuth({ ok: false, reason: 'Could not check your sign-in.' }); }); return () => { on = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Esc closes (not while uploading); captured so the editor's own shortcuts cannot act on the page behind this window; Tab stays inside
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dlg = dialogRef.current;
      if (e.key === 'Escape') { e.stopPropagation(); if (!latest.current.busy) latest.current.onClose(); return; }
      if (e.key === 'Tab' && dlg) {
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
    panelRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const groupOf = (t: Design) => GROUPS.find((g) => g.test(t))?.label ?? 'Layouts';
  const counts = useMemo(() => new Map(GROUPS.map((g) => [g.id, designs.filter(g.test).length])), [designs]);
  const tabs = [{ id: 'all', label: 'All', glyph: '▦', count: designs.length }, ...GROUPS.map((g) => ({ id: g.id, label: g.label, glyph: g.glyph, count: counts.get(g.id) ?? 0 })).filter((g) => g.count > 0)];
  const needle = q.trim().toLowerCase();
  const shown = designs.filter((t) => (tab === 'all' || !!GROUPS.find((g) => g.id === tab)?.test(t)) && (look === 'all' || (t.theme.mode ?? 'light') === look) && (!needle || `${t.name} ${t.description}`.toLowerCase().includes(needle)));
  const chosen = designs.find((t) => t.id === pick);
  const tooBig = !!video.fileSize && video.fileSize > MAX_VIDEO_MB * 1048576;
  const canCreate = !!chosen && !!auth?.ok && !busy && !made && !tooBig && !!title.trim();

  const create = async () => {
    if (!chosen || !canCreate) return;
    setError(''); setBusy('Saving video…');
    try {
      const page = await d.create(video, { template: chosen.id, title: title.trim(), onStep: (s) => setBusy(`${s}…`) });
      setMade(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the page.');
    } finally { setBusy(''); }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="video-pages-modal" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }} onKeyDown={(e) => e.stopPropagation()}>
      <div ref={panelRef} tabIndex={-1} style={{ outline: 'none', width: 'min(1480px, 96vw)', height: 'min(900px, 92vh)', display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', border: '1px solid var(--border-medium)', borderRadius: 26, color: INK, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '24px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 20 }}>＋</div>
          <div style={{ flex: 1 }}>
            <div id={titleId} style={{ fontSize: 20, fontWeight: 700 }}>Add to Video Pages</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, maxWidth: 720 }}>Upload your rendered video and turn it into a landing page with a call to action and a lead form. Pick a design, then create a draft you can edit and publish in Video Pages.</div>
          </div>
          <button aria-label="Close" onClick={onClose} disabled={!!busy} style={{ background: 'transparent', border: 0, color: 'inherit', fontSize: 22, cursor: 'pointer', padding: 6 }}>×</button>
        </div>
        <div role="tablist" aria-label="Categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 20px 0' }}>
          {tabs.map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)} style={chip(on)}>
                <span style={{ opacity: 0.8, fontSize: 12 }}>{t.glyph}</span>{t.label}
                <span style={badge(on)}>{t.count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ margin: '14px 20px 0', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, background: 'var(--bg-base)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <strong style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>▣ Choose a design</strong>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, opacity: 0.6 }}>{designs.length} designs</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.65, margin: '4px 0 12px' }}>Click a design to select it, then create the draft page. You can change every word, image and section afterwards.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 18, marginBottom: 10 }}>
            <div><div style={label}>Search</div><input type="text" placeholder="⌕  Search designs…" aria-label="Search designs" value={q} onChange={(e) => setQ(e.target.value)} style={field} /></div>
            <div><div style={label}>Look</div><select aria-label="Look" value={look} onChange={(e) => setLook(e.target.value)} style={field}><option value="all">All looks</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
            <div><div style={label}>Page title</div><input type="text" aria-label="Page title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} style={field} /></div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, margin: '6px 0 10px' }}>Showing {shown.length} of {designs.length} designs</div>
          <div style={{ overflow: 'auto', ...grid, paddingRight: 4, minHeight: 0, flex: 1 }}>
            {shown.map((t) => <DesignCard key={t.id} d={t} group={groupOf(t)} on={pick === t.id} onPick={() => setPick(t.id)} />)}
            {!shown.length && <span style={{ fontSize: 13, opacity: 0.7 }}>No designs match your search.</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 28px 18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 320px' }}>
            <video src={`${video.url}#t=0.5`} muted preload="metadata" aria-hidden="true" style={{ width: 80, height: 45, borderRadius: 8, background: '#000', objectFit: 'cover', flex: '0 0 auto' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.title}</div>
              {made
                ? <div style={{ fontSize: 12.5, color: 'var(--accent)' }}>✓ Draft page “{made.title}” created. Publish it in Video Pages to get a link.</div>
                : <div style={{ fontSize: 12, opacity: 0.65 }}>{[mb(video.fileSize), clock(video.duration), chosen ? `Design: ${chosen.name}` : 'Choose a design'].filter(Boolean).join(' · ')}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 320px' }} aria-live="polite">
            {auth && !auth.ok && <span style={{ fontSize: 12.5, color: '#fbbf24' }}>{auth.reason}</span>}
            {tooBig && <span style={{ fontSize: 12.5, color: '#fbbf24' }}>This video is {mb(video.fileSize)}; the limit is {MAX_VIDEO_MB} MB. Export a shorter or lower-quality version.</span>}
            {busy && <span style={{ fontSize: 12.5, opacity: 0.8 }}>{busy}</span>}
            {error && <span role="alert" style={{ fontSize: 12.5, color: '#fca5a5' }}>{error}</span>}
            {made ? (
              <>
                {editNote && <span role="alert" style={{ fontSize: 12.5, color: '#fbbf24' }}>{editNote}</span>}
                <button type="button" data-testid="open-in-editor" onClick={() => { if (!d.edit(made.id)) setEditNote(`Could not open the editor. Open Video Pages and choose “${made.title}”.`); }} style={{ padding: '10px 16px', borderRadius: 10, border: 0, background: 'var(--accent)', color: '#04121a', fontWeight: 700, cursor: 'pointer' }}>Open in Editor</button>
                <button type="button" onClick={() => window.open(d.studioUrl(), '_blank', 'noopener')} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-medium)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Open in Video Pages</button>
                <button type="button" onClick={onClose} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-medium)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Close</button>
              </>
            ) : (
              <>
                <button type="button" onClick={onClose} disabled={!!busy} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-medium)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Cancel</button>
                <button type="button" data-testid="create-draft" onClick={() => void create()} disabled={!canCreate} style={{ padding: '10px 16px', borderRadius: 10, border: 0, background: canCreate ? 'var(--accent)' : 'var(--bg-overlay)', color: canCreate ? '#04121a' : 'inherit', fontWeight: 700, cursor: canCreate ? 'pointer' : 'not-allowed', opacity: canCreate ? 1 : 0.7 }}>{busy ? 'Creating…' : 'Create draft page'}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Opens the window on top of the page (its own React root, so the editor needs no state for it). Returns a function that closes it. */
export function openVideoPagesModal(video: VideoPageSource, deps?: Partial<VideoPagesDeps>): () => void {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => { root.unmount(); host.remove(); };
  root.render(<VideoPagesModal video={video} deps={deps} onClose={close} />);
  return close;
}
