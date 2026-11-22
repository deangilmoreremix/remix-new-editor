// Fix B4 harness (served by the vite dev server, imported by fixb-captions.cjs): renders the real CaptionsLayer
//  (a) in a Remotion Player Thumbnail (the preview path) and reads the per-word DOM styles for chosen frames,
//  (b) through renderMediaOnWeb (the export path: Remotion web renderer, h264 mp4) into a Blob.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Thumbnail } from '@remotion/player';
import { AbsoluteFill } from 'remotion';
import { CaptionsLayer } from '../../../src/openchatcut/captions/CaptionsLayer';
import type { CaptionsData } from '../../../src/openchatcut/captions/types';

const W = 640; const H = 360; const FPS = 30;
export const WORDS = ['Rendering', 'animated', 'captions', 'line', 'by', 'line'].map((text, i) => ({ id: `w${i}`, text, start: 500 + i * 300, end: 500 + i * 300 + 280 }));
export const captionsFor = (motionPreset: string): CaptionsData => ({ enabled: true, template: 'tiktok', pacing: 'phrase', motionPreset: motionPreset as CaptionsData['motionPreset'], words: WORDS, offsetFrames: 0 } as unknown as CaptionsData);

export const Comp: React.FC<{ motion: string }> = ({ motion }) => (
  <AbsoluteFill style={{ background: '#101820' }}><CaptionsLayer captions={captionsFor(motion)} items={[]} /></AbsoluteFill>
);

/** Per-word [text, opacity, transform] of the DOM the preview draws at `frame`. */
export async function previewStyles(motion: string, frame: number): Promise<Array<[string, string, string]>> {
  const host = document.createElement('div'); host.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px`; document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<Thumbnail component={Comp} inputProps={{ motion }} compositionWidth={W} compositionHeight={H} fps={FPS} durationInFrames={90} frameToDisplay={frame} style={{ width: W, height: H }} />));
  await new Promise((r) => setTimeout(r, 400));
  const out: Array<[string, string, string]> = [];
  host.querySelectorAll('span').forEach((s) => {
    const el = s as HTMLElement;
    if (el.children.length === 0 && el.textContent && el.style.display === 'inline-block') out.push([el.textContent.trim(), el.style.opacity, el.style.transform]);
  });
  root.unmount(); host.remove();
  return out;
}

export async function exportBlob(motion: string, seconds = 3): Promise<{ bytes: number[]; ext: string }> {
  const { renderMediaOnWeb } = await import('@remotion/web-renderer');
  const res = await renderMediaOnWeb({
    composition: { id: 'cap', component: Comp as never, width: W, height: H, fps: FPS, durationInFrames: Math.round(seconds * FPS), defaultProps: { motion } as never },
    inputProps: { motion } as never, container: 'mp4', videoCodec: 'h264', audioCodec: null as never, muted: true, licenseKey: 'free-license',
    hardwareAcceleration: 'prefer-software', delayRenderTimeoutInMilliseconds: 15000,
  } as never);
  const blob = await res.getBlob();
  return { bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), ext: 'mp4' };
}
