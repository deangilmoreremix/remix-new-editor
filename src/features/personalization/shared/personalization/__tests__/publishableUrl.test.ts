/**
 * Publish must never hand a browser-only blob: URL to the publishing service.
 */
import { describe, expect, it } from 'vitest'
import { projectOutputUrl, publishableUrl, studioVideoUrl } from '../DemoPersonalizeProvider'

describe('publishableUrl', () => {
  it('uses the stored layered video when layers were burned in', () => {
    expect(publishableUrl({ type: 'video', url: 'blob:http://x/1', metadata: { publishUrl: 'https://cdn.example/layered.mp4' } } as any))
      .toBe('https://cdn.example/layered.mp4')
  })
  it('offers nothing when the layered upload failed', () => {
    expect(publishableUrl({ type: 'video', url: 'blob:http://x/1', metadata: { publishUrl: '' } } as any)).toBe('')
  })
  it('offers nothing for a branded render that only exists in this browser', () => {
    expect(publishableUrl({ type: 'video', url: 'blob:http://x/2', metadata: { source: 'branded-render' } } as any)).toBe('')
  })
  it('keeps a plain http(s) result URL', () => {
    expect(publishableUrl({ type: 'video', url: 'https://cdn.example/out.mp4', metadata: {} } as any)).toBe('https://cdn.example/out.mp4')
  })
  it('handles no result', () => {
    expect(publishableUrl(null)).toBe('')
  })
})

describe('studioVideoUrl', () => {
  it('hands the stored layered video to Video Studio', () => {
    expect(studioVideoUrl({ type: 'video', url: 'blob:http://x/1', metadata: { publishUrl: 'https://cdn.example/layered.mp4' } } as any))
      .toBe('https://cdn.example/layered.mp4')
  })
  it('has nothing to hand over when only a blob exists', () => {
    expect(studioVideoUrl({ type: 'video', url: 'blob:http://x/1', metadata: { publishUrl: '' } } as any)).toBe('')
  })
  it('keeps a plain result URL', () => {
    expect(studioVideoUrl({ type: 'video', url: 'https://cdn.example/out.mp4', metadata: {} } as any)).toBe('https://cdn.example/out.mp4')
  })
})

describe('projectOutputUrl', () => {
  it('saves the stored copy when the result plays from a blob', () => {
    expect(projectOutputUrl({ type: 'video', url: 'blob:http://x/1', metadata: { storedUrl: 'https://cdn.example/layered.mp4' } } as any))
      .toBe('https://cdn.example/layered.mp4')
  })
  it('saves a normal result URL as is', () => {
    expect(projectOutputUrl({ type: 'video', url: 'https://cdn.example/out.mp4', metadata: {} } as any)).toBe('https://cdn.example/out.mp4')
  })
  it('saves nothing when only a blob exists', () => {
    expect(projectOutputUrl({ type: 'video', url: 'blob:http://x/1', metadata: {} } as any)).toBe('')
  })
})

