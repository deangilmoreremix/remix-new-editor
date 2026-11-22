import { applyViaSmartvidFilename } from '@smartvid/downloader-core/filename-style'

/**
 * Build a filesystem-safe base name from a media title.
 *
 * @param title Source title shown on the share card or export dialog.
 */
export const exportBaseFileName = (title?: string | null): string => {
  const cleaned = (title?.trim() || 'Smartvid Downloader')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
  return cleaned || 'Smartvid Downloader'
}

/**
 * Build a filesystem-safe PNG name from a media title.
 *
 * The name ends with `via Smartvid Downloader` before the extension.
 *
 * @param title Source title shown on the share card.
 */
export const shareImageFileName = (title?: string | null): string =>
  applyViaSmartvidFilename(`${exportBaseFileName(title)}.png`)

/**
 * Build a filesystem-safe export name with the given extension.
 *
 * The name ends with `via Smartvid Downloader` before the extension.
 *
 * @param title Source title used as the default file name.
 * @param extension File extension without a leading dot.
 */
export const exportFileName = (title: string | null | undefined, extension: string): string =>
  applyViaSmartvidFilename(`${exportBaseFileName(title)}.${extension.replace(/^\./, '')}`)
