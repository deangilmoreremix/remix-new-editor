import { describe, expect, it } from 'vitest'
import { MINIMAX_H3_DEMOS } from '@ohb/data/minimaxH3Demos'
import { SEEDANCE_25_DEMOS } from '@ohb/data/seedance25Demos'
import type { VideoDemo } from '@ohb/data/types'
import type { PromptRecord } from '@ohb/types/go-ai-viral/prompt'
import type { SeedancePrompt } from '@ohb/types/go-ai-viral/seedance'
import {
  MEDIA_PENDING_KEY,
  buildDemoPersonalizeSource,
  buildFreeDiscoverySource,
  buildViralPersonalizeSource,
  buildViralPromptSource,
  buildViralVideoSource,
  isMediaPending,
} from '../demoSources'

function findDemo(library: VideoDemo[], slug: string): VideoDemo {
  const demo = library.find((entry) => entry.slug === slug)
  if (!demo) throw new Error(`fixture demo missing from library: ${slug}`)
  return demo
}

/** Seedance record in the shape the /api/go-ai-viral/seedance route returns it. */
function seedanceFixture(): SeedancePrompt {
  return {
    slug: 'elegant-girl-drying-and-shaking-clothes',
    prompt: 'The girl was drying her clothes elegantly.',
    fullPrompt: 'The girl was drying her clothes elegantly after the rain.',
    sourceLanguage: 'en',
    detailHref: 'https://www.seedance2prompt.com/prompts/elegant-girl-drying-and-shaking-clothes',
    outputUrl: 'https://cdn.seedance2prompt.com/outputs/case-001.mp4',
    categories: ['commercial', 'Commercial'],
    tags: ['commercial'],
    recommendedModel: 'seedance',
    sourceModels: ['seedance'],
    language: 'en',
    thumbnail: 'https://cdn.seedance2prompt.com/seedance-featured/reference-images/case-001_ref-laundry-elegant-shake.png',
    author: null,
    publishedAt: null,
    engagement: { likes: 6654, reposts: 1307, replies: 152 },
    media: [
      {
        type: 'image',
        role: 'preview',
        previewUrl: 'https://cdn.seedance2prompt.com/seedance-featured/reference-images/case-001_ref-laundry-elegant-shake.png',
        sourceUrl: 'https://cdn.seedance2prompt.com/seedance-featured/reference-images/case-001_ref-laundry-elegant-shake.png',
        posterUrl: 'https://cdn.seedance2prompt.com/seedance-featured/reference-images/case-001_ref-laundry-elegant-shake.png',
      },
      {
        type: 'video',
        role: 'result',
        previewUrl: 'https://cdn.seedance2prompt.com/seedance-featured/reference-images/case-001_ref-laundry-elegant-shake.png',
        sourceUrl: 'https://cdn.seedance2prompt.com/outputs/case-001.mp4',
        posterUrl: 'https://cdn.seedance2prompt.com/seedance-featured/reference-images/case-001_ref-laundry-elegant-shake.png',
      },
    ],
  }
}

