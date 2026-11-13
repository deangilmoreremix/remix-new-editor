// @vitest-environment jsdom
/**
 * A history entry saved without its on-video layers (the layered video could
 * not be stored) says so, so a reopened entry isn't mistaken for the final.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { getSharedMedia, registerSharedMedia } from '../sharedMedia'

afterEach(() => localStorage.clear())

describe('registerSharedMedia layersMissing', () => {
  it('keeps the flag when the layers are missing', () => {
    registerSharedMedia({ outputUrls: ['https://cdn.example/clip.mp4'], outputType: 'video', layersMissing: true })
    expect(getSharedMedia().at(-1)?.layersMissing).toBe(true)
  })
  it('leaves it off for a normal entry', () => {
    registerSharedMedia({ outputUrls: ['https://cdn.example/final.mp4'], outputType: 'video' })
    expect(getSharedMedia().at(-1)?.layersMissing).toBeUndefined()
  })
})
