/**
 * Pre-publish quality checks (pure). Findings are 'error' only when MuAPI or the
 * platform would reject the post (or the media can't be sent); everything else is
 * a 'warning'/'info' recommendation that never blocks a valid post.
 */
import { PLATFORM_SPECS, isPublicMediaUrl, type PlatformId, type MediaKind } from '../api/socialPayloads'
import { PLATFORM_PRESETS, aspectWarning } from './platformConfig'

export type Severity = 'error' | 'warning' | 'info'
export interface Finding { id: string; severity: Severity; platform?: PlatformId; message: string; fix?: string }

export interface ValidationInput {
  platforms: PlatformId[]
  mediaType?: MediaKind
  mediaUrl?: string
  mediaWidth?: number
  mediaHeight?: number
  mediaDurationSeconds?: number
  mediaBytes?: number
  hasThumbnail?: boolean
  hasCaptions?: boolean
  altText?: string
  /** Caption text per platform (already merged: platform text → master). */
  captions: Partial<Record<PlatformId, string>>
  titles?: Partial<Record<PlatformId, string>>
  scheduledAt?: number | null
  /** Other scheduled items for duplicate-schedule detection. */
  otherSchedules?: Array<{ id: string; scheduledAt: number | null; platforms: string[]; caption?: string }>
  now?: number
}

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

export function validateFileType(mime: string): { ok: boolean; kind?: MediaKind; reason?: string } {
  if (ACCEPTED_IMAGE_TYPES.includes(mime)) return { ok: true, kind: 'image' }
  if (ACCEPTED_VIDEO_TYPES.includes(mime)) return { ok: true, kind: 'video' }
  return { ok: false, reason: `${mime || 'This file type'} isn't supported. Use JPG, PNG, WebP, GIF, MP4, MOV or WebM.` }
}

