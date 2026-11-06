// @vitest-environment jsdom
/**
 * TASK 4 — customer audio track for the personalization preview.
 *
 * Covers the four guarantees the feature must keep:
 *   1. Only supported audio (mp3/m4a/wav/ogg/aac) inside the size cap is
 *      accepted, and every rejection carries an actionable message.
 *   2. The selected track is heard before it is applied (preview playback).
 *   3. The track reaches the Remotion composition — and therefore the
 *      in-browser export — instead of staying a UI-only selection.
 *   4. What is persisted is always a durable storage reference: blob: URLs are
 *      refused by both the persistence guard and the restore normalizer.
 */
import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

import {
  AUDIO_MAX_UPLOAD_BYTES,
  audioExtensionOf,
  isSupportedAudioFile,
  supportedAudioFormatOf,
  validateAudioFile,
} from '../guided/audioTrack'
import { buildPreviewInput } from '../guided/buildPreviewInput'
import {
  createDefaultPreviewSettings,
  normalizePreviewAudio,
  normalizePreviewSettings,
} from '../preview/presets'

// ── Provider dependency mocks (same set as DemoPersonalizeProvider.test.tsx) ──

vi.mock('@ohb/packages/studio/src/muapi', () => ({
  uploadFile: vi.fn(),
}))

vi.mock('../assetUploadService', () => ({
  uploadPersonalizationAsset: vi.fn(),
}))

vi.mock('@ohb/lib/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock('@ohb/components/SocialPublishProvider', () => ({
  SocialPublishContext: { Provider: ({ children }: any) => children, Consumer: ({ children }: any) => children(null) } as any,
  useSocialPublish: () => {
    throw new Error('useSocialPublish must be used within a <SocialPublishProvider>')
  },
}))

vi.mock('@ohb/lib/authConfig', () => ({
  useAuthConfig: () => ({
    apiKey: 'test-key',
    openaiKey: '',
    setApiKey: vi.fn(),
    setOpenAiKey: vi.fn(),
    clearApiKey: vi.fn(),
    clearOpenAiKey: vi.fn(),
    clearAllKeys: vi.fn(),
    hasApiKey: true,
    hasOpenAiKey: false,
    isAuthenticated: true,
  }),
}))

vi.mock('../promptPersonalizer', () => ({
  personalizePrompt: vi.fn(),
  regeneratePrompt: vi.fn(),
}))

vi.mock('../generationRouter', () => ({
  runGeneration: vi.fn(),
}))

vi.mock('../postProcessor', () => ({
  applyPostProcessing: vi.fn(),
  generateEndCardImage: vi.fn(),
}))

vi.mock('../PersonalizationModal', () => ({
  default: () => null,
}))

vi.mock('../editedAssetPersistence', () => ({
  persistEditedPersonalizationAsset: vi.fn(),
}))

const { DemoPersonalizeProvider, useDemoPersonalize, getGenerationAssetUrl } = await import('../DemoPersonalizeProvider')
const { uploadPersonalizationAsset } = await import('../assetUploadService')
const { stripSessionScopedUrls } = await import('../supabaseProjectPersistence')

// ── The composition under test ────────────────────────────────────────────────
//
// The same stubs the production composition test uses: `@remotion/media`'s
// <Video>/<Audio> are plain markers so a mounted composition can be inspected
// without a media stack, and `remotion`'s frame hooks are deterministic.

vi.mock('@remotion/media', () => ({
  Video: ({ src }: { src: string }) => <div data-testid="media-video" data-src={src} />,
  Audio: ({ src }: { src: string }) => <div data-testid="media-audio" data-src={src} />,
}))

vi.mock('remotion', () => ({
  AbsoluteFill: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Img: ({ src }: { src: string }) => <img src={src} alt="" />,
  Sequence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Internals: {
    SequenceManager: {
      Provider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    },
  },
  useCurrentFrame: () => 30,
  useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
  interpolate: (_i: number, _r: number[], out: number[]) => out[out.length - 1] ?? 1,
  spring: () => 1,
  Easing: { out: () => (t: number) => t, cubic: 0 },
}))

const { PersonalizationComposition } = await import('../preview/PersonalizationComposition')
const { makeInputProps: exportHarnessInputProps } = await import('./_webRendererHarness')

// ── Helpers ──────────────────────────────────────────────────────────────────

function audioFile(name: string, type: string, sizeBytes = 1024): File {
  const file = new File([new Uint8Array(sizeBytes)], name, { type })
  // `size` is derived from the content, so pad when a specific size is needed.
  if (file.size !== sizeBytes) {
    Object.defineProperty(file, 'size', { value: sizeBytes })
  }
  return file
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:http://localhost/audio')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  document.body.querySelectorAll('div').forEach((node) => node.remove())
})

