/**
 * The real work of a batch (Stage 10): for one recipient, build THEIR copy of the design and run the same pipelines the single-video
 * panels use: thumbnail and GIF from the shared composition (Stage 7), the video through the browser export. Seams are injectable for tests.
 */
import type { PreviewInputProps } from '../preview/types'
import type { Recipient } from '../bulk/csv'
import type { BatchItem, RunDeps, StepName } from '../bulk/batchJob'
import { propsForRecipient } from '../bulk/recipientInput'
import { createWebStillDeps, makeGif, makeThumbnail, type StillDeps } from './renderStills'
import { exportPersonalizedVideo, type WebExportResult } from '../webExport'

export interface BatchStepSeams {
  stillDeps?: (p: PreviewInputProps) => Promise<StillDeps>
  exportVideo?: (o: { inputProps: PreviewInputProps; signal?: AbortSignal }) => Promise<WebExportResult>
}

export function createBatchRunner(base: PreviewInputProps, recipients: Recipient[], seams: BatchStepSeams = {}): RunDeps {
  const byId = new Map(recipients.map((r) => [r.id, r]))
  const stills = seams.stillDeps ?? createWebStillDeps
  const exportVideo = seams.exportVideo ?? exportPersonalizedVideo
  return {
    async runStep(step: StepName, item: BatchItem, { signal }) {
      const r = byId.get(item.id); if (!r) throw new Error('This recipient is not in the list any more.')
      const p = propsForRecipient(base, r)
      if (step === 'thumbnail') { const t = await makeThumbnail(p, await stills(p), { signal, format: 'jpeg' }); return { blob: t.blob, fileName: 'thumbnail.jpg' } }
      if (step === 'gif') { const g = await makeGif(p, await stills(p), { signal }); return { blob: g.blob, fileName: 'personalized.gif' } }
      const v = await exportVideo({ inputProps: p, signal })
      if (!v.ok) { if (v.reason === 'cancelled') throw Object.assign(new Error('Cancelled'), { name: 'AbortError' }); throw new Error(v.error) }
      return { blob: v.blob, fileName: `video.${v.extension || 'mp4'}` }
    },
  }
}
