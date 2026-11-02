/**
 * Tests for the final-output decision + browser (web-renderer) export contract.
 *
 * These pin the honesty contract of the feature: overlay-only personalizations
 * render locally in the browser, AI modes keep using the generation pipeline,
 * and the render profile is only ever a codec the browser reported it can
 * encode — with an actionable message when it cannot.
 */

import { describe, expect, it } from 'vitest'
import {
  WEB_RENDER_EXTENSION,
  WEB_RENDER_MIME_TYPE,
  chooseFinalOutputPath,
  chooseWebExportProfile,
  preferredWebRenderProfile,
  webRenderOutputName,
  webRenderUnsupportedMessage,
  type WebExportAudioSupport,
  type WebRenderCodecSupport,
} from '../finalOutput'

describe('chooseFinalOutputPath', () => {
  it('routes every AI personalization mode to ai-generation', () => {
    for (const mode of ['face_only', 'full_body', 'recreate', 'complete']) {
      expect(chooseFinalOutputPath({ personalizationMode: mode })).toBe('ai-generation')
    }
  })

  it('routes overlay-only personalizations to branded-render', () => {
    // The guided flow never selects an AI mode: null must render locally.
    expect(chooseFinalOutputPath({ personalizationMode: null })).toBe('branded-render')
    // Non-AI modes (e.g. image identity modes) stay overlay-only.
    for (const mode of ['keep_design', 'replace_face', 'replace_person', 'unknown-mode']) {
      expect(chooseFinalOutputPath({ personalizationMode: mode })).toBe('branded-render')
    }
  })

  it('routes requiresRegeneration to ai-generation regardless of mode', () => {
    expect(chooseFinalOutputPath({ personalizationMode: null, requiresRegeneration: true })).toBe(
      'ai-generation',
    )
    expect(
      chooseFinalOutputPath({ personalizationMode: 'keep_design', requiresRegeneration: true }),
    ).toBe('ai-generation')
  })

  it('treats requiresRegeneration:false as not forcing generation', () => {
    expect(chooseFinalOutputPath({ personalizationMode: null, requiresRegeneration: false })).toBe(
      'branded-render',
    )
  })

  it('is case-sensitive on mode ids (unknown values never reach generation)', () => {
    expect(chooseFinalOutputPath({ personalizationMode: 'COMPLETE' })).toBe('branded-render')
  })
})

describe('preferredWebRenderProfile', () => {
  it('prefers MP4/H.264 whenever the browser can encode it', () => {
    expect(preferredWebRenderProfile({ h264: true, vp9: true, vp8: true })).toEqual({
      container: 'mp4',
      videoCodec: 'h264',
      label: 'MP4 (H.264)',
    })
    expect(preferredWebRenderProfile({ h264: true })).toEqual({
      container: 'mp4',
      videoCodec: 'h264',
      label: 'MP4 (H.264)',
    })
  })

  it('falls back to VP9 when H.264 cannot be encoded', () => {
    expect(preferredWebRenderProfile({ h264: false, vp9: true, vp8: true })).toEqual({
      container: 'webm',
      videoCodec: 'vp9',
      label: 'WebM (VP9)',
    })
  })

  it('falls back to VP8 when only VP8 can be encoded', () => {
    expect(preferredWebRenderProfile({ h264: false, vp9: false, vp8: true })).toEqual({
      container: 'webm',
      videoCodec: 'vp8',
      label: 'WebM (VP8)',
    })
  })

  it('never chooses a codec the browser did not report as supported', () => {
    // Only vp9 reported (h264/vp8 undefined) — not even as `false`.
    expect(preferredWebRenderProfile({ vp9: true })).toEqual({
      container: 'webm',
      videoCodec: 'vp9',
      label: 'WebM (VP9)',
    })
    // Nothing reported: the preferred profile is returned for the caller to
    // reject through the capability check (never used to start a render).
    expect(preferredWebRenderProfile({})).toEqual({
      container: 'mp4',
      videoCodec: 'h264',
      label: 'MP4 (H.264)',
    })
  })

  it('keeps container and codec consistent (mp4 for h264, webm for vp8/vp9)', () => {
    const profiles: WebRenderCodecSupport[] = [
      { h264: true },
      { vp9: true },
      { vp8: true },
      { h264: false, vp9: true, vp8: false },
    ]
    for (const support of profiles) {
      const profile = preferredWebRenderProfile(support)
      const expectedContainer = profile.videoCodec === 'h264' ? 'mp4' : 'webm'
      expect(profile.container).toBe(expectedContainer)
      expect(WEB_RENDER_EXTENSION[profile.container]).toBe(
        profile.container === 'mp4' ? 'mp4' : 'webm',
      )
      expect(WEB_RENDER_MIME_TYPE[profile.container]).toBe(
        profile.container === 'mp4' ? 'video/mp4' : 'video/webm',
      )
    }
  })
})