describe('TASK 4 — audio format and size validation', () => {
  it('accepts every supported audio format by extension', () => {
    for (const extension of ['mp3', 'm4a', 'wav', 'ogg', 'aac']) {
      expect(isSupportedAudioFile(audioFile(`track.${extension}`, ''))).toBe(true)
      expect(validateAudioFile(audioFile(`track.${extension}`, ''))).toBeNull()
    }
  })

  it('accepts supported audio when only the MIME type is reported', () => {
    // Some browsers hand the input an empty `type` for audio files, and some
    // report a generic MIME type with a bare name — the MIME type must work.
    expect(supportedAudioFormatOf({ type: 'audio/mpeg' })).toBe('mp3')
    expect(supportedAudioFormatOf({ type: 'audio/mp4' })).toBe('m4a')
    expect(supportedAudioFormatOf({ type: 'audio/x-wav' })).toBe('wav')
    expect(supportedAudioFormatOf({ type: 'audio/ogg' })).toBe('ogg')
    expect(supportedAudioFormatOf({ type: 'audio/aac' })).toBe('aac')
    expect(isSupportedAudioFile(audioFile('voiceover', 'audio/mpeg'))).toBe(true)
  })

  it('rejects non-audio files with an actionable message', () => {
    for (const [name, type] of [
      ['notes.txt', 'text/plain'],
      ['malware.exe', 'application/octet-stream'],
      ['logo.png', 'image/png'],
      ['clip.mp4', 'video/mp4'],
    ] as const) {
      const message = validateAudioFile(audioFile(name, type))
      expect(message).toMatch(/not an audio format/i)
      expect(message).toContain(name)
      expect(message).toMatch(/MP3, M4A, WAV, OGG or AAC/)
      expect(isSupportedAudioFile(audioFile(name, type))).toBe(false)
    }
  })

  it('rejects a file above the size cap and names the limit', () => {
    const tooBig = audioFile('huge.mp3', 'audio/mpeg', AUDIO_MAX_UPLOAD_BYTES + 1)
    const message = validateAudioFile(tooBig)
    expect(message).toMatch(/larger than the limit|the limit is/i)
    expect(message).toContain('25.0 MB')
    expect(isSupportedAudioFile(tooBig)).toBe(false)
  })

  it('reads extensions case-insensitively', () => {
    expect(audioExtensionOf('TRACK.MP3')).toBe('mp3')
    expect(supportedAudioFormatOf(audioFile('Track.WAV', ''))).toBe('wav')
  })
})

describe('TASK 4 — audio persistence is durable-only', () => {
  it('keeps a durable audio URL when normalizing persisted settings', () => {
    const stored = normalizePreviewSettings({
      audio: { url: 'https://cdn.example.com/audio/theme.mp3', name: 'theme.mp3' },
    })
    expect(stored.audio).toEqual({ url: 'https://cdn.example.com/audio/theme.mp3', name: 'theme.mp3' })
  })

  it('refuses to restore a session-scoped blob: audio URL', () => {
    expect(normalizePreviewAudio({ url: 'blob:http://localhost/x', name: 'x.mp3' })).toBeNull()
    expect(normalizePreviewAudio({ url: 'data:audio/mpeg;base64,AAA', name: 'x.mp3' })).toBeNull()
    expect(normalizePreviewAudio(null)).toBeNull()
    expect(normalizePreviewAudio({ url: '' })).toBeNull()
    // The surrounding settings still normalize — audio is never required.
    expect(normalizePreviewSettings({ audio: { url: 'blob:http://localhost/x' } }).audio).toBeNull()
  })

  it('strips a blob: audio URL from a project payload before it is saved', () => {
    const state = stripSessionScopedUrls({
      sourceType: 'landing-demo',
      originalPrompt: '',
      personalizedPrompt: '',
      identityAssetIds: [],
      logoAssetIds: [],
      productAssetIds: [],
      brandReferenceAssetIds: [],
      outputUrls: [],
      outputType: 'prompt',
      previewSettings: {
        ...createDefaultPreviewSettings(),
        audio: { url: 'blob:http://localhost/audio', name: 'track.mp3' },
      },
    })
    expect(state.previewSettings?.audio).toBeNull()
  })

  it('keeps a durable audio URL in a project payload', () => {
    const audio = { url: 'https://cdn.example.com/audio/theme.mp3', name: 'theme.mp3' }
    const state = stripSessionScopedUrls({
      sourceType: 'landing-demo',
      originalPrompt: '',
      personalizedPrompt: '',
      identityAssetIds: [],
      logoAssetIds: [],
      productAssetIds: [],
      brandReferenceAssetIds: [],
      outputUrls: [],
      outputType: 'prompt',
      previewSettings: { ...createDefaultPreviewSettings(), audio },
    })
    expect(state.previewSettings?.audio).toEqual(audio)
  })

  it('ships a durable default (no audio) through the export harness', () => {
    expect(exportHarnessInputProps().audioUrl).toBeNull()
    expect(createDefaultPreviewSettings().audio).toBeNull()
  })
})

