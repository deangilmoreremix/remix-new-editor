import { describe, expect, it } from 'vitest'
import {
  REMOTE_MEDIA_PROXY_PATH,
  isProxiableRemoteMediaHost,
  parseProxiableRemoteMediaUrl,
  toPlayablePreviewMediaUrl,
} from '../remoteMedia'

describe('remote media proxy allow-list: MuAPI output hosts', () => {
  it('routes MuAPI-generated media through the same-origin proxy', () => {
    for (const url of [
      'https://cdn.muapi.ai/outputs/clip.mp4',
      'https://d3adwkbyhxyrtq.cloudfront.net/outputs/narration.mp3',
    ]) {
      expect(isProxiableRemoteMediaHost(new URL(url).hostname)).toBe(true)
      expect(toPlayablePreviewMediaUrl(url)).toBe(`${REMOTE_MEDIA_PROXY_PATH}?url=${encodeURIComponent(url)}`)
    }
  })

  it('stays an exact-host allow-list: lookalikes, other hosts, http and credentials are not proxied', () => {
    for (const url of [
      'https://evil-cdn.muapi.ai.attacker.com/x.mp4',
      'https://api.muapi.ai/x.mp4',
      'https://muapi.ai/x.mp4',
      'http://cdn.muapi.ai/x.mp4',
      'https://user:pw@cdn.muapi.ai/x.mp4',
      'https://example.com/x.mp4',
    ]) {
      expect(parseProxiableRemoteMediaUrl(url)).toBeNull()
      expect(toPlayablePreviewMediaUrl(url)).toBe(url)
    }
  })

  it('leaves same-origin template paths and blob URLs untouched', () => {
    expect(toPlayablePreviewMediaUrl('/zackd/templates/swallow-gum/clips/beat_1_a.mp4')).toBe('/zackd/templates/swallow-gum/clips/beat_1_a.mp4')
    expect(toPlayablePreviewMediaUrl('blob:http://localhost/abc')).toBe('blob:http://localhost/abc')
  })
})
