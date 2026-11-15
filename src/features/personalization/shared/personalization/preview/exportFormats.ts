/**
 * Extra export shapes (9:16, 1:1, 16:9, 4:5) from one project, all rendered in the browser by the same web
 * export the main button uses. Free: no server render, no upload.
 *
 * `settingsForAspect` only reshapes the frame; layer positions are fractions of it, so they carry over, and
 * `reflowLayersForAspect` re-seats the default-layout layers the customer has not moved by hand.
 */
import { getCompositionDimensions, reflowLayersForAspect } from './presets'
import type { PersonalizationPreviewSettings, PreviewAspectRatio, PreviewInputProps } from './types'
import type { WebExportOptions, WebExportResult } from '../webExport'

export interface ExportFormat { id: PreviewAspectRatio; label: string; hint: string }

export const EXPORT_FORMATS: readonly ExportFormat[] = Object.freeze([
  { id: '9:16', label: 'Vertical 9:16', hint: 'Reels, Shorts, TikTok, Stories' },
  { id: '1:1', label: 'Square 1:1', hint: 'Feed posts' },
  { id: '4:5', label: 'Portrait 4:5', hint: 'Instagram and Facebook feed' },
  { id: '16:9', label: 'Wide 16:9', hint: 'YouTube, websites, email' },
])

export function settingsForAspect(settings: PersonalizationPreviewSettings, aspect: PreviewAspectRatio): PersonalizationPreviewSettings {
  if (settings.aspectRatio === aspect) return settings
  const reflowed = reflowLayersForAspect(settings, settings.aspectRatio, aspect)
  return { ...reflowed, aspectRatio: aspect, ...getCompositionDimensions(aspect) }
}

/** "personalized-abc" + 9:16 -> "personalized-abc-9x16" (a colon is not safe in a file name). */
export function formatFileSuffix(aspect: PreviewAspectRatio): string {
  return aspect.replace(':', 'x')
}

export interface FormatExportResult {
  aspect: PreviewAspectRatio
  result: WebExportResult
}

export interface ExportFormatsOptions {
  inputProps: PreviewInputProps
  aspects: readonly PreviewAspectRatio[]
  /** Overall progress 0..1 across all formats, plus which one is running. */
  onProgress?: (progress: number, aspect: PreviewAspectRatio, index: number, total: number) => void
  /** Called once per finished format so each file is saved as soon as it exists. */
  onFile?: (aspect: PreviewAspectRatio, result: Extract<WebExportResult, { ok: true }>) => void
  signal?: AbortSignal
  /** Injectable for tests; defaults to the real web export (loaded lazily). */
  exporter?: (options: WebExportOptions) => Promise<WebExportResult>
}

/**
 * Renders each requested shape one after another (a browser renders one video at a time). A failed shape does not
 * stop the others; a cancel stops everything. Duplicate shapes are rendered once.
 */
export async function exportFormats(options: ExportFormatsOptions): Promise<FormatExportResult[]> {
  const { inputProps, onProgress, onFile, signal } = options
  const aspects = [...new Set(options.aspects)]
  const exporter = options.exporter ?? (await import('../webExport')).exportPersonalizedVideo
  const results: FormatExportResult[] = []
  for (let i = 0; i < aspects.length; i++) {
    const aspect = aspects[i]
    if (signal?.aborted) {
      results.push({ aspect, result: { ok: false, reason: 'cancelled', error: 'Cancelled.' } })
      break
    }
    const settings = settingsForAspect(inputProps.settings, aspect)
    // Footage brightness is measured on the cover crop of ONE frame shape; in another shape the text sits over a
    // different part of the footage, so those samples would set the wrong scrim strength. Keep them only when the
    // frame is the same size; otherwise the scrim falls back to its default.
    const sameCrop = settings.width === inputProps.settings.width && settings.height === inputProps.settings.height
    const { lumaSamples, ...rest } = inputProps
    const shaped: PreviewInputProps = { ...rest, ...(sameCrop && lumaSamples ? { lumaSamples } : {}), settings }
    const result = await exporter({
      inputProps: shaped,
      signal,
      onProgress: (p) => onProgress?.((i + Math.min(1, Math.max(0, p))) / aspects.length, aspect, i, aspects.length),
    })
    results.push({ aspect, result })
    if (result.ok) onFile?.(aspect, result)
    if (!result.ok && result.reason === 'cancelled') break
  }
  return results
}
