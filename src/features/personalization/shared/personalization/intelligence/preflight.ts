/**
 * Final preflight: one list of checks that says plainly what PASSED, what needs attention, and what could NOT be
 * checked. A check that did not run is "unchecked", never "pass". Only `fail` items can block; warnings and
 * unchecked items never do, so speculative advice does not stop an export.
 */
import { findUnresolvedTokens } from './textIntel'

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'unchecked'
export interface PreflightItem { id: string; label: string; status: CheckStatus; detail: string }
export interface PreflightResult { items: PreflightItem[]; blocking: PreflightItem[]; verified: number; unchecked: number; ready: boolean }

export interface PreflightInput {
  hasVideo: boolean
  /** Text of every visible text layer and caption. */
  texts: string[]
  /** Images drawn by visible layers: whether each URL is present. */
  imageLayers: { label: string; url?: string | null }[]
  /** Assets the customer selected that no visible layer uses. */
  unusedSelectedAssets: number
  captions: { present: boolean; count: number }
  /** Null when audio was not analysed (so the result is "unchecked"). */
  audio: { clipped: boolean; silent: boolean; lufs: number | null } | null
  /** Layout report: number of adjust/critical issues, whether it blocks, and whether text fit was checked. */
  layout: { adjust: number; blocksExport: boolean } | null
  readability: { warnings: number } | null
  formats: { prepared: string[]; total: number }
}

export function buildPreflight(i: PreflightInput): PreflightResult {
  const items: PreflightItem[] = []
  const add = (id: string, label: string, status: CheckStatus, detail: string) => items.push({ id, label, status, detail })

  add('video', 'Video ready', i.hasVideo ? 'pass' : 'fail', i.hasVideo ? 'A video is selected.' : 'Choose a video first.')

  const missing = i.imageLayers.filter((l) => !l.url)
  add('assets', 'Assets ready', missing.length ? 'fail' : i.unusedSelectedAssets ? 'warn' : 'pass',
    missing.length ? `${missing.map((m) => m.label).join(', ')} ${missing.length === 1 ? 'has' : 'have'} no picture.`
      : i.unusedSelectedAssets ? `${i.unusedSelectedAssets} selected picture${i.unusedSelectedAssets === 1 ? ' is' : 's are'} not used in the video.` : 'Every picture in the video is linked.')

  add('readable', 'Text readable', i.readability ? (i.readability.warnings ? 'warn' : 'pass') : 'unchecked',
    i.readability ? (i.readability.warnings ? `${i.readability.warnings} readability note${i.readability.warnings === 1 ? '' : 's'}.` : 'Reading time and contrast look fine.') : 'Readability was not measured.')

  add('layout', 'Layout checked', i.layout ? (i.layout.blocksExport ? 'fail' : i.layout.adjust ? 'warn' : 'pass') : 'unchecked',
    i.layout ? (i.layout.blocksExport ? 'A critical layout problem blocks export.' : i.layout.adjust ? `${i.layout.adjust} placement issue${i.layout.adjust === 1 ? '' : 's'} to review.` : 'No placement problems found.') : 'Layout was not checked.')

  add('captions', 'Captions ready', i.captions.present ? 'pass' : 'unchecked', i.captions.present ? `${i.captions.count} caption lines.` : 'No captions added (optional).')

  add('audio', 'Audio checked', i.audio ? (i.audio.clipped ? 'warn' : i.audio.silent ? 'warn' : 'pass') : 'unchecked',
    i.audio ? (i.audio.clipped ? 'Audio peaks reach the digital limit and may distort.' : i.audio.silent ? 'No sound was detected.' : i.audio.lufs != null ? `Loudness about ${i.audio.lufs.toFixed(1)} LUFS.` : 'No clipping found.') : 'Audio was not analysed. Run “Check audio” in step 2.')

  const tokens = [...new Set(i.texts.flatMap((t) => findUnresolvedTokens(t)))]
  add('tokens', 'Personalization tokens valid', tokens.length ? 'fail' : 'pass', tokens.length ? `Unfilled placeholder${tokens.length === 1 ? '' : 's'}: ${tokens.join(', ')}.` : 'No raw placeholders found.')

  add('formats', 'Platform formats', i.formats.prepared.length ? 'pass' : 'unchecked', i.formats.prepared.length ? `Prepared: ${i.formats.prepared.join(', ')}.` : 'No extra social versions prepared yet (optional).')

  const blocking = items.filter((x) => x.status === 'fail')
  return { items, blocking, verified: items.filter((x) => x.status === 'pass').length, unchecked: items.filter((x) => x.status === 'unchecked').length, ready: blocking.length === 0 }
}