describe('TASK 4 — the audio selection reaches the composition', () => {
  const source = {
    id: 'demo-1',
    title: 'Demo',
    mediaType: 'video' as const,
    sourceMedia: '/media/demo.mp4',
    poster: null,
    originalPrompt: 'p',
    fullPrompt: 'p',
    shortPrompt: 'p',
    sourceType: 'landing-demo' as const,
    sourceMetadata: {},
  }

  it('maps the selected track onto the preview input props', () => {
    const settings = createDefaultPreviewSettings({
      audio: { url: 'https://cdn.example.com/audio/theme.mp3', name: 'theme.mp3' },
    })
    const props = buildPreviewInput({
      source,
      previewSettings: settings,
      previewVideo: null,
      clientForm: { businessName: 'Acme Roofing' },
      assets: {
        identities: [],
        primaryIdentity: null,
        logos: [],
        primaryLogo: null,
        products: [],
        brandReferences: [],
        firstFrame: null,
        lastFrame: null,
        ctaGraphic: null,
        audio: [],
        savedReferences: [],
      },
    })
    expect(props.audioUrl).toBe('https://cdn.example.com/audio/theme.mp3')
  })

  it('passes no audio track when the customer did not pick one', () => {
    const props = buildPreviewInput({
      source,
      previewSettings: createDefaultPreviewSettings(),
      previewVideo: null,
      clientForm: {},
      assets: {
        identities: [],
        primaryIdentity: null,
        logos: [],
        primaryLogo: null,
        products: [],
        brandReferences: [],
        firstFrame: null,
        lastFrame: null,
        ctaGraphic: null,
        audio: [],
        savedReferences: [],
      },
    })
    expect(props.audioUrl).toBeNull()
  })

  it('renders <Audio> for the selected track and omits it otherwise', () => {
    const base = exportHarnessInputProps()
    const withAudio = { ...base, audioUrl: 'https://cdn.example.com/audio/theme.mp3' }

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(<PersonalizationComposition {...withAudio} />)
    })

    const audio = container.querySelector('[data-testid="media-audio"]')
    expect(audio).not.toBeNull()
    expect(audio?.getAttribute('data-src')).toBe('https://cdn.example.com/audio/theme.mp3')

    act(() => {
      root.render(<PersonalizationComposition {...base} />)
    })
    expect(container.querySelector('[data-testid="media-audio"]')).toBeNull()

    act(() => root.unmount())
    container.remove()
  })
})

describe('TASK 2 durability — every customer asset reference is durable-only', () => {
  it('never restores a blob: URL as a layer image (logo, product or service image)', () => {
    const stored = normalizePreviewSettings({
      layers: [
        { kind: 'logo', imageUrl: 'blob:http://localhost/logo' },
        { kind: 'productImage', imageUrl: 'https://cdn.example.com/product.png' },
      ],
    })
    const logo = stored.layers.find((layer) => layer.kind === 'logo')
    const product = stored.layers.find((layer) => layer.kind === 'productImage')
    // The dead link is dropped, so the layer simply falls back to its seed.
    expect(logo?.imageUrl).toBeUndefined()
    // A durable reference is kept.
    expect(product?.imageUrl).toBe('https://cdn.example.com/product.png')
  })

  it('strips blob: layer images, outputs and preview videos from a saved payload', () => {
    const state = stripSessionScopedUrls({
      sourceType: 'landing-demo',
      originalPrompt: '',
      personalizedPrompt: '',
      identityAssetIds: [],
      logoAssetIds: [],
      productAssetIds: [],
      brandReferenceAssetIds: [],
      outputUrls: ['blob:http://localhost/video', 'https://cdn.example.com/video.mp4'],
      outputType: 'video',
      previewVideo: { url: 'blob:http://localhost/video', poster: null, title: 't', kind: 'uploaded' },
      previewSettings: {
        ...createDefaultPreviewSettings(),
        layers: [{ ...createDefaultPreviewSettings().layers[0], imageUrl: 'blob:http://localhost/logo' }],
      },
    })
    expect(state.outputUrls).toEqual(['https://cdn.example.com/video.mp4'])
    expect(state.previewVideo).toBeNull()
    expect(state.previewSettings?.layers?.[0]?.imageUrl).toBeUndefined()
  })

  it('refuses a blob: URL as a generation asset (photo, logo, product)', () => {
    const uploading = {
      id: 'a1',
      role: 'logo' as const,
      name: 'logo.png',
      url: 'blob:http://localhost/logo',
      isPrimary: true,
      createdAt: '',
      uploadStatus: 'local' as const,
    }
    expect(getGenerationAssetUrl(uploading)).toBeUndefined()

    const ready = { ...uploading, uploadedUrl: 'https://cdn.example.com/logo.png', uploadStatus: 'ready' as const, url: 'https://cdn.example.com/logo.png' }
    expect(getGenerationAssetUrl(ready)).toBe('https://cdn.example.com/logo.png')
  })
})

