/**
 * Non-mock helpers shared by the `@remotion/web-renderer` engine tests.
 *
 * The controllable `vi.fn()` spies for `@remotion/web-renderer` are declared
 * (with `vi.hoisted`) locally in each test file — Vitest cannot export a
 * hoisted variable — but every engine test needs the same input fixtures and
 * capability presets, so those live here.
 */
import { createDefaultPreviewSettings } from '../preview/presets'
import type { PreviewInputProps } from '../preview/types'

export function makeInputProps(overrides: Partial<PreviewInputProps> = {}): PreviewInputProps {
  return {
    videoUrl: '/media/demo.mp4',
    posterUrl: null,
    isImageSource: false,
    audioUrl: null,
    settings: createDefaultPreviewSettings(),
    brand: {
      businessName: 'Acme Roofing',
      headline: 'Roofing done right',
      offer: '',
      cta: '',
      phone: '',
      website: '',
      logoUrl: null,
      productUrl: null,
      serviceUrl: null,
    },
    ...overrides,
  }
}

export function makeStubBlob(): Blob {
  return new Blob(['fake-branded-video-bytes'], { type: 'video/mp4' })
}

export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * Capability-detection presets mirroring the real `@remotion/web-renderer`
 * probe signatures. `getEncodableVideoCodecs(container)` / `getEncodableAudioCodecs(container)`.
 */
export const videoCodecPresets = {
  full: (container: string) =>
    Promise.resolve(container === 'mp4' ? (['h264'] as const) : (['vp9', 'vp8'] as const)),
  noH264: (container: string) =>
    Promise.resolve(container === 'mp4' ? ([] as const) : (['vp9', 'vp8'] as const)),
  none: () => Promise.resolve([] as const),
  h264Only: (container: string) =>
    Promise.resolve(container === 'mp4' ? (['h264'] as const) : ([] as const)),
}

export const audioCodecPresets = {
  full: (container: string) =>
    Promise.resolve(container === 'mp4' ? (['aac'] as const) : (['opus', 'vorbis'] as const)),
  none: () => Promise.resolve([] as const),
}
