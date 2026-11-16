'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Loader2, Redo2, Square, Type, Undo2, Upload, Wand2 } from 'lucide-react';
import type { CanvasAdjustments } from '../thumbnailPrompt';
import { THUMBNAIL_MAX_BYTES } from '@ohb/lib/thumbnailUpload';
import {
  addLayer, createProject, designChecks, duplicateLayer, makeImageLayer, makeShapeLayer, makeTextLayer, moveLayer, platformsForCanvas, removeLayer, sanitizeProject, saveVariant, swapBackgroundImage, updateLayer,
  type DesignBackground, type DesignProject, type ImageLayer, type ImageRole, type Layer, type MoveDirection, type ShapeType,
} from './model';
import { exportProject, type ExportFormat } from './exportImage';
import { renderProject, type RenderAssets } from './render';
import { MAX_UPLOAD_BYTES, canvasSizeFor, cutOutSubject, fileToDataUrl, loadImage, makeMeasure, naturalSize, plannedBackdrop, plannedLook } from './designerAssets';
import { chip } from './designerUi';
import DesignerStage from './DesignerStage';
import LayerPanel from './LayerPanel';
import Inspector from './Inspector';
import BackgroundControls from './BackgroundControls';
import EditRegionPanel from './EditRegionPanel';
import ThumbnailPlatformPreview from '../ThumbnailPlatformPreview';

export interface DesignerResult {
  file: File;
  dataUrl: string;
  type: ExportFormat;
  width: number;
  height: number;
  scaledDown: boolean;
  /** The layered design, to be kept so it can be edited again. */
  project: DesignProject;
}

export interface ThumbnailDesignerProps {
  /** A saved design to continue; otherwise a new one is started from the other props. */
  initialProject?: DesignProject | null;
  /** The chosen concept picture, used as the background of a new design. */
  backgroundImageUrl?: string | null;
  aspectRatio?: string;
  /** Pre-fills a headline layer in a new design. */
  headline?: string;
  /** Exact blur / contrast / saturation (and planned colour) from the concept panel. */
  adjustments?: CanvasAdjustments | null;
  /** Image model picked in the Thumbnail step, used by "Edit a region". */
  model?: string;
  /** Open on the "Edit a region" panel. */
  openEditRegion?: boolean;
  onDone: (result: DesignerResult) => void;
  onCancel?: () => void;
}

type Tab = 'layers' | 'background' | 'checks';
const SHAPES: { shape: ShapeType; label: string }[] = [
  { shape: 'arrow', label: 'Arrow' }, { shape: 'circle', label: 'Circle' }, { shape: 'badge', label: 'Badge' }, { shape: 'rect', label: 'Box' }, { shape: 'divider', label: 'Divider' },
];
const FORMATS: { value: ExportFormat; label: string }[] = [{ value: 'image/png', label: 'PNG' }, { value: 'image/jpeg', label: 'JPEG' }];
const HISTORY_LIMIT = 60;

const addBtn = 'flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/10';
const addStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

function UploadButton({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  return (
    <label className={`${addBtn} cursor-pointer focus-within:ring-2 focus-within:ring-[#d9ff00]`} style={addStyle}>
      <Upload size={12} />
      {label}
      <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`Upload ${label.toLowerCase()}`} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </label>
  );
}

/** A small phone-sized rendering, so the text can be judged at the size most viewers see it. */
function PhonePreview({ project, assets }: { project: DesignProject; assets: RenderAssets }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cssW = 168;
  const pxW = cssW * 2;
  const pxH = Math.round((pxW * project.height) / project.width);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(pxW / project.width, pxH / project.height);
    renderProject(ctx, project, assets);
    ctx.restore();
  }, [project, assets, pxW, pxH]);
  return (
    <div>
      <p className="mb-1 text-[10px] text-white/40">Phone preview</p>
      <canvas ref={ref} data-testid="designer-phone-preview" aria-label="Phone-size preview" width={pxW} height={pxH} className="block rounded-md" style={{ width: cssW, height: Math.round((cssW * project.height) / project.width), maxWidth: '100%', background: '#000', border: '1px solid rgba(255,255,255,0.12)' }} />
    </div>
  );
}

