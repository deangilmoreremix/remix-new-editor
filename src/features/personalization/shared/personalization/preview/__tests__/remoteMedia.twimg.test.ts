import { describe, expect, it } from 'vitest'
import { REMOTE_MEDIA_PROXY_PATH, remoteMediaRefererFor, toPlayablePreviewMediaUrl } from '../remoteMedia'

const TWIMG = 'https://video.twimg.com/amplify_video/1/vid/avc1/1920x1080/a.mp4?tag=29'

describe('remote media proxy: video.twimg.com', () => {
  it('routes X videos through the same-origin proxy (the host refuses browser fetches from other sites)', () => {
    expect(toPlayablePreviewMediaUrl(TWIMG)).toBe(`${REMOTE_MEDIA_PROXY_PATH}?url=${encodeURIComponent(TWIMG)}`)
  })

  it('does not proxy plaintext, lookalike or credentialed twimg URLs', () => {
    for (const url of ['http://video.twimg.com/a.mp4', 'https://video.twimg.com.evil.com/a.mp4', 'https://pbs.twimg.com/a.mp4', 'https://u:p@video.twimg.com/a.mp4']) {
      expect(toPlayablePreviewMediaUrl(url)).toBe(url)
    }
  })

  it('sends the x.com Referer for twimg only', () => {
    expect(remoteMediaRefererFor('video.twimg.com')).toBe('https://x.com/')
    expect(remoteMediaRefererFor('VIDEO.TWIMG.COM')).toBe('https://x.com/')
    expect(remoteMediaRefererFor('cdn.seedance2prompt.com')).toBeUndefined()
    expect(remoteMediaRefererFor('cdn.muapi.ai')).toBeUndefined()
  })
})
