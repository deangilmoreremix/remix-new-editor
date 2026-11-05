/**
 * Final output decision logic + browser (web-renderer) export contract for the
 * SmartVideo GO personalization flow.
 *
 * The personalization modal offers two fundamentally different ways to finish
 * a personalization, and they must never be conflated:
 *
 *   1. `branded-render` — the customer approved overlays (logo, text, CTA,
 *      images, end card) on the EXISTING selected video. Nothing about the
 *      underlying footage changes, so the export is a LOCAL, in-browser
 *      Remotion render of the same `PersonalizationComposition` the free
 *      preview uses (see `./webExport.ts`). No paid generation request is ever
 *      created for this.
 *   2. `ai-generation` — the personalization genuinely needs AI-generated
 *      imagery/video (an AI mode such as face_only / full_body / recreate /
 *      complete, or any regenerated asset). This continues through the
 *      EXISTING generate() flow untouched.
 *
 * This module is pure (no React, no network, no DOM) so both the client
 * provider and the browser export engine share the exact same decision and
 * codec-selection logic, and so it can be unit-tested in jsdom.
 */

/** The two — and only two — ways a final video can be produced. */
export type FinalOutputPath = 'branded-render' | 'ai-generation'

/**
 * Personalization modes that require AI-generated imagery/video. These always
 * go through the existing generation pipeline; an overlay render cannot produce
 * them.
 */
const AI_GENERATION_MODES: ReadonlySet<string> = new Set([
  'face_only',
  'full_body',
  'recreate',
  'complete',
])

/**
 * Choose how the final video must be produced.
 *
 * An AI mode (or an explicitly regenerated asset) can only be satisfied by
 * the existing generation pipeline. Everything else — branding overlays on the
 * existing selected video, including a null mode such as the guided flow uses —
 * is a local, in-browser render.
 */
export function chooseFinalOutputPath(input: {
  personalizationMode: string | null
  requiresRegeneration?: boolean
}): FinalOutputPath {
  if (input.requiresRegeneration === true) return 'ai-generation'
  const mode = input.personalizationMode
  if (typeof mode === 'string' && AI_GENERATION_MODES.has(mode)) {
    return 'ai-generation'
  }
  return 'branded-render'
}

/** The composition id the browser export renders. */
export const PERSONALIZATION_COMPOSITION_ID = 'PersonalizationComposition'

/** Video codecs the browser export engine can ask the renderer for. */
export type WebRenderVideoCodec = 'h264' | 'vp9' | 'vp8'

/** Container the chosen codec is written into. */
export type WebRenderContainer = 'mp4' | 'webm'

/** What the browser reported it can encode. */
export interface WebRenderCodecSupport {
  h264?: boolean
  vp9?: boolean
  vp8?: boolean
}

/** The concrete render profile the export engine will use. */
export interface WebRenderProfile {
  container: WebRenderContainer
  videoCodec: WebRenderVideoCodec
  /** Human-readable name of the output, e.g. 'MP4 (H.264)'. */
  label: string
}

/** Preference order: best compatibility/quality first, VP8 last. */
const CODEC_PREFERENCE: WebRenderVideoCodec[] = ['h264', 'vp9', 'vp8']

/** File extension for each container. */
export const WEB_RENDER_EXTENSION: Record<WebRenderContainer, string> = {
  mp4: 'mp4',
  webm: 'webm',
}

/** MIME type for each container. */
export const WEB_RENDER_MIME_TYPE: Record<WebRenderContainer, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
}

/** Human label for each supported video codec. */
const CODEC_LABEL: Record<WebRenderVideoCodec, string> = {
  h264: 'MP4 (H.264)',
  vp9: 'WebM (VP9)',
  vp8: 'WebM (VP8)',
}

/**
 * Pick the render profile this browser can actually encode.
 *
 * MP4/H.264 is preferred because it is the universally playable format; VP9 and
 * then VP8 (both WebM) are the fallbacks for browsers that cannot encode H.264
 * (notably Firefox without the proprietary codec). A codec the browser has not
 * reported as supported is never chosen.
 */
export function preferredWebRenderProfile(
  supported: WebRenderCodecSupport,
): WebRenderProfile {
  for (const codec of CODEC_PREFERENCE) {
    if (supported[codec] === true) {
      return {
        container: codec === 'h264' ? 'mp4' : 'webm',
        videoCodec: codec,
        label: CODEC_LABEL[codec],
      }
    }
  }
  // Nothing is supported: report the preferred profile anyway. The caller is
  // expected to check `canRenderMediaOnWeb()` first and surface
  // `webRenderUnsupportedMessage()` instead of rendering.
  return { container: 'mp4', videoCodec: 'h264', label: CODEC_LABEL.h264 }
}

/**
 * Actionable copy for a browser that cannot encode any video codec at all.
 * Always offers the concrete alternatives that exist elsewhere, so the user can
 * still get a finished video.
 */
export function webRenderUnsupportedMessage(profile?: WebRenderProfile): string {
  const attempted = profile ? ` (${profile.label})` : ''
  return [
    `This browser cannot encode video${attempted} right now.`,
    'Browsers without WebCodecs video encoding — or with H.264 encoding disabled — cannot produce the file in-page.',
    'Supported alternatives: render in a recent Chrome, Edge or Safari build for MP4/H.264, or in Firefox for WebM/VP9.',
  ].join(' ')
}

/** Filename for a branded export, e.g. `personalized-abc123.mp4`. */
export function webRenderOutputName(extension: string = WEB_RENDER_EXTENSION.mp4): string {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, '').slice(0, 8) || WEB_RENDER_EXTENSION.mp4
  return `personalized-${Date.now().toString(36)}.${safeExtension}`
}

