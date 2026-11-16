'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, ChevronDown, ChevronUp, X, Upload } from 'lucide-react';
import {
  generateThumbnail,
  type ThumbnailComplexity,
  type ThumbnailGenerateResult,
  type ThumbnailQuality,
} from '@ohb/shared/api/thumbnailService';
import {
  CONCEPT_PRESETS,
  DEFAULT_BACKGROUND,
  DEFAULT_SUBJECT,
  REFERENCE_ROLES,
  SIZE_PRESETS,
  aspectRatioForSize,
  buildThumbnailPrompt,
  deriveCanvasAdjustments,
  distinctConceptBriefs,
  getConceptPreset,
  validateCustomSize,
  type BackgroundControls,
  type BriefReference,
  type CanvasAdjustments,
  type ConceptPresetId,
  type ReferenceRole,
  type SubjectControls,
  type ThumbnailBrief,
} from './thumbnailPrompt';

type SourceMode = 'frame' | 'upload' | 'existing' | 'prompt';
type SizeId = (typeof SIZE_PRESETS)[number]['id'] | 'custom';
type RunMode = 'variations' | 'concepts';
type Engine = 'draft' | 'detail';

const ENGINE_MODEL: Record<Engine, string> = {
  draft: 'gpt-image-2.6-flare',
  detail: 'gpt-image-2.6-sunburst',
};

const QUALITIES: ThumbnailQuality[] = ['auto', 'low', 'medium', 'high', 'xhigh', 'max'];
/** The route accepts at most 4 reference images in total, the source image included. */
const MAX_REFERENCES_TOTAL = 4;

const fieldStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' };
const sectionStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' };

function pillStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'rgba(217,255,0,0.12)' : 'rgba(255,255,255,0.04)',
    color: active ? '#d9ff00' : 'rgba(255,255,255,0.45)',
    border: `1px solid ${active ? 'rgba(217,255,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-white/40 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Select<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: readonly (T | { value: T; label: string })[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <Field label={label}>
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)} className="w-full px-2 py-1.5 rounded-lg text-[11px] outline-none disabled:opacity-50" style={fieldStyle}>
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return <option key={opt.value} value={opt.value}>{opt.label}</option>;
        })}
      </select>
    </Field>
  );
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl" style={sectionStyle}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-white/50">
        {title}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && <div className="space-y-3 px-3 pb-3">{children}</div>}
    </div>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface ExtraReference {
  url: string;
  role: ReferenceRole;
}

export interface ThumbnailConceptPanelProps {
  assetType: 'image' | 'video';
  /** The studio output (video frame or image) when it could be read. */
  frameUrl?: string | null;
  /** The thumbnail already chosen for this post, if any. */
  existingThumbnailUrl?: string | null;
  defaults?: { title?: string; topic?: string };
  disabled?: boolean;
  onGeneratingChange?: (pending: number) => void;
  onResults: (results: ThumbnailGenerateResult[], context: { aspectRatio: string; size: string }) => void;
  onError?: (message: string | null) => void;
  /** Exact colour/contrast values for the Phase 2 canvas compositor. */
  onCanvasAdjustmentsChange?: (adjustments: CanvasAdjustments) => void;
}

export default function ThumbnailConceptPanel({
  assetType,
  frameUrl,
  existingThumbnailUrl,
  defaults,
  disabled = false,
  onGeneratingChange,
  onResults,
  onError,
  onCanvasAdjustmentsChange,
}: ThumbnailConceptPanelProps) {
  const [title, setTitle] = useState(defaults?.title ?? '');
  const [topic, setTopic] = useState(defaults?.topic ?? '');
  const [audience, setAudience] = useState('');
  const [viewerSees, setViewerSees] = useState('');
  const [presetId, setPresetId] = useState<ConceptPresetId>('host-headline');
  const [subject, setSubject] = useState<SubjectControls>(DEFAULT_SUBJECT);
  const [background, setBackground] = useState<BackgroundControls>(DEFAULT_BACKGROUND);

  const [source, setSource] = useState<SourceMode>('prompt');
  const [uploadedSource, setUploadedSource] = useState<string | null>(null);
  const [extraRefs, setExtraRefs] = useState<ExtraReference[]>([]);

  const [engine, setEngine] = useState<Engine>('draft');
  const [quality, setQuality] = useState<ThumbnailQuality>('medium');
  const [complexity, setComplexity] = useState<ThumbnailComplexity | ''>('');
  const [sizeId, setSizeId] = useState<SizeId>('native');
  const [customW, setCustomW] = useState('1280');
  const [customH, setCustomH] = useState('720');
  const [runMode, setRunMode] = useState<RunMode>('variations');
  const [count, setCount] = useState(1);
  const [imageBackground, setImageBackground] = useState<'auto' | 'opaque' | 'transparent'>('auto');
  const [outputFormat, setOutputFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [compression, setCompression] = useState(80);

  const [generating, setGenerating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);

  useEffect(() => () => { runIdRef.current += 1; }, []);

  // Pick a sensible starting source once the studio output is readable.
  useEffect(() => {
    setSource((current) => (current === 'prompt' && frameUrl ? 'frame' : current));
  }, [frameUrl]);

  const sourceUrl = useMemo(() => {
    if (source === 'frame') return frameUrl ?? null;
    if (source === 'upload') return uploadedSource;
    if (source === 'existing') return existingThumbnailUrl ?? null;
    return null;
  }, [source, frameUrl, uploadedSource, existingThumbnailUrl]);

  const subjectRole: ReferenceRole | null = subject.kind === 'person' ? 'person' : subject.kind === 'product' ? 'product' : null;

  /** Images sent with the request, in order, each with the role written into the prompt. */
  const references = useMemo(() => {
    const list: { url: string; role: ReferenceRole; label: string }[] = [];
    if (sourceUrl) {
      const role: ReferenceRole = subject.useOriginal && subjectRole ? subjectRole : 'source';
      const label = source === 'frame' ? (assetType === 'video' ? 'video frame' : 'studio image') : source === 'existing' ? 'current thumbnail' : 'uploaded photo';
      list.push({ url: sourceUrl, role, label });
    }
    // Only as many extra photos as the route will actually use, so every labelled reference is really sent.
    extraRefs.slice(0, MAX_REFERENCES_TOTAL - (sourceUrl ? 1 : 0)).forEach((r, i) => list.push({ url: r.url, role: r.role, label: `upload ${i + 1}` }));
    return list;
  }, [sourceUrl, source, assetType, subject.useOriginal, subjectRole, extraRefs]);

  const brief: ThumbnailBrief = useMemo(() => ({
    title,
    topic,
    audience,
    viewerSees,
    presetId,
    subject,
    background,
    references: references.map<BriefReference>(({ role, label }) => ({ role, label })),
  }), [title, topic, audience, viewerSees, presetId, subject, background, references]);

  const promptPreview = useMemo(() => buildThumbnailPrompt(brief), [brief]);
  const canvasAdjustments = useMemo(() => deriveCanvasAdjustments(brief), [brief]);

  useEffect(() => { onCanvasAdjustmentsChange?.(canvasAdjustments); }, [canvasAdjustments, onCanvasAdjustmentsChange]);

  const sizeCheck = useMemo(() => {
    if (sizeId === 'custom') return validateCustomSize(customW, customH);
    const preset = SIZE_PRESETS.find((p) => p.id === sizeId) ?? SIZE_PRESETS[0];
    return { ok: true, size: preset.size };
  }, [sizeId, customW, customH]);

  const setSubjectField = useCallback(<K extends keyof SubjectControls>(key: K, value: SubjectControls[K]) => setSubject((s) => ({ ...s, [key]: value })), []);
  const setBackgroundField = useCallback(<K extends keyof BackgroundControls>(key: K, value: BackgroundControls[K]) => setBackground((b) => ({ ...b, [key]: value })), []);

  const hasBriefInput = !!(title.trim() || topic.trim() || viewerSees.trim() || references.length > 0);
  const transparentJpeg = imageBackground === 'transparent' && outputFormat === 'jpeg';
  const formError = !sizeCheck.ok ? sizeCheck.error ?? null
    : transparentJpeg ? 'Transparent output needs PNG or WebP.'
    : subject.useOriginal && subjectRole && !references.some((r) => r.role === subjectRole) ? `Add a ${subjectRole} photo to use the original.`
    : null;
  const shownError = formError || localError;

  const handleGenerate = useCallback(async () => {
    if (generating || formError || !sizeCheck.ok || !sizeCheck.size) return;
    setLocalError(null);
    onError?.(null);
    const size = sizeCheck.size;
    const aspectRatio = aspectRatioForSize(size);
    const briefs = runMode === 'concepts' ? distinctConceptBriefs(brief, 3) : [brief];
    const perRequest = runMode === 'concepts' ? 1 : count;
    const runId = ++runIdRef.current;
    setGenerating(true);
    onGeneratingChange?.(briefs.length * perRequest);
    const referenceUrls = references.map((r) => r.url);
    try {
      const settled = await Promise.allSettled(briefs.map((b) => generateThumbnail({
        prompt: buildThumbnailPrompt(b),
        model: ENGINE_MODEL[engine],
        aspectRatio,
        size,
        n: perRequest,
        quality,
        ...(complexity ? { complexity } : {}),
        ...(imageBackground !== 'auto' ? { background: imageBackground } : {}),
        outputFormat,
        ...(outputFormat !== 'png' ? { outputCompression: compression } : {}),
        ...(referenceUrls.length ? { referenceUrls } : {}),
      })));
      if (runId !== runIdRef.current) return;
      const results = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
      const failures = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
      if (results.length === 0) {
        const reason = failures[0]?.reason;
        const message = reason instanceof Error ? reason.message : 'Generation failed';
        setLocalError(message);
        onError?.(message);
        return;
      }
      if (failures.length > 0) setLocalError(`${failures.length} of ${briefs.length} concepts failed; showing the rest.`);
      onResults(results, { aspectRatio, size });
    } finally {
      if (runId === runIdRef.current) {
        setGenerating(false);
        onGeneratingChange?.(0);
      }
    }
  }, [generating, formError, sizeCheck, onError, runMode, brief, count, onGeneratingChange, references, engine, quality, complexity, imageBackground, outputFormat, compression, onResults]);

  const pickUpload = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadedSource(await readFile(file));
    setSource('upload');
  }, []);

  const addExtraReference = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    const urls = await Promise.all(Array.from(files).filter((f) => f.type.startsWith('image/')).map(readFile));
    // Same source-aware cap as the picker: with a source image only 3 extras can be sent, so never store a 4th.
    setExtraRefs((prev) => [...prev, ...urls.map<ExtraReference>((url) => ({ url, role: 'style' }))].slice(0, MAX_REFERENCES_TOTAL - (sourceUrl ? 1 : 0)));
  }, [sourceUrl]);

  const maxExtra = MAX_REFERENCES_TOTAL - (sourceUrl ? 1 : 0);
  // A source image appearing after extras were added shrinks the room: drop what the route could not use anyway.
  useEffect(() => { setExtraRefs((prev) => (prev.length > maxExtra ? prev.slice(0, maxExtra) : prev)); }, [maxExtra]);
  const off = disabled || generating;
  const preset = getConceptPreset(presetId);
  const buttonLabel = runMode === 'concepts' ? 'Generate 3 distinct concepts' : `Generate ${count} concept${count > 1 ? 's' : ''}`;

  return (
    <div className="space-y-3" role="region" aria-label="Thumbnail concept generator">
      <Section title="Brief">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Video title"><input aria-label="Video title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={off} className="w-full px-2.5 py-1.5 rounded-lg text-[11px] outline-none disabled:opacity-50" style={fieldStyle} /></Field>
          <Field label="Topic"><input aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={off} className="w-full px-2.5 py-1.5 rounded-lg text-[11px] outline-none disabled:opacity-50" style={fieldStyle} /></Field>
          <Field label="Audience"><input aria-label="Audience" value={audience} onChange={(e) => setAudience(e.target.value)} disabled={off} className="w-full px-2.5 py-1.5 rounded-lg text-[11px] outline-none disabled:opacity-50" style={fieldStyle} /></Field>
          <Field label="What the viewer sees"><input aria-label="What the viewer sees" value={viewerSees} onChange={(e) => setViewerSees(e.target.value)} disabled={off} className="w-full px-2.5 py-1.5 rounded-lg text-[11px] outline-none disabled:opacity-50" style={fieldStyle} /></Field>
        </div>
        <div>
          <p className="text-[10px] text-white/40 mb-1">Start from</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Brief source">
            {([
              { id: 'frame', label: assetType === 'video' ? 'Video frame' : 'Studio image', available: !!frameUrl },
              { id: 'upload', label: 'Upload', available: true },
              { id: 'existing', label: 'Existing thumbnail', available: !!existingThumbnailUrl },
              { id: 'prompt', label: 'Prompt only', available: true },
            ] as { id: SourceMode; label: string; available: boolean }[]).map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={source === s.id} disabled={off || !s.available}
                onClick={() => (s.id === 'upload' && !uploadedSource ? uploadRef.current?.click() : setSource(s.id))}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium disabled:opacity-40" style={pillStyle(source === s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <input ref={uploadRef} type="file" accept="image/*" aria-label="Upload source image" className="hidden" onChange={(e) => { void pickUpload(e.target.files); e.target.value = ''; }} />
          {sourceUrl && <img src={sourceUrl} alt="Brief source" className="mt-2 h-14 rounded-lg object-cover" />}
        </div>
      </Section>

      <Section title="Concept">
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Concept presets">
          {CONCEPT_PRESETS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={presetId === p.id} disabled={off} onClick={() => setPresetId(p.id)} className="rounded-lg px-2.5 py-2 text-left disabled:opacity-50" style={pillStyle(presetId === p.id)}>
              <span className="block text-[11px] font-bold">{p.label}</span>
              <span className="block text-[9px] opacity-70">{p.description}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/30">{preset.description}</p>
      </Section>

      <Section title="Subject" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Subject type" value={subject.kind} disabled={off} onChange={(v) => setSubjectField('kind', v)} options={[{ value: 'person', label: 'Person' }, { value: 'product', label: 'Product' }, { value: 'none', label: 'No subject' }]} />
          <Select label="Placement" value={subject.placement} disabled={off || subject.kind === 'none'} onChange={(v) => setSubjectField('placement', v)} options={['left', 'center', 'right']} />
          <Select label="Crop" value={subject.crop} disabled={off || subject.kind === 'none'} onChange={(v) => setSubjectField('crop', v)} options={['close-up', 'medium', 'wide']} />
          <Select label="Gaze" value={subject.gaze} disabled={off || subject.kind !== 'person'} onChange={(v) => setSubjectField('gaze', v)} options={['camera', 'left', 'right', 'up', 'down']} />
          <Select label="Expression" value={subject.expression} disabled={off || subject.kind !== 'person'} onChange={(v) => setSubjectField('expression', v)} options={['neutral', 'happy', 'surprised', 'serious', 'excited']} />
          <Select label="Outline" value={subject.outline} disabled={off || subject.kind === 'none'} onChange={(v) => setSubjectField('outline', v)} options={[{ value: 'none', label: 'None' }, { value: 'white', label: 'White outline' }, { value: 'glow', label: 'Glow' }]} />
        </div>
        <Field label="Pose"><input aria-label="Pose" value={subject.pose} onChange={(e) => setSubjectField('pose', e.target.value)} disabled={off || subject.kind === 'none'} placeholder="e.g. pointing at the product" className="w-full px-2.5 py-1.5 rounded-lg text-[11px] outline-none disabled:opacity-50" style={fieldStyle} /></Field>
        <Field label={`Scale: ${subject.scale}% of frame height`}><input type="range" aria-label="Subject scale" min={20} max={100} value={subject.scale} onChange={(e) => setSubjectField('scale', Number(e.target.value))} disabled={off || subject.kind === 'none'} className="w-full accent-[#d9ff00]" /></Field>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={subject.useOriginal} onChange={(e) => setSubjectField('useOriginal', e.target.checked)} disabled={off || subject.kind === 'none'} className="accent-[#d9ff00]" aria-label="Use original photo" />
          <span className="text-[10px] text-white/60">Use original photo (the photo is sent as a reference: use this {subject.kind === 'product' ? 'product' : 'person'} exactly)</span>
        </label>
      </Section>

      <Section title="Background and style" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Background type" value={background.mode} disabled={off} onChange={(v) => setBackgroundField('mode', v)} options={[{ value: 'scene', label: 'Scene' }, { value: 'solid', label: 'Solid colour' }, { value: 'gradient', label: 'Gradient' }]} />
          <Select label="Blur" value={background.blur} disabled={off || background.mode !== 'scene'} onChange={(v) => setBackgroundField('blur', v)} options={['none', 'soft', 'strong']} />
        </div>
        {background.mode === 'scene' && <Field label="Scene"><input aria-label="Scene" value={background.scene} onChange={(e) => setBackgroundField('scene', e.target.value)} disabled={off} placeholder="e.g. modern home studio with shelves" className="w-full px-2.5 py-1.5 rounded-lg text-[11px] outline-none disabled:opacity-50" style={fieldStyle} /></Field>}
        {background.mode === 'solid' && <Field label="Colour"><input type="color" aria-label="Solid colour" value={background.solidColor} onChange={(e) => setBackgroundField('solidColor', e.target.value)} disabled={off} className="w-full h-8 rounded-lg" /></Field>}
        {background.mode === 'gradient' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="From"><input type="color" aria-label="Gradient from" value={background.gradientFrom} onChange={(e) => setBackgroundField('gradientFrom', e.target.value)} disabled={off} className="w-full h-8 rounded-lg" /></Field>
            <Field label="To"><input type="color" aria-label="Gradient to" value={background.gradientTo} onChange={(e) => setBackgroundField('gradientTo', e.target.value)} disabled={off} className="w-full h-8 rounded-lg" /></Field>
          </div>
        )}
        {background.mode !== 'scene' && <p className="text-[10px] text-white/30">The AI only sees an approximate backdrop for this colour. The exact colour, blur and contrast are applied in the thumbnail designer (Design this thumbnail), not by the AI, and only when you set the designer's background to a Solid or Gradient background; a generated picture keeps the AI's colours.</p>}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Palette"><input aria-label="Palette" value={background.palette} onChange={(e) => setBackgroundField('palette', e.target.value)} disabled={off} placeholder="e.g. teal and orange" className="w-full px-2.5 py-1.5 rounded-lg text-[11px] outline-none disabled:opacity-50" style={fieldStyle} /></Field>
          <Select label="Lighting" value={background.lighting} disabled={off} onChange={(v) => setBackgroundField('lighting', v)} options={['natural', 'studio', 'dramatic', 'neon', 'golden-hour', 'soft']} />
          <Select label="Contrast" value={background.contrast} disabled={off} onChange={(v) => setBackgroundField('contrast', v)} options={['low', 'normal', 'high']} />
          <Select label="Saturation" value={background.saturation} disabled={off} onChange={(v) => setBackgroundField('saturation', v)} options={['low', 'normal', 'high']} />
          <Select label="Depth" value={background.depth} disabled={off} onChange={(v) => setBackgroundField('depth', v)} options={['flat', 'shallow', 'deep']} />
          <Select label="Style" value={background.style} disabled={off} onChange={(v) => setBackgroundField('style', v)} options={['photoreal', 'cinematic', 'illustration', '3d-render', 'graphic']} />
        </div>
      </Section>

      <Section title="Reference images" defaultOpen={false}>
        {extraRefs.length === 0 && <p className="text-[10px] text-white/30">Add photos and say what each one is for; the role is written into the prompt.</p>}
        {extraRefs.map((r, i) => (
          <div key={`${r.url.slice(-24)}-${i}`} className="flex items-center gap-2">
            <img src={r.url} alt="" className="h-10 w-14 rounded-md object-cover" />
            <select aria-label={`Role for reference ${i + 1}`} value={r.role} disabled={off} onChange={(e) => setExtraRefs((prev) => prev.map((x, j) => (j === i ? { ...x, role: e.target.value as ReferenceRole } : x)))} className="flex-1 px-2 py-1.5 rounded-lg text-[11px] outline-none" style={fieldStyle}>
              {REFERENCE_ROLES.filter((role) => role.id !== 'source').map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
            </select>
            <button type="button" aria-label={`Remove reference ${i + 1}`} disabled={off} onClick={() => setExtraRefs((prev) => prev.filter((_, j) => j !== i))} className="p-1 text-white/40 hover:text-red-400"><X size={12} /></button>
          </div>
        ))}
        <button type="button" disabled={off || extraRefs.length >= maxExtra} onClick={() => extraRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium disabled:opacity-40" style={pillStyle(false)}>
          <Upload size={11} /> Add reference image
        </button>
        <input ref={extraRef} type="file" accept="image/*" multiple aria-label="Add reference image" className="hidden" onChange={(e) => { void addExtraReference(e.target.files); e.target.value = ''; }} />
      </Section>

      <Section title="Generation">
        <div className="grid grid-cols-2 gap-2">
          <Select<Engine> label="Model" value={engine} disabled={off} onChange={setEngine} options={[{ value: 'draft', label: 'Fast draft (2.6 Flare)' }, { value: 'detail', label: 'Detailed render (2.6 Sunburst)' }]} />
          <Select<ThumbnailQuality> label="Render detail" value={quality} disabled={off} onChange={setQuality} options={QUALITIES} />
          <Select<"" | ThumbnailComplexity> label="Composition complexity" value={complexity} disabled={off} onChange={setComplexity} options={[{ value: '', label: 'Default' }, { value: 'low', label: 'low' }, { value: 'medium', label: 'medium' }, { value: 'high', label: 'high' }] as const} />
          <Select<SizeId> label="Size" value={sizeId} disabled={off} onChange={setSizeId} options={[...SIZE_PRESETS.map((p) => ({ value: p.id as SizeId, label: p.label })), { value: 'custom' as SizeId, label: 'Custom size' }]} />
        </div>
        {sizeId === 'custom' && (
          <div className="flex items-end gap-2">
            <Field label="Width"><input aria-label="Custom width" inputMode="numeric" value={customW} onChange={(e) => setCustomW(e.target.value)} disabled={off} className="w-24 px-2 py-1.5 rounded-lg text-[11px] outline-none" style={fieldStyle} /></Field>
            <span className="pb-1.5 text-white/40">x</span>
            <Field label="Height"><input aria-label="Custom height" inputMode="numeric" value={customH} onChange={(e) => setCustomH(e.target.value)} disabled={off} className="w-24 px-2 py-1.5 rounded-lg text-[11px] outline-none" style={fieldStyle} /></Field>
          </div>
        )}
        <div>
          <p className="text-[10px] text-white/40 mb-1">Variations</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex gap-1" role="radiogroup" aria-label="Variation count">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={runMode === 'variations' && count === n} disabled={off} onClick={() => { setRunMode('variations'); setCount(n); }} className="w-8 h-8 rounded-lg text-xs font-bold disabled:opacity-50" style={pillStyle(runMode === 'variations' && count === n)}>{n}</button>
              ))}
            </div>
            <button type="button" role="radio" aria-checked={runMode === 'concepts'} disabled={off} onClick={() => setRunMode('concepts')} className="h-8 px-3 rounded-lg text-[10px] font-bold disabled:opacity-50" style={pillStyle(runMode === 'concepts')}>3 distinct concepts</button>
          </div>
          {runMode === 'concepts' && <p className="mt-1 text-[10px] text-white/30">Three separate requests, each with a different preset and subject placement.</p>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select<"auto" | "transparent" | "opaque"> label="Background" value={imageBackground} disabled={off} onChange={setImageBackground} options={['auto', 'opaque', 'transparent']} />
          <Select<"png" | "jpeg" | "webp"> label="Output format" value={outputFormat} disabled={off} onChange={setOutputFormat} options={['png', 'jpeg', 'webp']} />
          <Field label={`Compression: ${compression}`}><input type="range" aria-label="Output compression" min={0} max={100} value={compression} onChange={(e) => setCompression(Number(e.target.value))} disabled={off || outputFormat === 'png'} className="w-full accent-[#d9ff00] disabled:opacity-40" /></Field>
        </div>
      </Section>

      <details className="rounded-xl p-3" style={sectionStyle}>
        <summary className="cursor-pointer text-[11px] text-white/50">Prompt preview</summary>
        <p data-testid="concept-prompt-preview" className="mt-2 whitespace-pre-wrap text-[10px] leading-4 text-white/50">{promptPreview}</p>
      </details>

      {shownError && <p role="alert" data-testid="concept-panel-error" className="text-[11px] text-red-300">{shownError}</p>}

      <button type="button" onClick={handleGenerate} disabled={off || !!formError || !hasBriefInput} className="w-full h-10 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'var(--color-primary, #d9ff00)', color: 'black' }}>
        {generating ? <><Loader2 size={14} className="animate-spin" />Generating…</> : <><Sparkles size={14} />{buttonLabel}</>}
      </button>
    </div>
  );
}
