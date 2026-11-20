'use client';

import React, { useState } from 'react';
import { Download, Loader2, Shapes, Film } from 'lucide-react';
import { generateThumbnail } from '@ohb/shared/api/thumbnailService';
import { describeUsage } from '@ohb/shared/api/imageUsage';
import { GIF_FRAME_COUNT, GIF_FRAME_DURATION_MS } from '@ohb/lib/openaiImageOptions';
import { isSafeSvg, svgTextFromDataUrl } from '@ohb/lib/svgSafety';
import { rasterizeSvg } from './svgRaster';

export interface DesignerGraphic {
  id: string
  name: string
  /** PNG data URL the designer can place as a picture layer. */
  dataUrl: string
}

const MODEL = 'gpt-image-2.6-flare';
const field = 'w-full rounded-lg px-2 py-1.5 text-[11px] text-white outline-none';
const fieldStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' };

function download(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Optional AI extras from Images 2.6: a vector graphic (SVG) and an animated GIF. They are never needed to
 * finish a thumbnail; the designer's own text, shapes and arrows are free.
 */
export default function ThumbnailExtras({ onGraphic, disabled }: { onGraphic: (graphic: DesignerGraphic) => void; disabled?: boolean }) {
  const [svgPrompt, setSvgPrompt] = useState('');
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [svgNote, setSvgNote] = useState<string | null>(null);
  const [gifPrompt, setGifPrompt] = useState('');
  const [frames, setFrames] = useState<number>(GIF_FRAME_COUNT.default);
  const [duration, setDuration] = useState<number>(GIF_FRAME_DURATION_MS.default);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [busy, setBusy] = useState<'svg' | 'gif' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const makeSvg = async () => {
    setBusy('svg'); setError(null); setSvgUrl(null); setSvgNote(null);
    try {
      const [first] = await generateThumbnail({ prompt: `A clean vector graphic: ${svgPrompt.trim()}`, model: MODEL, outputFormat: 'svg', n: 1, aspectRatio: '1:1' });
      const text = first ? svgTextFromDataUrl(first.url) : null;
      if (!first || !text || !isSafeSvg(text)) throw new Error('The graphic could not be used safely. Try again.');
      setSvgUrl(first.url);
      setUsage(describeUsage(first.usage, first.model ?? MODEL)?.text ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The graphic failed. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const addSvg = async () => {
    if (!svgUrl) return;
    try {
      onGraphic({ id: `svg-${Date.now()}`, name: 'Graphic', dataUrl: await rasterizeSvg(svgUrl) });
      setSvgNote('Added. Open "Design this thumbnail" and add it with the "Your graphic" button.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The graphic could not be added.');
    }
  };

  const makeGif = async () => {
    setBusy('gif'); setError(null); setGifUrl(null);
    try {
      const [first] = await generateThumbnail({ prompt: gifPrompt.trim(), model: MODEL, outputFormat: 'gif', n: 1, frameCount: frames, frameDurationMs: duration, aspectRatio: '16:9' });
      if (!first) throw new Error('The animation did not come back. Try again.');
      setGifUrl(first.url);
      setUsage(describeUsage(first.usage, first.model ?? MODEL)?.text ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The animation failed. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <details className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }} data-testid="thumbnail-extras">
      <summary className="cursor-pointer text-[11px] font-semibold text-white/70">Graphics and animation (optional, AI: uses your OpenAI key)</summary>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <section className="space-y-2" aria-label="Vector graphic">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40"><Shapes size={12} />Vector graphic (SVG)</p>
          <input aria-label="Describe the graphic" className={field} style={fieldStyle} value={svgPrompt} onChange={(e) => setSvgPrompt(e.target.value)} placeholder="e.g. a bold lightning badge" />
          <button type="button" onClick={makeSvg} disabled={disabled || !!busy || !svgPrompt.trim()} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40" style={{ border: '1px solid rgba(255,255,255,0.25)', color: 'white', background: 'transparent' }}>
            {busy === 'svg' ? <Loader2 size={12} className="animate-spin" /> : null}Make graphic
          </button>
          {svgUrl && (
            <div className="space-y-1.5">
              <img src={svgUrl} alt="Generated vector graphic" className="h-24 w-24 rounded-lg bg-white/90 object-contain p-1" />
              <div className="flex gap-1.5">
                <button type="button" onClick={() => download(svgUrl, 'graphic.svg')} className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/70"><Download size={10} />Download SVG</button>
                <button type="button" onClick={addSvg} className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/70">Add to designer</button>
              </div>
              {svgNote && <p role="status" className="text-[10px] text-[#d9ff00]">{svgNote}</p>}
            </div>
          )}
        </section>

        <section className="space-y-2" aria-label="Animated GIF">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40"><Film size={12} />Animated GIF</p>
          <input aria-label="Describe the animation" className={field} style={fieldStyle} value={gifPrompt} onChange={(e) => setGifPrompt(e.target.value)} placeholder="e.g. a coffee cup steaming" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-white/50">Frames ({GIF_FRAME_COUNT.min} to {GIF_FRAME_COUNT.max})
              <input aria-label="Frames" type="number" min={GIF_FRAME_COUNT.min} max={GIF_FRAME_COUNT.max} value={frames} onChange={(e) => setFrames(Math.min(GIF_FRAME_COUNT.max, Math.max(GIF_FRAME_COUNT.min, Number(e.target.value) || GIF_FRAME_COUNT.default)))} className={field} style={fieldStyle} />
            </label>
            <label className="text-[10px] text-white/50">Frame time in ms ({GIF_FRAME_DURATION_MS.min} to {GIF_FRAME_DURATION_MS.max})
              <input aria-label="Frame time" type="number" min={GIF_FRAME_DURATION_MS.min} max={GIF_FRAME_DURATION_MS.max} step={10} value={duration} onChange={(e) => setDuration(Math.min(GIF_FRAME_DURATION_MS.max, Math.max(GIF_FRAME_DURATION_MS.min, Number(e.target.value) || GIF_FRAME_DURATION_MS.default)))} className={field} style={fieldStyle} />
            </label>
          </div>
          <button type="button" onClick={makeGif} disabled={disabled || !!busy || !gifPrompt.trim()} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40" style={{ border: '1px solid rgba(255,255,255,0.25)', color: 'white', background: 'transparent' }}>
            {busy === 'gif' ? <Loader2 size={12} className="animate-spin" /> : null}Make GIF
          </button>
          {gifUrl && (
            <div className="space-y-1.5">
              <img src={gifUrl} alt="Generated animated GIF" className="max-h-32 rounded-lg" />
              <button type="button" onClick={() => download(gifUrl, 'animation.gif')} className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/70"><Download size={10} />Download GIF</button>
              <p className="text-[10px] text-white/40">YouTube and Instagram covers need JPEG or PNG, so publishing still uses your still thumbnail. Use the GIF where animation is welcome.</p>
            </div>
          )}
        </section>
      </div>
      {usage && <p className="mt-2 text-[10px] text-white/40" data-testid="extras-usage">{usage}</p>}
      {error && <p role="alert" className="mt-2 text-[11px] text-red-400">{error}</p>}
    </details>
  );
}