describe('TASK 4 — provider wires the upload through the durable asset path', () => {
  function CtxSpy({ onCtx }: { onCtx: (ctx: unknown) => void }) {
    const ctx = useDemoPersonalize()
    onCtx(ctx)
    return null
  }

  const renderProvider = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    let latest: any = null
    const spy = (ctx: unknown) => {
      latest = ctx
      ;(window as any).__audioCtx = ctx
    }
    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <CtxSpy onCtx={spy} />
        </DemoPersonalizeProvider>,
      )
    })
    await act(async () => {
      ;(window as any).__audioCtx.openPersonalize({
        source: {
          id: 'demo-1',
          title: 'Test',
          mediaType: 'video',
          originalPrompt: 'test',
          sourceMedia: '/media/demo.mp4',
          poster: null,
          fullPrompt: 'test',
          shortPrompt: 'test',
          sourceType: 'landing-demo',
          sourceMetadata: {},
        },
      })
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    return { latest: () => (window as any).__audioCtx, container, root }
  }

  it('uploads the selected track and keeps only the durable URL in the preview', async () => {
    const upload = uploadPersonalizationAsset as unknown as { mockResolvedValue: (v: unknown) => void }
    upload.mockResolvedValue({ url: 'https://cdn.example.com/audio/theme.mp3' })

    const ctxHandle = await renderProvider()
    const file = audioFile('theme.mp3', 'audio/mpeg')

    await act(async () => {
      await (window as any).__audioCtx.setPreviewAudio(file)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })

    const ctx = ctxHandle.latest()
    expect(upload).toHaveBeenCalledWith('test-key', { file })
    // The asset lives in the audio section of the library, with the durable URL.
    expect(ctx.assets.audio).toHaveLength(1)
    expect(ctx.assets.audio[0].role).toBe('audio_reference')
    expect(ctx.assets.audio[0].uploadedUrl).toBe('https://cdn.example.com/audio/theme.mp3')
    expect(ctx.assets.audio[0].uploadStatus).toBe('ready')
    // …and the value that gets persisted is the durable one, never the blob.
    expect(ctx.previewSettings.audio).toEqual({
      url: 'https://cdn.example.com/audio/theme.mp3',
      name: 'theme.mp3',
    })
    expect(ctx.previewAudioError).toBeNull()

    // Removing the track clears the preview selection and the library entry.
    await act(async () => {
      ctx.removePreviewAudio()
    })
    expect(ctxHandle.latest().previewSettings.audio).toBeNull()
    expect(ctxHandle.latest().assets.audio).toHaveLength(0)
    void ctxHandle
  })

  it('surfaces an upload failure without dropping the track from the preview', async () => {
    const upload = uploadPersonalizationAsset as unknown as { mockReset: () => void; mockRejectedValue: (v: unknown) => void }
    upload.mockReset()
    upload.mockRejectedValue(new Error('Network error'))

    const ctxHandle = await renderProvider()
    await act(async () => {
      await (window as any).__audioCtx.setPreviewAudio(audioFile('theme.mp3', 'audio/mpeg'))
    })

    const ctx = ctxHandle.latest()
    expect(ctx.previewAudioError).toBe('Network error')
    // The local file keeps playing in the preview while only the save failed.
    expect(ctx.previewSettings.audio?.url.startsWith('blob:')).toBe(true)
    expect(ctx.assets.audio).toHaveLength(1)
    void ctxHandle
  })
})