export default function ThumbnailDesigner({ initialProject, backgroundImageUrl, aspectRatio, headline, adjustments, model, openEditRegion, onDone, onCancel }: ThumbnailDesignerProps) {
  const [project, setProject] = useState<DesignProject>(() => {
    const saved = sanitizeProject(initialProject);
    if (saved) return saved;
    const size = canvasSizeFor(aspectRatio);
    let p = createProject(size.width, size.height, backgroundImageUrl ? { mode: 'image', imageSrc: backgroundImageUrl } : {});
    if (headline?.trim()) p = addLayer(p, makeTextLayer(p, 'headline', headline.trim()));
    return p;
  });
  const projectRef = useRef(project);
  const undoStack = useRef<DesignProject[]>([]);
  const redoStack = useRef<DesignProject[]>([]);
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const [, bump] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('layers');
  const [assets, setAssets] = useState<RenderAssets>({});
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState<string | null>(null);
  const [cutOutBusy, setCutOutBusy] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('image/png');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const pending = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const measure = useMemo(() => makeMeasure(), []);

  const apply = useCallback((next: DesignProject) => {
    projectRef.current = next;
    setProject(next);
    setExported(null);
  }, []);

  /** Records an undo step; steps with the same key within a second (slider drags, nudges) count as one. */
  const pushHistory = useCallback((key?: string) => {
    const now = Date.now();
    if (key && lastKey.current && lastKey.current.key === key && now - lastKey.current.at < 1000) { lastKey.current.at = now; return; }
    lastKey.current = key ? { key, at: now } : null;
    undoStack.current = [...undoStack.current.slice(-(HISTORY_LIMIT - 1)), projectRef.current];
    redoStack.current = [];
    bump((n) => n + 1);
  }, []);

  const commit = useCallback((next: DesignProject, key?: string) => { pushHistory(key); apply(next); }, [apply, pushHistory]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(projectRef.current);
    lastKey.current = null;
    apply(prev);
    bump((n) => n + 1);
  }, [apply]);
  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(projectRef.current);
    lastKey.current = null;
    apply(next);
    bump((n) => n + 1);
  }, [apply]);

  // Keep the selection valid when its layer disappears (delete, undo).
  useEffect(() => {
    if (selectedId && !project.layers.some((l) => l.id === selectedId)) setSelectedId(null);
  }, [project, selectedId]);

  // Load every picture the design references (background + image layers).
  const sources = useMemo(() => {
    const list = project.layers.filter((l): l is ImageLayer => l.kind === 'image').map((l) => l.src);
    if (project.background.imageSrc) list.push(project.background.imageSrc);
    return Array.from(new Set(list));
  }, [project.layers, project.background.imageSrc]);

  useEffect(() => {
    for (const src of sources) {
      if (assets[src] || pending.current.has(src) || loadErrors[src]) continue;
      pending.current.add(src);
      loadImage(src)
        .then((img) => { if (mounted.current) setAssets((prev) => ({ ...prev, [src]: img })); })
        .catch((err) => { if (mounted.current) setLoadErrors((prev) => ({ ...prev, [src]: err instanceof Error ? err.message : 'The picture could not be loaded.' })); })
        .finally(() => pending.current.delete(src));
    }
  }, [sources, assets, loadErrors]);

  // Planned blur / contrast / saturation (and colour, when no picture is behind) from the concept panel.
  const lastAdj = useRef<string | null | undefined>(initialProject && sanitizeProject(initialProject) ? JSON.stringify(adjustments ?? null) : undefined);
  useEffect(() => {
    if (!adjustments) return;
    const key = JSON.stringify(adjustments);
    if (lastAdj.current === key) return;
    const first = lastAdj.current === undefined;
    lastAdj.current = key;
    const bg = projectRef.current.background;
    const patch: Partial<DesignBackground> = { ...plannedLook(adjustments), ...(bg.mode !== 'image' ? plannedBackdrop(adjustments) ?? {} : {}) };
    const next = { ...projectRef.current, background: { ...bg, ...patch } };
    if (first) apply(next); else commit(next);
  }, [adjustments, apply, commit]);

  const selected = selectedId ? project.layers.find((l) => l.id === selectedId) ?? null : null;

  // ---- layer operations
  const edit = useCallback((id: string, patch: Partial<Layer>) => commit(updateLayer(projectRef.current, id, patch), `${id}:${Object.keys(patch).join(',')}`), [commit]);
  const addNew = useCallback((layer: Layer) => { commit(addLayer(projectRef.current, layer)); setSelectedId(layer.id); setTab('layers'); }, [commit]);
  const onDelete = useCallback((id: string) => { commit(removeLayer(projectRef.current, id)); }, [commit]);
  const onDuplicate = useCallback((id: string) => {
    const r = duplicateLayer(projectRef.current, id);
    if (!r.id) return;
    commit(r.project);
    setSelectedId(r.id);
  }, [commit]);
  const onMove = useCallback((id: string, dir: MoveDirection) => commit(moveLayer(projectRef.current, id, dir)), [commit]);
  const onToggle = useCallback((id: string, key: 'locked' | 'hidden') => {
    const layer = projectRef.current.layers.find((l) => l.id === id);
    if (layer) commit(updateLayer(projectRef.current, id, { [key]: !layer[key] } as Partial<Layer>));
  }, [commit]);
  const editBackground = useCallback((patch: Partial<DesignBackground>) => {
    const p = projectRef.current;
    commit({ ...p, background: { ...p.background, ...patch } }, `bg:${Object.keys(patch).join(',')}`);
  }, [commit]);

  const canEditRegion = project.background.mode === 'image' && !!project.background.imageSrc;
  useEffect(() => { if (openEditRegion && canEditRegion) setEditing(true); }, [openEditRegion, canEditRegion]);
  // Leave the panel when the picture it edits goes away (undo to a solid background).
  useEffect(() => { if (editing && !canEditRegion) setEditing(false); }, [editing, canEditRegion]);

  /** An edited background replaces ONLY the background picture, through the undo history; layers are untouched. */
  const acceptRegionEdit = useCallback((result: { url: string }) => {
    commit(swapBackgroundImage(projectRef.current, result.url));
    setEditNote('Background updated. Your layers were not touched. Undo brings the old background back.');
  }, [commit]);
  const onSaveVariant = useCallback(() => commit(saveVariant(projectRef.current)), [commit]);
  const onPickVariant = useCallback((src: string) => commit(swapBackgroundImage(projectRef.current, src)), [commit]);

  const readImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) throw new Error('Choose a PNG, JPEG or WebP picture.');
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('That picture is larger than 20 MB. Choose a smaller one.');
    const src = await fileToDataUrl(file);
    const img = await loadImage(src);
    if (mounted.current) setAssets((prev) => ({ ...prev, [src]: img }));
    return { src, img };
  }, []);

  const addImage = useCallback(async (file: File, role: ImageRole) => {
    setMessage(null);
    try {
      const { src, img } = await readImageFile(file);
      const { w, h } = naturalSize(img);
      if (mounted.current) addNew(makeImageLayer(projectRef.current, src, w, h, role));
    } catch (err) {
      if (mounted.current) setMessage(err instanceof Error ? err.message : 'The picture could not be added.');
    }
  }, [addNew, readImageFile]);

  const uploadBackground = useCallback(async (file: File) => {
    setMessage(null);
    try {
      const { src } = await readImageFile(file);
      if (mounted.current) editBackground({ mode: 'image', imageSrc: src });
    } catch (err) {
      if (mounted.current) setMessage(err instanceof Error ? err.message : 'The picture could not be used.');
    }
  }, [editBackground, readImageFile]);

  const cutOut = useCallback(async () => {
    if (!selected || selected.kind !== 'image') return;
    const img = assets[selected.src];
    if (!img) { setMessage('Wait for the picture to finish loading, then try again.'); return; }
    const id = selected.id;
    const startSrc = selected.src;
    setMessage(null);
    setCutOutBusy(true);
    try {
      const dataUrl = await cutOutSubject(img);
      const cut = await loadImage(dataUrl);
      if (!mounted.current) return;
      setAssets((prev) => ({ ...prev, [dataUrl]: cut }));
      const { w, h } = naturalSize(cut);
      if (projectRef.current.layers.some((l) => l.id === id && l.kind === 'image' && l.src === startSrc)) edit(id, { src: dataUrl, naturalW: w, naturalH: h, role: 'subject', outline: 'white', name: 'Subject', fit: 'contain' } as Partial<ImageLayer>);
    } catch (err) {
      if (mounted.current) setMessage(err instanceof Error ? err.message : 'The cut-out failed. Try again.');
    } finally {
      if (mounted.current) setCutOutBusy(false);
    }
  }, [assets, edit, selected]);

  // ---- checks and export
  const warnings = useMemo(() => designChecks(project, measure, { platforms: platformsForCanvas(project.width, project.height) }), [project, measure, project.width, project.height]);
  // Only pictures the design still uses count: an error for a removed layer or replaced background is stale.
  const neededSources = useMemo(
    () => [project.background.mode === 'image' ? project.background.imageSrc : undefined, ...project.layers.filter((l) => l.kind === 'image' && !l.hidden).map((l) => (l as ImageLayer).src)].filter((x): x is string => !!x),
    [project.background.mode, project.background.imageSrc, project.layers],
  );
  const brokenPictures = Array.from(new Set(neededSources.filter((s) => loadErrors[s]).map((s) => loadErrors[s])));

  const doExport = useCallback(async () => {
    setMessage(null);
    setExporting(true);
    try {
      try { await document.fonts?.ready; } catch { /* fonts API unavailable */ }
      const p = projectRef.current;
      const needed = neededSources;
      if (needed.some((src) => loadErrors[src])) { setMessage('A picture in this design failed to load. Replace it or upload it as a photo, then export.'); return; }
      if (needed.some((src) => !assets[src])) { setMessage('Wait for the pictures to finish loading, then export again.'); return; }
      const result = await exportProject(p, assets, { format, maxBytes: THUMBNAIL_MAX_BYTES });
      if (!mounted.current) return; // left the designer mid-export: discard the result
      const file = new File([result.blob], `thumbnail-${Date.now()}.${result.type === 'image/png' ? 'png' : result.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: result.type });
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      if (mounted.current) setExported(`${result.width} × ${result.height}, ${result.type === 'image/png' ? 'PNG' : 'JPEG'}, ${mb} MB${result.scaledDown ? ' (made smaller to fit 2 MB)' : ''}`);
      onDone({ file, dataUrl: result.dataUrl, type: result.type, width: result.width, height: result.height, scaledDown: result.scaledDown, project: p });
    } catch (err) {
      if (mounted.current) setMessage(err instanceof Error && !/tainted|insecure/i.test(err.message) ? err.message : 'The thumbnail could not be exported. A picture in it may come from a site that blocks editing; upload it as a photo instead.');
    } finally {
      if (mounted.current) setExporting(false);
    }
  }, [assets, loadErrors, format, onDone, neededSources]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'layers', label: 'Layers' },
    { id: 'background', label: 'Background' },
    { id: 'checks', label: warnings.length ? `Checks (${warnings.length})` : 'Checks' },
  ];

  return (
    <div className="space-y-3" data-testid="thumbnail-designer" role="region" aria-label="Thumbnail designer">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-white/60 transition-colors hover:bg-white/10"><ArrowLeft size={13} />Back</button>
          )}
          <h3 className="text-sm font-semibold tracking-tight text-white">Design this thumbnail</h3>
          <span className="rounded-full px-2 py-0.5 text-[10px] text-white/40" style={{ background: 'rgba(255,255,255,0.05)' }}>{project.width} × {project.height}</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={undo} disabled={undoStack.current.length === 0} aria-label="Undo" title="Undo" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 disabled:opacity-30"><Undo2 size={14} /></button>
          <button type="button" onClick={redo} disabled={redoStack.current.length === 0} aria-label="Redo" title="Redo" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 disabled:opacity-30"><Redo2 size={14} /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Add to thumbnail">
        <button type="button" className={addBtn} style={addStyle} onClick={() => addNew(makeTextLayer(projectRef.current, 'headline', headline?.trim() || ''))}><Type size={12} />Headline</button>
        <button type="button" className={addBtn} style={addStyle} onClick={() => addNew(makeTextLayer(projectRef.current, 'subtitle'))}><Type size={11} />Subtitle</button>
        <UploadButton label="Logo" onFile={(f) => addImage(f, 'logo')} />
        <UploadButton label="Photo" onFile={(f) => addImage(f, 'photo')} />
        <UploadButton label="Subject" onFile={(f) => addImage(f, 'subject')} />
        <button type="button" className={addBtn} style={{ ...addStyle, opacity: canEditRegion ? 1 : 0.4 }} disabled={!canEditRegion} onClick={() => { setEditNote(null); setEditing(true); }}><Wand2 size={12} />Edit a region</button>
        {SHAPES.map((s) => (
          <button key={s.shape} type="button" className={addBtn} style={addStyle} onClick={() => addNew(makeShapeLayer(projectRef.current, s.shape))}><Square size={11} />{s.label}</button>
        ))}
      </div>

      {message && (
        <p role="alert" className="flex items-start gap-2 rounded-lg p-2.5 text-[11px] text-amber-200" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}><AlertCircle size={13} className="mt-0.5 shrink-0" />{message}</p>
      )}

      {editing && canEditRegion && (
        <div className="space-y-2">
          <EditRegionPanel
            sourceUrl={project.background.imageSrc as string}
            boxWidth={project.width}
            boxHeight={project.height}
            model={model}
            aspectRatio={aspectRatio}
            onAccept={acceptRegionEdit}
            onClose={() => setEditing(false)}
          />
          {editNote && <p role="status" className="text-[11px] text-emerald-300">{editNote}</p>}
        </div>
      )}

      <div hidden={editing && canEditRegion}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-2">
          <DesignerStage project={project} assets={assets} selectedId={selectedId} onSelect={setSelectedId} onGestureStart={pushHistory} onChange={apply} onDelete={onDelete} onUndo={undo} onRedo={redo} />
          <p className="text-center text-[10px] text-white/30">Drag to move, use the squares to resize and the round knob to turn. Arrow keys nudge, Delete removes. Hold Shift to keep proportions or snap the angle.</p>
        </div>

        <div className="min-w-0 space-y-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div role="tablist" aria-label="Designer panels" className="flex gap-1">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" id={`designer-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`designer-panel-${t.id}`} onClick={() => setTab(t.id)} className="flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-all" style={chip(tab === t.id)}>{t.label}</button>
            ))}
          </div>

          {tab === 'layers' && (
            <div role="tabpanel" id="designer-panel-layers" aria-labelledby="designer-tab-layers" className="space-y-3">
              <LayerPanel project={project} selectedId={selectedId} onSelect={setSelectedId} onToggle={onToggle} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} />
              {selected && (
                <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {selected.locked && <p className="mb-2 text-[10px] text-white/40">This layer is locked: unlock it to move it on the canvas.</p>}
                  <Inspector layer={selected} onChange={(patch) => edit(selected.id, patch)} onCutOut={selected.kind === 'image' ? cutOut : undefined} cutOutBusy={cutOutBusy} />
                </div>
              )}
            </div>
          )}
          {tab === 'background' && (
            <div role="tabpanel" id="designer-panel-background" aria-labelledby="designer-tab-background">
              <BackgroundControls background={project.background} onChange={editBackground} planned={adjustments} onUploadBackground={uploadBackground} onEditRegion={() => { setEditNote(null); setEditing(true); }} variants={project.variants} onSaveVariant={onSaveVariant} onPickVariant={onPickVariant} />
            </div>
          )}
          {tab === 'checks' && (
            <div role="tabpanel" id="designer-panel-checks" aria-labelledby="designer-tab-checks" className="space-y-2" data-testid="designer-checks">
              {warnings.length === 0 && brokenPictures.length === 0 && (
                <p className="flex items-center gap-2 text-[11px] text-emerald-300"><CheckCircle2 size={13} />Looks good: text fits, is readable and stays inside the safe area.</p>
              )}
              {warnings.map((w, i) => (
                <button key={`${w.id}-${w.layerId ?? i}`} type="button" onClick={() => { if (w.layerId) { setSelectedId(w.layerId); setTab('layers'); } }} className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-[11px] text-amber-200" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />{w.message}
                </button>
              ))}
              {brokenPictures.map((m) => (
                <p key={m} className="flex items-start gap-2 rounded-lg p-2 text-[11px] text-red-200" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}><AlertCircle size={13} className="mt-0.5 shrink-0" />{m}</p>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} data-testid="designer-export">
        <PhonePreview project={project} assets={assets} />
        <div className="min-w-[200px] flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="File format" className="flex gap-1">
              {FORMATS.map((f) => (
                <button key={f.value} type="button" role="radio" aria-checked={format === f.value} onClick={() => setFormat(f.value)} className="rounded-lg px-3 py-1.5 text-[11px] font-medium" style={chip(format === f.value)}>{f.label}</button>
              ))}
            </div>
            <span className="text-[10px] text-white/40">Kept under 2 MB (YouTube limit)</span>
          </div>
          <button type="button" onClick={doExport} disabled={exporting} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50" style={{ background: 'var(--color-primary, #d9ff00)', color: 'black' }}>
            {exporting ? <><Loader2 size={14} className="animate-spin" />Exporting…</> : <><Download size={14} />Use this thumbnail</>}
          </button>
          {exported && <p role="status" className="flex items-center gap-1.5 text-[11px] text-emerald-300"><CheckCircle2 size={12} />Saved as the thumbnail: {exported}</p>}
        </div>
      </div>
      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">How it will look</p>
        <ThumbnailPlatformPreview project={project} assets={assets} />
      </div>
    </div>
  );
}