export function validatePost(i: ValidationInput): Finding[] {
  const out: Finding[] = []
  const now = i.now ?? Date.now()
  const add = (f: Finding) => out.push(f)

  if (!i.mediaUrl) add({ id: 'media-missing', severity: 'error', message: 'No media is attached.', fix: 'Add a video or image to post.' })
  else if (!isPublicMediaUrl(i.mediaUrl) && !/^(blob:|data:)/.test(i.mediaUrl)) {
    add({ id: 'media-url', severity: 'error', message: 'The media link is not usable.', fix: 'Use a public https link or upload the file.' })
  }
  if (i.platforms.length === 0) add({ id: 'no-platform', severity: 'error', message: 'No destination is selected.', fix: 'Choose at least one connected account.' })

  if (i.mediaType === 'image' && !(i.altText || '').trim()) {
    add({ id: 'alt-missing', severity: 'warning', message: 'This image has no alt text.', fix: 'Describe the image for screen-reader users (kept with your draft; platforms are not sent alt text via MuAPI).' })
  }
  if (i.mediaType === 'video' && i.hasCaptions === false) {
    add({ id: 'captions-missing', severity: 'warning', message: 'This video has no captions/subtitles.', fix: 'Add captions in the subtitle editor, or burn them in before posting.' })
  }
  if (i.mediaBytes && i.mediaBytes > 1024 ** 3) add({ id: 'media-huge', severity: 'warning', message: `The file is ${(i.mediaBytes / 1024 ** 3).toFixed(1)} GB; uploads may be slow or rejected.`, fix: 'Compress it in Media tools.' })

  for (const p of i.platforms) {
    const spec = PLATFORM_SPECS[p]
    const preset = PLATFORM_PRESETS[p]
    if (!spec || !preset) { add({ id: `plat-${p}`, severity: 'error', platform: p, message: `Unsupported platform ${p}.` }); continue }
    if (i.mediaType && !spec.media.includes(i.mediaType)) add({ id: `media-type-${p}`, severity: 'error', platform: p, message: `${spec.label} does not accept ${i.mediaType}s here.`, fix: 'Deselect it or change the media.' })

    const text = (i.captions[p] ?? '').trim()
    const title = (i.titles?.[p] ?? '').trim()
    if (!text && p !== 'youtube' && p !== 'tiktok' && p !== 'pinterest') add({ id: `empty-${p}`, severity: 'warning', platform: p, message: `${spec.label} has no caption.`, fix: 'Write a caption or use the master caption.' })
    if (preset.hardCaptionMax && text.length > preset.hardCaptionMax) add({ id: `len-${p}`, severity: 'error', platform: p, message: `${spec.label} caption is ${text.length}/${preset.hardCaptionMax} characters.`, fix: 'Shorten it (try Short-form rewrite).' })
    else if (text.length > preset.captionSoftMax) add({ id: `len-soft-${p}`, severity: 'warning', platform: p, message: `${spec.label} caption is ${text.length}/${preset.captionSoftMax} characters.`, fix: 'Shorten it.' })
    if (preset.hardTitleMax && title.length > preset.hardTitleMax) add({ id: `title-${p}`, severity: 'error', platform: p, message: `${spec.label} title is ${title.length}/${preset.hardTitleMax} characters.`, fix: 'Shorten the title.' })
    if (p === 'youtube' && !title) add({ id: 'yt-title', severity: 'error', platform: p, message: 'YouTube needs a title.', fix: 'Add a title in the Write step.' })
    const tags = (text.match(/#[\p{L}\p{N}_]+/gu) || []).length
    if (tags > preset.hashtagSoftMax) add({ id: `tags-${p}`, severity: 'info', platform: p, message: `${tags} hashtags on ${spec.label}; ${preset.hashtagSoftMax} or fewer is recommended.` })
    const aw = aspectWarning(p, i.mediaWidth, i.mediaHeight)
    if (aw) add({ id: `aspect-${p}`, severity: 'warning', platform: p, message: aw, fix: 'Use Media tools → Reframe.' })
    if (preset.maxVideoSeconds && i.mediaType === 'video' && i.mediaDurationSeconds && i.mediaDurationSeconds > preset.maxVideoSeconds) {
      add({ id: `dur-${p}`, severity: 'warning', platform: p, message: `Video is ${Math.round(i.mediaDurationSeconds)}s; ${spec.label} short-form is usually up to ${preset.maxVideoSeconds}s.`, fix: 'Trim it.' })
    }
    if (p === 'youtube' && i.mediaType === 'video' && i.hasThumbnail === false) add({ id: 'thumb-yt', severity: 'info', platform: p, message: 'No custom thumbnail for YouTube.', fix: 'Add one in the Thumbnail step.' })
  }

  if (i.scheduledAt !== undefined && i.scheduledAt !== null) {
    if (!Number.isFinite(i.scheduledAt)) add({ id: 'sched-invalid', severity: 'error', message: 'The schedule date is not valid.' })
    else if (i.scheduledAt < now) add({ id: 'sched-past', severity: 'error', message: 'The scheduled time is in the past.', fix: 'Pick a future time.' })
    for (const o of i.otherSchedules || []) {
      if (o.scheduledAt === i.scheduledAt && o.platforms.some((p) => (i.platforms as string[]).includes(p))) add({ id: `dup-${o.id}`, severity: 'warning', message: 'Another post is scheduled for the same time on the same platform.', fix: 'Move one of them.' })
    }
  }
  const mine = Object.values(i.captions).find((c) => c && c.trim())?.trim().toLowerCase()
  if (mine) {
    const dup = (i.otherSchedules || []).find((o) => o.caption && o.caption.trim().toLowerCase() === mine)
    if (dup) add({ id: 'dup-content', severity: 'warning', message: 'This caption matches another planned post.', fix: 'Vary the text to avoid duplicate-content flags.' })
  }
  return out
}

export const hasBlockingErrors = (f: Finding[]) => f.some((x) => x.severity === 'error')

/** Duplicate-caption detection for a set of drafts: normalised text similarity (Jaccard on words). */
export function similarity(a: string, b: string): number {
  const ws = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
  const A = ws(a), B = ws(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter)
}

/**
 * MuAPI upload links (used when a file only exists on this device or was edited here) expire after about an hour, but an
 * automatic job sends its stored links unchanged when the time comes. So a job that depends on a temporary upload may only be
 * scheduled for a little under an hour ahead; anything later needs a permanent public https link. Returns '' when fine.
 */
export const TEMP_UPLOAD_SAFE_MS = 50 * 60_000

export function temporaryMediaScheduleError(
  input: { mediaUrl?: string; coverUrls?: Array<string | undefined>; scheduledAt: number | null },
  now = Date.now(),
): string {
  if (input.scheduledAt === null || !Number.isFinite(input.scheduledAt)) return ''
  const temporary = [input.mediaUrl, ...(input.coverUrls ?? [])].filter((u): u is string => !!u && !isPublicMediaUrl(u))
  if (!temporary.length) return ''
  const ahead = input.scheduledAt - now
  if (ahead <= TEMP_UPLOAD_SAFE_MS) return ''
  const what = !input.mediaUrl || isPublicMediaUrl(input.mediaUrl) ? 'The cover image' : 'This file'
  return `${what} is only on this device, so it has to be uploaded to a link that expires in about an hour. Automatic posts that far ahead (${Math.round(ahead / 60_000)} minutes) would find an expired link. Pick a time within ${Math.round(TEMP_UPLOAD_SAFE_MS / 60_000)} minutes, publish now, or use a permanent public https link for the media.`
}
