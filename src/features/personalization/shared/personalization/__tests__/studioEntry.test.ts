/**
 * Shared studio → Personalization Modal entry point.
 *
 * The regression this file guards: `openPersonalize` SILENTLY no-ops when
 * `normalizePersonalizationSource` rejects the source, so a studio hand-off
 * that is missing `sourceType` or `originalPrompt` looks like a dead button
 * with no error anywhere. The source built here is therefore asserted against
 * the REAL normalizer, not against a copy of its rules.
 */

import { describe, expect, it } from 'vitest'

import { normalizePersonalizationSource } from '../sourceNormalizer'
import {
  assertStudioPersonalizeOptions,
  buildStudioPersonalizeSource,
  fingerprint,
  type StudioPersonalizeOptions,
} from '../studioEntry'

function videoOptions(overrides: Partial<StudioPersonalizeOptions> = {}): StudioPersonalizeOptions {
  return {
    originStudio: 'video',
    studioProjectId: 'clip.mp4:seedance:16:9:5',
    title: 'Video Studio clip',
    media: {
      mediaType: 'video',
      url: 'https://cdn.example.test/clip.mp4',
      aspectRatio: '9:16',
      duration: 8,
      durationLabel: '8s',
    },
    prompt: {
      text: 'A neon-lit street at night',
      model: 'seedance',
      modelName: 'Seedance',
    },
    ...overrides,
  }
}

