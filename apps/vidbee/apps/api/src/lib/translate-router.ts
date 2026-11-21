/**
 * oRPC router that mounts `translateContract` under `/rpc/translate/*`.
 */
import { implement, ORPCError } from '@orpc/server'
import { translateContract } from '@vidbee/transcription/web-contract'
import { requireOpenAiConfig } from './openai-responses'
import {
  cancelTranslation,
  exportTranslation,
  listTranslations,
  startTranslation
} from './translate-host'

const os = implement(translateContract)

const bad = (error: unknown, fallback: string): never => {
  throw new ORPCError('BAD_REQUEST', {
    message: error instanceof Error && error.message.trim() ? error.message : fallback
  })
}

export const translateRouter = os.router({
  list: os.list.handler(async ({ input }) => listTranslations(input.downloadId)),
  start: os.start.handler(async ({ input }) => {
    try {
      requireOpenAiConfig()
      return startTranslation(input.downloadId, input.language)
    } catch (error) {
      return bad(error, 'Failed to start the translation.')
    }
  }),
  cancel: os.cancel.handler(async ({ input }) => cancelTranslation(input.downloadId, input.language)),
  export: os.export.handler(async ({ input }) => {
    try {
      return exportTranslation(input.downloadId, input.language, input.format)
    } catch (error) {
      return bad(error, 'Failed to export the translation.')
    }
  })
})

export type TranslateRouter = typeof translateRouter
