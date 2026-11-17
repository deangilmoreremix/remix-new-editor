'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Brush, Eraser, Loader2, Wand2, X } from 'lucide-react';
import { refineThumbnail, type ThumbnailRefineResult } from '@ohb/shared/api/thumbnailService';
import { composeMarkup, drawStrokes, MARKUP_INSTRUCTION, NATIVE_MARKUP_INSTRUCTION, strokesToMarkupPng, strokesToMaskPng, type Stroke } from '../thumbnailMask';
import { isImages26 } from '@ohb/lib/openaiImageOptions';
import { boxToImagePoint, clientToBoxPoint, coverFit } from './coverFit';

type Mode = 'prompt' | 'mask' | 'markup';

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'prompt', label: 'Describe', hint: 'Describe the change in words. The whole background can change.' },
  { id: 'mask', label: 'Paint an area', hint: 'Paint over the part of the background to change, then say what should be there. The rest stays as it is.' },
  { id: 'markup', label: 'Draw on it', hint: 'Draw circles, arrows or notes in red where you want changes. The AI applies them and removes the drawing.' },
];

export interface EditRegionPanelProps {
  /** The background picture being edited (the raw picture, without text or layers). */
  sourceUrl: string;
  /** The designer canvas size: the picture is shown cropped to it, exactly as in the design. */
  boxWidth: number;
  boxHeight: number;
  /** Model picked in the Thumbnail step (Images 2.6 or GPT Image 2). */
  model?: string;
  aspectRatio?: string;
  disabled?: boolean;
  /** The user accepted the edited background. */
  onAccept: (result: { url: string; responseId?: string; revisedPrompt?: string }) => void;
  onClose?: () => void;
}