describe('buildStudioPersonalizeSource', () => {
  it('produces a source the real normalizer accepts', () => {
    const source = buildStudioPersonalizeSource(videoOptions())

    // The non-null assertion is the point of the test: a null here means the
    // modal would silently never open.
    const normalized = normalizePersonalizationSource(source)
    expect(normalized).not.toBeNull()
    expect(normalized).toBe(source)
    expect(normalized!.sourceType).toBe('studio-project')
    expect(normalized!.originalPrompt).toBe('A neon-lit street at night')
  })

  it('is accepted even with an empty prompt', () => {
    // `originalPrompt` is present (empty string) — the normalizer checks for
    // the KEY's presence, not for a non-empty value.
    const source = buildStudioPersonalizeSource(
      videoOptions({ prompt: { text: '' } }),
    )
    expect(normalizePersonalizationSource(source)).not.toBeNull()
  })

  it('maps media type, source media, aspect ratio and duration through', () => {
    const source = buildStudioPersonalizeSource(videoOptions())

    expect(source.mediaType).toBe('video')
    expect(source.sourceMedia).toBe('https://cdn.example.test/clip.mp4')
    expect(source.aspectRatio).toBe('9:16')
    expect(source.duration).toBe(8)
    expect(source.durationLabel).toBe('8s')
    expect(source.poster).toBeNull()
  })

  it('maps an image hand-off as an image source', () => {
    const source = buildStudioPersonalizeSource(
      videoOptions({
        originStudio: 'image',
        media: { mediaType: 'image', url: 'https://cdn.example.test/frame.png' },
      }),
    )

    expect(source.mediaType).toBe('image')
    expect(source.sourceMedia).toBe('https://cdn.example.test/frame.png')
    expect(normalizePersonalizationSource(source)).not.toBeNull()
  })

  it('defaults an image hand-off poster to the image itself, so the composition can draw it', () => {
    const image = buildStudioPersonalizeSource(
      videoOptions({
        originStudio: 'image',
        media: { mediaType: 'image', url: 'https://cdn.example.test/frame.png' },
      }),
    )
    expect(image.poster).toBe('https://cdn.example.test/frame.png')

    // An explicit poster still wins, and a video without one stays null.
    const withPoster = buildStudioPersonalizeSource(
      videoOptions({
        originStudio: 'image',
        media: { mediaType: 'image', url: 'https://cdn.example.test/frame.png', poster: 'https://cdn.example.test/thumb.png' },
      }),
    )
    expect(withPoster.poster).toBe('https://cdn.example.test/thumb.png')
    expect(buildStudioPersonalizeSource(videoOptions()).poster ?? null).toBeNull()
  })

  it('maps the prompt and model context through', () => {
    const source = buildStudioPersonalizeSource(videoOptions())

    expect(source.shortPrompt).toBe('A neon-lit street at night')
    expect(source.fullPrompt).toBe('A neon-lit street at night')
    expect(source.originalPrompt).toBe('A neon-lit street at night')
    expect(source.model).toBe('seedance')
    expect(source.modelName).toBe('Seedance')
    expect(source.title).toBe('Video Studio clip')
  })

  it('records the origin studio in sourceMetadata', () => {
    const source = buildStudioPersonalizeSource(
      videoOptions({ originStudio: 'clipping', studioProjectId: 'abc' }),
    )

    expect(source.sourceMetadata.originStudio).toBe('clipping')
    expect(source.sourceMetadata.studioProjectId).toBe('abc')
  })

  it('records the return destination and payload in sourceMetadata', () => {
    const source = buildStudioPersonalizeSource(
      videoOptions({
        returnTo: 'video',
        returnPayload: { clipId: 'c-1' },
        remotionTemplateId: 'neon',
      }),
    )

    expect(source.sourceMetadata.returnTo).toBe('video')
    expect(source.sourceMetadata.returnPayload).toEqual({ clipId: 'c-1' })
    expect(source.sourceMetadata.remotionTemplateId).toBe('neon')
  })

  it('produces a unique id per studio project id', () => {
    const a = buildStudioPersonalizeSource(videoOptions({ studioProjectId: 'project-a' }))
    const b = buildStudioPersonalizeSource(videoOptions({ studioProjectId: 'project-b' }))

    expect(a.id).not.toBe(b.id)
    expect(a.id).toBe(`video:project-a#${fingerprint('https://cdn.example.test/clip.mp4')}`)
    expect(b.id).toBe(`video:project-b#${fingerprint('https://cdn.example.test/clip.mp4')}`)
  })

  it('produces a unique id per origin studio', () => {
    const video = buildStudioPersonalizeSource(
      videoOptions({ originStudio: 'video', studioProjectId: 'shared-key' }),
    )
    const image = buildStudioPersonalizeSource(
      videoOptions({ originStudio: 'image', studioProjectId: 'shared-key' }),
    )

    expect(video.id).not.toBe(image.id)
    expect(video.id.startsWith('video:shared-key#')).toBe(true)
    expect(image.id.startsWith('image:shared-key#')).toBe(true)
  })

  it('separates two uploads that share a studio key, and keeps one upload stable', () => {
    const first = buildStudioPersonalizeSource(
      videoOptions({ studioProjectId: 'clip.mp4:seedance', media: { mediaType: 'video', url: 'https://cdn.example.test/u/1/clip.mp4' } }),
    )
    const second = buildStudioPersonalizeSource(
      videoOptions({ studioProjectId: 'clip.mp4:seedance', media: { mediaType: 'video', url: 'https://cdn.example.test/u/2/clip.mp4' } }),
    )
    const again = buildStudioPersonalizeSource(
      videoOptions({ studioProjectId: 'clip.mp4:seedance', media: { mediaType: 'video', url: 'https://cdn.example.test/u/1/clip.mp4' } }),
    )
    expect(first.id).not.toBe(second.id)
    expect(again.id).toBe(first.id)
    expect(fingerprint('abc')).toMatch(/^[0-9a-f]{8}$/)
  })

  it('falls back to the media url when no studio project id is given', () => {
    const source = buildStudioPersonalizeSource(
      videoOptions({ studioProjectId: undefined }),
    )

    expect(source.id).toBe('video:https://cdn.example.test/clip.mp4')
  })
})

describe('assertStudioPersonalizeOptions', () => {
  it('rejects a missing origin studio', () => {
    const options = videoOptions()
    delete (options as { originStudio?: string }).originStudio

    expect(() => assertStudioPersonalizeOptions(options)).toThrow(TypeError)
    expect(() => buildStudioPersonalizeSource(options)).toThrow(
      /originStudio is required/,
    )
  })

  it('rejects a blank origin studio', () => {
    expect(() =>
      assertStudioPersonalizeOptions(videoOptions({ originStudio: '   ' as never })),
    ).toThrow(/originStudio is required/)
  })

  it('rejects a missing media url', () => {
    const options = videoOptions()
    options.media.url = null

    expect(() => assertStudioPersonalizeOptions(options)).toThrow(TypeError)
    expect(() => buildStudioPersonalizeSource(options)).toThrow(/media.url is required/)
  })

  it('rejects a blank media url', () => {
    const options = videoOptions()
    options.media.url = '   '

    expect(() => assertStudioPersonalizeOptions(options)).toThrow(/media.url is required/)
  })

  it('accepts a complete hand-off', () => {
    expect(() => assertStudioPersonalizeOptions(videoOptions())).not.toThrow()
  })
})
