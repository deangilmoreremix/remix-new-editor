/**
 * oRPC router that mounts `aiContract` under `/rpc/ai/*`.
 */
import { implement, ORPCError } from '@orpc/server'
import { aiContract } from '@vidbee/transcription/web-contract'
import {
  cancelAiRun,
  deletePrompt,
  getAiRun,
  getAiSettings,
  listAiRuns,
  listAiSkills,
  restorePrompts,
  savePrompt,
  setPromptVisible,
  startPromptTest,
  testConnection,
  setAiSettings,
  startAiRun
} from './ai-host'

const os = implement(aiContract)

const fail = (error: unknown, fallback: string, code: 'BAD_REQUEST' | 'INTERNAL_SERVER_ERROR' = 'BAD_REQUEST'): never => {
  const message = error instanceof Error && error.message.trim() ? error.message : fallback
  throw new ORPCError(code, { message })
}

export const aiRouter = os.router({
  settingsGet: os.settingsGet.handler(async () => getAiSettings()),
  settingsSet: os.settingsSet.handler(async ({ input }) => {
    try {
      return setAiSettings(input)
    } catch (error) {
      return fail(error, 'Failed to save AI settings.')
    }
  }),
  skills: os.skills.handler(async () => listAiSkills()),
  promptsSave: os.promptsSave.handler(async ({ input }) => {
    try {
      return savePrompt(input)
    } catch (error) {
      return fail(error, 'Failed to save the prompt.')
    }
  }),
  promptsDelete: os.promptsDelete.handler(async ({ input }) => deletePrompt(input.id)),
  promptsVisible: os.promptsVisible.handler(async ({ input }) => setPromptVisible(input.id, input.visible)),
  promptsRestore: os.promptsRestore.handler(async () => restorePrompts()),
  promptsTest: os.promptsTest.handler(async ({ input }) => {
    try {
      return startPromptTest(input)
    } catch (error) {
      return fail(error, 'Failed to run the test.')
    }
  }),
  testConnection: os.testConnection.handler(async ({ input }) => testConnection(input)),
  run: os.run.handler(async ({ input }) => {
    try {
      return startAiRun(input)
    } catch (error) {
      return fail(error, 'Failed to start the summary.')
    }
  }),
  get: os.get.handler(async ({ input }) => getAiRun(input.downloadId, input.skillId)),
  list: os.list.handler(async ({ input }) => listAiRuns(input.downloadId)),
  cancel: os.cancel.handler(async ({ input }) => cancelAiRun(input.downloadId, input.skillId))
})

export type AiRouter = typeof aiRouter