/** Container a video codec must be written into. */
export function containerForVideoCodec(codec: WebRenderVideoCodec): WebRenderContainer {
  return codec === 'h264' ? 'mp4' : 'webm'
}

/** Preference order for the export: universally playable first. */
const VIDEO_CANDIDATES: WebRenderVideoCodec[] = ['h264', 'vp9', 'vp8']

/** Preference order for the audio track inside a container. */
const AUDIO_CANDIDATES: WebExportAudioCodec[] = ['aac', 'opus', 'vorbis']

/** Audio codecs the export engine asks the renderer for. */
export type WebExportAudioCodec = 'aac' | 'opus' | 'vorbis'

/** What the browser reported it can encode, per container. */
export interface WebExportAudioSupport {
  mp4: string[]
  webm: string[]
}

/** The fully resolved export plan: everything `renderMediaOnWeb()` needs. */
export interface WebExportPlan {
  profile: WebRenderProfile
  audioCodec: WebExportAudioCodec | null
  muted: boolean
  /** Non-fatal note (audio codec substituted, or audio dropped). */
  warning: string | null
  /** Set when the plan cannot be executed at all. */
  error: string | null
  errorReason: 'unsupported-browser' | 'unsupported-codec'
}

/**
 * Resolve the export plan from what the browser actually reported it can
 * encode. Pure so it is unit-testable without WebCodecs.
 *
 * Rules:
 * - a codec the browser did NOT report as supported is never selected;
 * - MP4/H.264 wins whenever it can be encoded (universally playable);
 * - a container that can also carry the audio track is preferred over one that
 *   cannot, so the source video's soundtrack survives the export;
 * - an explicitly requested codec is honoured when it is supported, otherwise
 *   the caller gets an explicit `unsupported-codec` error naming the supported
 *   alternative instead of a silent downgrade.
 */
export function chooseWebExportProfile(input: {
  video: WebRenderCodecSupport
  audio: WebExportAudioSupport
  requestedVideoCodec?: WebRenderVideoCodec | null
  requestedAudioCodec?: string | null
}): WebExportPlan {
  const requestedCodec = input.requestedVideoCodec ?? null
  const requestedAudioInput = input.requestedAudioCodec ?? null
  const requestedAudio: WebExportAudioCodec | null =
    requestedAudioInput && AUDIO_CANDIDATES.includes(requestedAudioInput as WebExportAudioCodec)
      ? (requestedAudioInput as WebExportAudioCodec)
      : null

  const videoSupported = (codec: WebRenderVideoCodec): boolean => input.video[codec] === true
  const audioFor = (container: WebRenderContainer): string[] =>
    (container === 'mp4' ? input.audio.mp4 : input.audio.webm) ?? []

  const encodable = VIDEO_CANDIDATES.filter(videoSupported)

  // Nothing can be encoded at all: the browser itself is the problem.
  if (encodable.length === 0) {
    const attempted = requestedCodec
      ? {
          container: containerForVideoCodec(requestedCodec),
          videoCodec: requestedCodec,
          label: CODEC_LABEL[requestedCodec],
        }
      : undefined
    return {
      profile: preferredWebRenderProfile(input.video),
      audioCodec: null,
      muted: true,
      warning: null,
      error: webRenderUnsupportedMessage(attempted),
      errorReason: 'unsupported-browser',
    }
  }

  // An explicitly requested codec this browser cannot encode is an error, not a
  // silent downgrade — the message names the alternative we can produce.
  if (requestedCodec && !videoSupported(requestedCodec)) {
    const alternative = preferredWebRenderProfile(input.video)
    return {
      profile: alternative,
      audioCodec: null,
      muted: true,
      warning: null,
      error: `This browser cannot encode ${CODEC_LABEL[requestedCodec]}. Supported alternative: ${alternative.label} — we can produce that instead.`,
      errorReason: 'unsupported-codec',
    }
  }

  const candidates = requestedCodec
    ? [requestedCodec, ...VIDEO_CANDIDATES.filter((codec) => codec !== requestedCodec)]
    : VIDEO_CANDIDATES
  const ordered = candidates.filter(videoSupported)

  // Prefer a container that can also carry the audio track.
  const withAudio = ordered.filter((codec) =>
    AUDIO_CANDIDATES.some((audio) => audioFor(containerForVideoCodec(codec)).includes(audio)),
  )
  const videoCodec = withAudio[0] ?? ordered[0]
  const container = containerForVideoCodec(videoCodec)
  const profile: WebRenderProfile = {
    container,
    videoCodec,
    label: CODEC_LABEL[videoCodec],
  }

  const availableAudio = audioFor(container)
  const audioCodec: WebExportAudioCodec | null =
    requestedAudio && availableAudio.includes(requestedAudio)
      ? requestedAudio
      : AUDIO_CANDIDATES.find((audio) => availableAudio.includes(audio)) ?? null

  let warning: string | null = null
  if (audioCodec === null) {
    warning = `This browser cannot encode an audio codec for ${profile.label}, so the source video's audio was left out.`
  } else if (requestedAudioInput && audioCodec !== requestedAudioInput) {
    warning = `Audio codec "${requestedAudioInput}" is not available in this browser for ${profile.label}; using "${audioCodec}" instead.`
  }

  return {
    profile,
    audioCodec,
    muted: audioCodec === null,
    warning,
    error: null,
    errorReason: 'unsupported-codec',
  }
}
