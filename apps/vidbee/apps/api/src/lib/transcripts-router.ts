/**
 * oRPC router that mounts `transcriptsContract` under `/rpc/transcripts/*`.
 */
import { implement, ORPCError } from '@orpc/server'
import { transcriptsContract } from '@vidbee/transcription/web-contract'
import {
  cancelTranscript,
  exportTranscript,
  getTranscriptDetail,
  getTranscriptStatusMap,
  retryTranscript,
  startTranscript
} from './transcripts-host'

const os = implement(transcriptsContract)

const fail = (error: unknown, fallback: string): never => {
  const message = error instanceof Error && error.message.trim() ? error.message : fallback
  throw new ORPCError('INTERNAL_SERVER_ERROR', { message })
}

export const transcriptsRouter = os.router({
  statusMap: os.statusMap.handler(async () => getTranscriptStatusMap()),
  get: os.get.handler(async ({ input }) => getTranscriptDetail(input.downloadId)),
  start: os.start.handler(async ({ input }) => {
    try {
      return await startTranscript(input.downloadId, input.force === true)
    } catch (error) {
      return fail(error, 'Failed to start transcription.')
    }
  }),
  cancel: os.cancel.handler(async ({ input }) => {
    try {
      return await cancelTranscript(input.downloadId)
    } catch (error) {
      return fail(error, 'Failed to cancel transcription.')
    }
  }),
  retry: os.retry.handler(async ({ input }) => {
    try {
      return await retryTranscript(input.downloadId)
    } catch (error) {
      return fail(error, 'Failed to retry transcription.')
    }
  }),
  export: os.export.handler(async ({ input }) => {
    try {
      return exportTranscript(input.downloadId, input.format)
    } catch (error) {
      return fail(error, 'Failed to export transcript.')
    }
  })
})

export type TranscriptsRouter = typeof transcriptsRouter