describe('webRenderUnsupportedMessage', () => {
  it('names the attempted format and offers concrete alternatives', () => {
    const message = webRenderUnsupportedMessage(preferredWebRenderProfile({ h264: true }))
    expect(message).toContain('MP4 (H.264)')
    expect(message).toMatch(/Chrome/)
    expect(message).toMatch(/Firefox/)
    expect(message).toMatch(/WebM\/VP9/)
  })

  it('is still actionable without a profile', () => {
    const message = webRenderUnsupportedMessage()
    expect(message.length).toBeGreaterThan(40)
    expect(message).toMatch(/WebCodecs|encode/i)
  })
})

/** A browser that can encode everything, like a recent desktop Chrome. */
const FULL_SUPPORT = {
  video: { h264: true, vp9: true, vp8: true },
  audio: { mp4: ['aac'], webm: ['opus', 'vorbis'] } as WebExportAudioSupport,
}

/** A browser with no H.264 encoder, like Firefox. */
const NO_H264_SUPPORT = {
  video: { h264: false, vp9: true, vp8: true },
  audio: { mp4: [], webm: ['opus', 'vorbis'] } as WebExportAudioSupport,
}

describe('chooseWebExportProfile', () => {
  it('prefers MP4/H.264 with AAC when everything can be encoded', () => {
    const plan = chooseWebExportProfile(FULL_SUPPORT)
    expect(plan.error).toBeNull()
    expect(plan.profile).toEqual({ container: 'mp4', videoCodec: 'h264', label: 'MP4 (H.264)' })
    expect(plan.audioCodec).toBe('aac')
    expect(plan.muted).toBe(false)
    expect(plan.warning).toBeNull()
  })

  it('moves to WebM/VP9 (with audio) when H.264 cannot be encoded', () => {
    const plan = chooseWebExportProfile(NO_H264_SUPPORT)
    expect(plan.profile).toEqual({ container: 'webm', videoCodec: 'vp9', label: 'WebM (VP9)' })
    expect(plan.audioCodec).toBe('opus')
    expect(plan.muted).toBe(false)
    expect(plan.warning).toBeNull()
  })

  it('prefers a container that can carry audio over a louder one that cannot', () => {
    const plan = chooseWebExportProfile({
      video: { h264: true, vp9: true, vp8: true },
      // H.264 is available but no MP4 audio codec is encodable.
      audio: { mp4: [], webm: ['opus'] },
    })
    expect(plan.profile.videoCodec).toBe('vp9')
    expect(plan.profile.container).toBe('webm')
    expect(plan.audioCodec).toBe('opus')
    expect(plan.muted).toBe(false)
  })

  it('renders muted with a warning when no audio codec can be encoded at all', () => {
    const plan = chooseWebExportProfile({
      video: { h264: true, vp9: false, vp8: false },
      audio: { mp4: [], webm: [] },
    })
    expect(plan.profile.videoCodec).toBe('h264')
    expect(plan.audioCodec).toBeNull()
    expect(plan.muted).toBe(true)
    expect(plan.warning).toMatch(/audio/i)
  })

  it('honours an explicitly requested codec when the browser supports it', () => {
    const plan = chooseWebExportProfile({ ...FULL_SUPPORT, requestedVideoCodec: 'vp8' })
    expect(plan.profile.videoCodec).toBe('vp8')
    expect(plan.profile.container).toBe('webm')
    expect(plan.error).toBeNull()
  })

  it('rejects an unsupported requested codec with the supported alternative named', () => {
    const plan = chooseWebExportProfile({ ...NO_H264_SUPPORT, requestedVideoCodec: 'h264' })
    expect(plan.error).not.toBeNull()
    expect(plan.errorReason).toBe('unsupported-codec')
    expect(plan.error).toContain('MP4 (H.264)')
    expect(plan.error).toContain('WebM (VP9)')
  })

  it('reports the browser as the problem when no video codec can be encoded', () => {
    const plan = chooseWebExportProfile({
      video: { h264: false, vp9: false, vp8: false },
      audio: { mp4: [], webm: [] },
    })
    expect(plan.errorReason).toBe('unsupported-browser')
    expect(plan.error).toMatch(/cannot encode video/i)
    expect(plan.muted).toBe(true)
  })

  it('substitutes an available audio codec when the requested one is not encodable', () => {
    const plan = chooseWebExportProfile({ ...FULL_SUPPORT, requestedAudioCodec: 'vorbis' })
    expect(plan.profile.container).toBe('mp4')
    expect(plan.audioCodec).toBe('aac')
    expect(plan.warning).toContain('vorbis')
    expect(plan.error).toBeNull()
  })
})

describe('webRenderOutputName', () => {
  it('produces a bare filename with the container extension', () => {
    const name = webRenderOutputName('mp4')
    expect(name).toMatch(/^personalized-[a-z0-9]+\.mp4$/)
    expect(webRenderOutputName('webm')).toMatch(/\.webm$/)
  })

  it('sanitizes a hostile extension', () => {
    expect(webRenderOutputName('../../etc/passwd')).toMatch(/^personalized-[a-z0-9]+\.etcpassw$/)
    expect(webRenderOutputName('')).toMatch(/\.mp4$/)
  })
})
