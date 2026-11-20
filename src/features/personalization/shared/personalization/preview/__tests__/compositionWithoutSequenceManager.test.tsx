// @vitest-environment jsdom
/**
 * Remotion 4.0.5xx removed `Internals.SequenceManager`. The composition used to read `.Provider` off it
 * unconditionally, so every render threw and the preview, the template cards and the export all came out black.
 */
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PersonalizationComposition } from '../PersonalizationComposition';
import { createDefaultPreviewSettings } from '../presets';
import type { PreviewInputProps } from '../types';

vi.mock('@remotion/media', () => ({ Video: () => <div data-testid="media-video" />, Audio: () => null }));

vi.mock('remotion', async () => ({
  AbsoluteFill: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Img: ({ src }: { src: string }) => <img src={src} alt="" />,
  Sequence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  // The newer Remotion shape: Internals exists but has no SequenceManager.
  Internals: {},
  useCurrentFrame: () => 30,
  useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
  interpolate: (_i: number, _r: number[], out: number[]) => out[out.length - 1] ?? 1,
  spring: () => 1,
  Easing: (await vi.importActual<typeof import('remotion')>('remotion')).Easing,
}));

const input: PreviewInputProps = {
  videoUrl: null, posterUrl: null, isImageSource: false, audioUrl: null,
  settings: createDefaultPreviewSettings(),
  brand: { businessName: 'Acme Bakery', headline: 'Fresh daily', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null },
};

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ''; });

describe('composition on a Remotion without Internals.SequenceManager', () => {
  it('still renders the layers instead of throwing', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    expect(() => act(() => { root!.render(<PersonalizationComposition {...input} />); })).not.toThrow();
    expect(el.textContent).toContain('Acme Bakery');
  });
});
