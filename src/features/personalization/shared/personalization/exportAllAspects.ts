/**
 * One project, every common video shape. Re-shapes the approved settings for each aspect ratio
 * (layers the customer did not move follow that shape's default geometry; edited layers stay put,
 * exactly like switching the shape in the editor) and exports them one after another.
 *
 * The export function is injected so this stays pure and testable; the provider passes the real
 * browser exporter. Nothing here calls a paid service.
 */
import { getCompositionDimensions, reflowLayersForAspect } from './preview/presets'
import type { PersonalizationPreviewSettings, PreviewAspectRatio, PreviewInputProps } from './preview/types'
import type { WebExportResult } from './webExport'

export const ALL_ASPECT_RATIOS: readonly PreviewAspectRatio[] = ['16:9', '9:16', '1:1', '4:5']

export function settingsForAspect(
  settings: PersonalizationPreviewSettings,
  target: PreviewAspectRatio,
): PersonalizationPreviewSettings {
  if (settings.aspectRatio === target) return settings
  const dims = getCompositionDimensions(target)
  const resized = { ...settings, aspectRatio: target, width: dims.width, height: dims.height }
  return reflowLayersForAspect(resized, settings.aspectRatio, target)
}

export interface AspectExportOutcome {
  aspect: PreviewAspectRatio
  result: WebExportResult
}

export async function exportAllAspects(options: {
  inputProps: PreviewInputProps
  aspects?: readonly PreviewAspectRatio[]
  exportOne: (inputProps: PreviewInputProps, onProgress: (p: number) => void) => Promise<WebExportResult>
  /** Called as each shape starts and as its render progresses (0..1). */
  onProgress?: (info: { aspect: PreviewAspectRatio; index: number; total: number; progress: number }) => void
  /** Called as soon as one shape finishes, so its file can be handed over immediately. */
  onResult?: (outcome: AspectExportOutcome) => void
  signal?: AbortSignal
}): Promise<AspectExportOutcome[]> {
  const aspects = options.aspects ?? ALL_ASPECT_RATIOS
  const outcomes: AspectExportOutcome[] = []
  for (let index = 0; index < aspects.length; index++) {
    const aspect = aspects[index]
    if (options.signal?.aborted) break
    options.onProgress?.({ aspect, index, total: aspects.length, progress: 0 })
    const inputProps: PreviewInputProps = {
      ...options.inputProps,
      settings: settingsForAspect(options.inputProps.settings, aspect),
    }
    const result = await options.exportOne(inputProps, (progress) =>
      options.onProgress?.({ aspect, index, total: aspects.length, progress }),
    )
    const outcome = { aspect, result }
    outcomes.push(outcome)
    options.onResult?.(outcome)
    // A cancelled render ends the whole run; any other failure leaves the remaining shapes to try.
    if (!result.ok && result.reason === 'cancelled') break
  }
  return outcomes
}