export default function EditRegionPanel({ sourceUrl, boxWidth, boxHeight, model, aspectRatio = '16:9', disabled = false, onAccept, onClose }: EditRegionPanelProps) {
  const [mode, setMode] = useState<Mode>('prompt');
  const [prompt, setPrompt] = useState('');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brush, setBrush] = useState(40);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<ThumbnailRefineResult | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  // The picture the <img> element has actually finished loading (it can lag behind sourceUrl after a Discard).
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>({});

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);
  // Identifies the edit request in flight; bumped whenever the background changes so a late answer is dropped.
  const requestId = useRef(0);

  // The picture changed (accepted edit, undo, another variant): drop anything tied to the old one.
  useEffect(() => {
    requestId.current += 1;
    drawing.current = null;
    setBusy(false);
    setStrokes([]);
    setPending(null);
    setShowBefore(false);
    setError(null);
    setNote(null);
  }, [sourceUrl]);
  useEffect(() => () => { requestId.current += 1; }, []);

  // Natural size is remembered per picture, so accepting a previewed edit keeps the size it already loaded with.
  const nat = dims[sourceUrl];
  const natW = nat?.w || boxWidth;
  const natH = nat?.h || boxHeight;
  // Mask and markup edits work in the picture's own pixels, so they wait until the current picture has reported its size.
  const loaded = !!nat && readyFor === sourceUrl;
  const fit = coverFit(natW, natH, boxWidth, boxHeight);

  const paint = useCallback(
    (list: Stroke[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvas.width !== boxWidth) canvas.width = boxWidth;
      if (canvas.height !== boxHeight) canvas.height = boxHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Strokes live in the picture's own pixels; draw them through the same crop the picture has on screen.
      ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.dx, fit.dy);
      drawStrokes(ctx, list, mode === 'markup' ? '#ff2d2d' : 'rgba(217,255,0,0.55)');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
    [mode, boxWidth, boxHeight, fit.scale, fit.dx, fit.dy],
  );
  useEffect(() => paint(strokes), [strokes, paint, pending, mode]);

  const toImagePoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = clientToBoxPoint(e.currentTarget.getBoundingClientRect(), boxWidth, boxHeight, e.clientX, e.clientY);
    return boxToImagePoint(fit, natW, natH, box.x, box.y);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode === 'prompt' || busy || disabled || !loaded) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    // The brush size is on screen (canvas pixels); the stroke is stored in picture pixels.
    drawing.current = { points: [toImagePoint(e)], size: brush / fit.scale, erase: tool === 'eraser' };
    paint([...strokes, drawing.current]);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current.points.push(toImagePoint(e));
    paint([...strokes, drawing.current]);
  };
  const endStroke = () => {
    if (!drawing.current) return;
    const done = drawing.current;
    drawing.current = null;
    setStrokes((s) => [...s, done]);
  };

  const hasDrawing = strokes.some((s) => !s.erase);
  // Describe needs an instruction; paint needs a painted area and what to put there; markup only needs the drawing (the note is optional).
  const canApply = !busy && !disabled && (mode === 'prompt' || loaded) && (mode === 'markup' ? hasDrawing : prompt.trim().length > 0 && (mode === 'prompt' || hasDrawing));

  const apply = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !canApply) return;
    const id = ++requestId.current;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      let imageUrl = sourceUrl;
      let maskUrl: string | undefined;
      let markupUrl: string | undefined;
      let text = prompt.trim();
      if (mode === 'mask') {
        maskUrl = strokesToMaskPng(natW, natH, strokes);
      } else if (mode === 'markup' && isImages26(model || '')) {
        // Images 2.6 takes the drawing as its own transparent layer, so the picture is sent untouched.
        markupUrl = strokesToMarkupPng(natW, natH, strokes);
        text = `${NATIVE_MARKUP_INSTRUCTION} ${text}`;
      } else if (mode === 'markup') {
        try {
          imageUrl = composeMarkup(img, strokes);
        } catch {
          throw new Error('This image cannot be drawn on directly. Use "Paint an area" or "Describe" instead.');
        }
        text = `${MARKUP_INSTRUCTION} ${text}`;
      }
      const [first] = await refineThumbnail({ imageUrl, prompt: text, aspectRatio, n: 1, quality, model, maskUrl, markupUrl });
      if (id !== requestId.current) return; // the background changed meanwhile
      if (!first) throw new Error('No image came back. Try again.');
      setPending(first);
      setShowBefore(false);
      if (first.fallbackFrom) setNote(`Your key cannot use ${first.fallbackFrom} yet, so GPT Image 2 made this edit.`);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : 'The edit failed. Try again.');
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, [canApply, sourceUrl, prompt, mode, strokes, natW, natH, aspectRatio, quality, model]);

  const accept = () => {
    if (!pending) return;
    onAccept({ url: pending.url, responseId: pending.responseId, revisedPrompt: pending.revisedPrompt });
    setPending(null);
    setStrokes([]);
    setPrompt('');
  };

  const shown = pending && !showBefore ? pending.url : sourceUrl;
  const missingKey = !!error && /openai api key|openai key/i.test(error);

  return (
    <section data-testid="edit-region-panel" className="space-y-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} aria-label="Edit a region of the background">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Edit a region of the background</p>
        {onClose && (
          <button type="button" onClick={onClose} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"><ArrowLeft size={12} />Back to the design</button>
        )}
      </div>
      <p className="text-[10px] text-white/40">Your headline, logo, subject and other layers are not changed. Only the background picture is replaced, and Undo brings the old one back.</p>

      <div role="tablist" aria-label="Edit method" className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            type="button"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className="rounded-full px-3 py-1 text-[11px] font-medium"
            style={{
              background: mode === m.id ? 'rgba(217,255,0,0.15)' : 'rgba(255,255,255,0.05)',
              color: mode === m.id ? '#d9ff00' : 'rgba(255,255,255,0.55)',
              border: `1px solid ${mode === m.id ? 'rgba(217,255,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-white/35">{MODES.find((m) => m.id === mode)!.hint}</p>

      <div className="relative mx-auto overflow-hidden rounded-lg border border-white/10 bg-black/40" style={{ width: `min(100%, calc(50vh * ${boxWidth / boxHeight}))`, aspectRatio: `${boxWidth} / ${boxHeight}`, touchAction: mode === 'prompt' ? 'auto' : 'none' }}>
        <img
          ref={imgRef}
          src={shown}
          alt={pending && !showBefore ? 'Edited background preview' : 'Current background preview'}
          onLoad={(e) => { const { naturalWidth: w, naturalHeight: h } = e.currentTarget; if (w && h) { setDims((d) => ({ ...d, [shown]: { w, h } })); setReadyFor(shown); } }}
          className="absolute inset-0 block h-full w-full object-cover"
        />
        {mode !== 'prompt' && !pending && (
          <canvas
            ref={canvasRef}
            data-testid="thumbnail-draw-layer"
            width={boxWidth}
            height={boxHeight}
            className="absolute inset-0 h-full w-full"
            style={{ cursor: 'crosshair' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
          />
        )}
      </div>

      {mode !== 'prompt' && !pending && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/60">
          <button type="button" onClick={() => setTool('brush')} aria-pressed={tool === 'brush'} className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1" style={{ color: tool === 'brush' ? '#d9ff00' : undefined }}>
            <Brush size={12} /> Brush
          </button>
          <button type="button" onClick={() => setTool('eraser')} aria-pressed={tool === 'eraser'} className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1" style={{ color: tool === 'eraser' ? '#d9ff00' : undefined }}>
            <Eraser size={12} /> Eraser
          </button>
          <label className="flex items-center gap-2">
            Size
            <input type="range" min={8} max={120} value={brush} onChange={(e) => setBrush(Number(e.target.value))} aria-label="Brush size" />
          </label>
          <button type="button" onClick={() => setStrokes([])} disabled={strokes.length === 0} className="underline disabled:opacity-30">Clear drawing</button>
        </div>
      )}

      {pending && (
        <div className="space-y-2" data-testid="thumbnail-edit-result">
          <div className="flex items-center gap-2 text-[11px]">
            <button type="button" onClick={() => setShowBefore(true)} aria-pressed={showBefore} className="rounded-md border border-white/10 px-2 py-1">Before</button>
            <button type="button" onClick={() => setShowBefore(false)} aria-pressed={!showBefore} className="rounded-md border border-white/10 px-2 py-1">After</button>
            <span className="text-white/35">{pending.model ? `Made with ${pending.model}` : ''}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={accept} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-black" style={{ background: '#d9ff00' }}>Use this version</button>
            <button type="button" onClick={() => setPending(null)} className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60"><X size={12} /> Discard</button>
          </div>
        </div>
      )}

      {!pending && (
        <div className="space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            disabled={busy || disabled}
            placeholder={mode === 'mask' ? 'What should appear in the painted area? e.g. "a city skyline at sunset"' : mode === 'markup' ? 'Optional note about your drawing, e.g. "move the logo here"' : 'Describe the change, e.g. "make the background darker"'}
            className="w-full resize-none rounded-lg p-3 text-xs outline-none"
            style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
            aria-label="Edit instruction"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[11px] text-white/50">
              Quality
              <select value={quality} onChange={(e) => setQuality(e.target.value as 'low' | 'medium' | 'high')} className="rounded-md px-2 py-1 text-[11px]" style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} aria-label="Edit quality">
                <option value="low">Draft</option>
                <option value="medium">Standard</option>
                <option value="high">High</option>
              </select>
            </label>
            <button type="button" onClick={apply} disabled={!canApply} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40" style={{ background: 'rgba(217,255,0,0.15)', color: '#d9ff00' }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Apply edit
            </button>
          </div>
        </div>
      )}

      {note && <p className="text-[11px] text-amber-300/80" role="status">{note}</p>}
      {error && (
        <div className="rounded-lg p-2 text-[11px] text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }} role="alert">
          {error}
          {missingKey && <span className="mt-1 block text-white/50">Add your OpenAI key in Settings, then try again.</span>}
        </div>
      )}
    </section>
  );
}