/** Prompt-feed record in the shape the /api/go-ai-viral/prompts feed returns. */
function promptRecordFixture(): PromptRecord {
  return {
    id: 'prompt-record-001',
    slug: 'prompt-record-001',
    imglumeId: 1,
    revision: '1',
    title: 'Golden hour product hero',
    prompt: 'A perfume bottle in golden hour light.',
    mediaType: 'video',
    recommendedModel: 'seedance',
    sourceModels: ['seedance'],
    categories: ['product-ads'],
    tags: ['product'],
    language: 'en',
    recommended: { quality: 'hd', aspectRatio: '9:16', durationSeconds: 10, generateAudio: null },
    source: {
      platform: 'x',
      postId: '1',
      url: 'https://x.com/example/status/1',
      author: { handle: 'example', name: 'Example' },
      publishedAt: null,
      discoveredAt: '2026-01-01T00:00:00.000Z',
      engagement: { likes: 10, reposts: 2, replies: 1 },
      attribution: 'example',
      license: 'CC-BY-4.0',
      rightsHolder: 'example',
    },
    media: [
      {
        type: 'image',
        role: 'preview',
        previewUrl: 'https://cdn.example.com/prompt-record-001.jpg',
        posterUrl: 'https://cdn.example.com/prompt-record-001.jpg',
        sourceUrl: 'https://cdn.example.com/prompt-record-001.jpg',
        altText: 'poster',
        width: 1080,
        height: 1920,
        license: 'CC-BY-4.0',
        rightsHolder: 'example',
      },
      {
        type: 'video',
        role: 'result',
        previewUrl: 'https://cdn.example.com/prompt-record-001.jpg',
        posterUrl: 'https://cdn.example.com/prompt-record-001.jpg',
        sourceUrl: 'https://cdn.example.com/prompt-record-001.mp4',
        altText: 'result video',
        width: 1080,
        height: 1920,
        license: 'CC-BY-4.0',
        rightsHolder: 'example',
      },
    ],
    curation: {
      creator: 'ImgLume',
      url: 'https://imglume.example',
      recordUrl: 'https://imglume.example/1',
      license: 'CC-BY-4.0',
      contributions: [],
    },
    provenance: {
      discoveredBy: 'ByRadar',
      collection: 'feed',
      importedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  }
}

describe('buildDemoPersonalizeSource', () => {
  it('preserves the minimax demo video, poster, aspect ratio, duration, model, id and prompt', () => {
    const demo = findDemo(MINIMAX_H3_DEMOS, 'modern-warfare-fps-gameplay')
    const source = buildDemoPersonalizeSource(demo)

    expect(source.id).toBe(demo.slug)
    expect(source.sourceMedia).toBe(demo.videoSrc)
    expect(source.sourceMedia).toBe('/media/minimax-h3/videos/modern-warfare-fps-gameplay.webm')
    expect(source.poster).toBe(demo.posterSrc)
    expect(source.aspectRatio).toBe(demo.aspectRatio)
    expect(source.aspectRatio).toBe('16:9')
    expect(source.duration).toBe(demo.duration)
    expect(source.duration).toBe(15)
    expect(source.durationLabel).toBe(demo.durationLabel)
    expect(source.model).toBe(demo.model)
    expect(source.model).toBe('minimax-image-01')
    expect(source.modelName).toBe(demo.modelName)
    expect(source.originalPrompt).toBe(demo.prompt)
    expect(source.fullPrompt).toBe(demo.prompt)
    expect(source.shortPrompt).toBe(demo.prompt)
    expect(source.category).toBe(demo.category)
    expect(source.sourceUrl).toBe(demo.sourceUrl)
    expect(source.mediaType).toBe('video')
    expect(source.sourceType).toBe('landing-demo')
    expect(source.sourceMetadata.slug).toBe(demo.slug)
    expect(source.sourceMetadata.sourceRepo).toBe(demo.sourceRepo)
    expect(isMediaPending(source)).toBe(false)
  })

  it('preserves the seedance demo video, poster, aspect ratio, duration, model, id and prompt', () => {
    const demo = findDemo(SEEDANCE_25_DEMOS, 'i-ve-spent-a-lot-of-time-with-over-the-past-428749')
    const source = buildDemoPersonalizeSource(demo)

    expect(source.id).toBe(demo.slug)
    expect(source.sourceMedia).toBe(demo.videoSrc)
    expect(source.sourceMedia).toBe('/media/seedance-25/videos/video-3f856d6f703053cd.webm')
    expect(source.poster).toBe(demo.posterSrc)
    expect(source.aspectRatio).toBe(demo.aspectRatio)
    expect(source.duration).toBe(demo.duration)
    expect(source.duration).toBe(88)
    expect(source.durationLabel).toBe(demo.durationLabel)
    expect(source.model).toBe(demo.model)
    expect(source.model).toBe('seedance-v2.0-t2v')
    expect(source.originalPrompt).toBe(demo.prompt)
    expect(source.fullPrompt).toBe(demo.prompt)
    expect(isMediaPending(source)).toBe(false)
  })

  it('uses the demo aspect ratio instead of defaulting to 16:9', () => {
    const demo = findDemo(SEEDANCE_25_DEMOS, 'i-made-this-full-video-in-5-minutes-100-automated-857085')
    const source = buildDemoPersonalizeSource(demo)

    expect(demo.aspectRatio).toBe('9:16')
    expect(source.aspectRatio).toBe('9:16')
  })

  it('maps a demo with no videoSrc to a null source plus the mediaPending flag, never to another demo', () => {
    const demo = findDemo(MINIMAX_H3_DEMOS, 'modern-warfare-fps-gameplay')
    const pendingDemo: VideoDemo = { ...demo, videoSrc: '' }
    const source = buildDemoPersonalizeSource(pendingDemo)

    expect(source.sourceMedia).toBeNull()
    expect(source.sourceMetadata[MEDIA_PENDING_KEY]).toBe(true)
    expect(isMediaPending(source)).toBe(true)
    // No substitution: the source is still this demo, with this demo's own fields.
    expect(source.id).toBe(pendingDemo.slug)
    expect(source.title).toBe(demo.title)
    expect(source.poster).toBe(demo.posterSrc)
    expect(source.aspectRatio).toBe(demo.aspectRatio)
    expect(source.originalPrompt).toBe(demo.prompt)
    // The poster is still available, so only the playable media is missing.
    expect(source.poster).not.toBeNull()
  })

  it('flags a pending video demo even when the video path is only whitespace', () => {
    const demo = findDemo(MINIMAX_H3_DEMOS, 'modern-warfare-fps-gameplay')
    const source = buildDemoPersonalizeSource({ ...demo, videoSrc: '   ' })

    expect(source.sourceMedia).toBeNull()
    expect(source.sourceMetadata[MEDIA_PENDING_KEY]).toBe(true)
  })
})

describe('buildViralVideoSource', () => {
  it('passes the seedance record video URL through untouched', () => {
    const record = seedanceFixture()
    const source = buildViralVideoSource(record)

    expect(source.id).toBe(record.slug)
    expect(source.sourceType).toBe('go-ai-viral-video')
    expect(source.mediaType).toBe('video')
    expect(source.sourceMedia).toBe('https://cdn.seedance2prompt.com/outputs/case-001.mp4')
    expect(source.sourceMedia).toBe(record.outputUrl)
    expect(source.poster).toBe(record.thumbnail)
    expect(source.shortPrompt).toBe(record.prompt)
    expect(source.fullPrompt).toBe(record.fullPrompt)
    expect(source.originalPrompt).toBe(record.fullPrompt)
    expect(source.model).toBe(record.recommendedModel)
    expect(source.category).toBe(record.categories?.[0])
    expect(source.sourceUrl).toBe(record.detailHref)
    expect(isMediaPending(source)).toBe(false)
  })

  it('does not invent a duration or aspect ratio the record does not declare', () => {
    const source = buildViralVideoSource(seedanceFixture())

    expect(source.duration).toBeUndefined()
    expect(source.durationLabel).toBeUndefined()
    expect(source.aspectRatio).toBeUndefined()
  })

  it('maps a seedance record with no video to a null source plus mediaPending', () => {
    const record = { ...seedanceFixture(), outputUrl: null, media: [] }
    const source = buildViralVideoSource(record)

    expect(source.sourceMedia).toBeNull()
    expect(source.sourceMetadata[MEDIA_PENDING_KEY]).toBe(true)
    expect(isMediaPending(source)).toBe(true)
    expect(source.id).toBe(record.slug)
  })
})

describe('buildViralPromptSource', () => {
  it('passes a video prompt record real video URL through untouched', () => {
    const record = promptRecordFixture()
    const source = buildViralPromptSource(record)

    expect(source.id).toBe(record.id)
    expect(source.sourceType).toBe('go-ai-viral-prompt')
    expect(source.mediaType).toBe('video')
    expect(source.sourceMedia).toBe('https://cdn.example.com/prompt-record-001.mp4')
    expect(source.poster).toBe('https://cdn.example.com/prompt-record-001.jpg')
    expect(source.model).toBe(record.recommendedModel)
    expect(source.aspectRatio).toBe(record.recommended.aspectRatio)
    expect(source.duration).toBe(record.recommended.durationSeconds)
    expect(source.durationLabel).toBe('10s')
    expect(source.originalPrompt).toBe(record.prompt)
    expect(source.sourceUrl).toBe(record.source.url)
    expect(isMediaPending(source)).toBe(false)
  })

  it('keeps an image record on its own image URL and never borrows a video URL', () => {
    const record = { ...promptRecordFixture(), mediaType: 'image' as const }
    const source = buildViralPromptSource(record)

    expect(source.mediaType).toBe('image')
    expect(source.sourceMedia).toBe('https://cdn.example.com/prompt-record-001.jpg')
    expect(source.sourceMedia).not.toContain('.mp4')
    expect(source.poster).toBe('https://cdn.example.com/prompt-record-001.jpg')
  })

  it('leaves aspect ratio and duration undefined when the record declares none', () => {
    const record = {
      ...promptRecordFixture(),
      recommended: { quality: null, aspectRatio: null, durationSeconds: null, generateAudio: null },
    }
    const source = buildViralPromptSource(record)

    expect(source.aspectRatio).toBeUndefined()
    expect(source.duration).toBeUndefined()
    expect(source.durationLabel).toBeUndefined()
  })
})

describe('buildViralPersonalizeSource', () => {
  it('dispatches a seedance record to the video mapping', () => {
    const record = seedanceFixture()
    const source = buildViralPersonalizeSource(record)

    expect(source.sourceType).toBe('go-ai-viral-video')
    expect(source.sourceMedia).toBe(record.outputUrl)
  })

  it('dispatches a prompt-feed record to the prompt mapping', () => {
    const record = promptRecordFixture()
    const source = buildViralPersonalizeSource(record)

    expect(source.sourceType).toBe('go-ai-viral-prompt')
    expect(source.sourceMedia).toBe('https://cdn.example.com/prompt-record-001.mp4')
  })
})

describe('buildFreeDiscoverySource', () => {
  it('stays prompt-only with no media and no mediaPending flag', () => {
    const source = buildFreeDiscoverySource()

    expect(source.id).toBe('free-discovery')
    expect(source.mediaType).toBe('prompt-only')
    expect(source.sourceMedia).toBeNull()
    expect(source.poster).toBeNull()
    expect(source.sourceType).toBe('landing-demo')
    expect(source.sourceMetadata.freeDiscovery).toBe(true)
    expect(source.sourceMetadata[MEDIA_PENDING_KEY]).toBeUndefined()
    expect(isMediaPending(source)).toBe(false)
    expect(source.originalPrompt).toContain('Find My Brand')
  })
})
