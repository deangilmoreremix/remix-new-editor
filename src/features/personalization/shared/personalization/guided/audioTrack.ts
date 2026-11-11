/**
 * Customer audio-track rules for the personalization preview.
 *
 * Audio upload is an optional, free part of the personalization flow: the
 * customer may bring their own MP3/M4A/WAV/OGG/AAC track and it is mixed into
 * the composed video (preview AND browser export). Nothing here calls a paid
 * generation API — the file simply travels the same durable-upload path as
 * every other personalization asset.
 *
 * The rules live in their own module (instead of inside the picker component)
 * so the validation can be unit-tested without a DOM, and so the modal, the
 * guided wizard and the tests can never drift apart on what "supported" means.
 */

/** Supported audio formats and the MIME types browsers report for them. */
export const SUPPORTED_AUDIO_FORMATS = ['mp3', 'm4a', 'wav', 'ogg', 'aac'] as const

export type SupportedAudioFormat = (typeof SUPPORTED_AUDIO_FORMATS)[number]

/** Hard cap on a single audio upload. 25 MB is minutes of stereo audio. */
export const AUDIO_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/** `accept` attribute for the audio file input. */
export const AUDIO_ACCEPT_ATTRIBUTE = [
  '.mp3',
  '.m4a',
  '.wav',
  '.ogg',
  '.aac',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
].join(',')

const MIME_BY_FORMAT: Record<SupportedAudioFormat, string[]> = {
  mp3: ['audio/mpeg', 'audio/mp3'],
  m4a: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'],
  ogg: ['audio/ogg', 'application/ogg'],
  aac: ['audio/aac', 'audio/aacp', 'audio/x-aac'],
}

/** Lowercase extension of a file name, without the dot. */
export function audioExtensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim())
  return match ? match[1].toLowerCase() : ''
}

/**
 * Which supported format a file is, by extension first and MIME type second.
 * Some browsers report an empty `type` for audio files, so the extension is
 * the more reliable signal; the MIME type covers renames and unusual names.
 */
export function supportedAudioFormatOf(file: {
  name?: string
  type?: string
}): SupportedAudioFormat | null {
  const extension = audioExtensionOf(file.name || '')
  if (isSupportedAudioExtension(extension)) return extension as SupportedAudioFormat

  const mime = (file.type || '').split(';')[0].trim().toLowerCase()
  if (!mime) return null
  for (const format of SUPPORTED_AUDIO_FORMATS) {
    if (MIME_BY_FORMAT[format].includes(mime)) return format
  }
  return null
}

/** True when the extension names a supported audio format. */
export function isSupportedAudioExtension(extension: string): boolean {
  return (SUPPORTED_AUDIO_FORMATS as readonly string[]).includes(extension)
}

/** True when the file is a supported, in-bounds audio file. */
export function isSupportedAudioFile(file: { name?: string; type?: string; size?: number }): boolean {
  return validateAudioFile(file) === null
}

/** Human-readable file size, e.g. `18.4 MB`. */
export function formatAudioSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Validate one candidate audio file. Returns a customer-facing error message,
 * or null when the file may be used.
 *
 * Only the format list and the size cap are enforced — bitrate, duration and
 * channel layout are left to the browser's own decoder, which is what the
 * preview and the export both play through.
 */
export function validateAudioFile(file: {
  name?: string
  type?: string
  size?: number
}): string | null {
  const name = (file.name || '').trim() || 'That file'
  const format = supportedAudioFormatOf(file)

  if (!format) {
    const seen = file.type ? ` (${file.type})` : ''
    return `${name} is not an audio format we can use${seen}. Choose an MP3, M4A, WAV, OGG or AAC file.`
  }

  const size = typeof file.size === 'number' ? file.size : 0
  if (size > AUDIO_MAX_UPLOAD_BYTES) {
    return `${name} is ${formatAudioSize(size)} — the limit is ${formatAudioSize(
      AUDIO_MAX_UPLOAD_BYTES,
    )}. Choose a smaller audio file.`
  }

  return null
}
