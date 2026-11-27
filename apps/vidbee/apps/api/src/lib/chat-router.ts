/**
 * oRPC router that mounts `chatContract` under `/rpc/chat/*`.
 */
import { implement, ORPCError } from '@orpc/server'
import { chatContract } from '@vidbee/transcription/web-contract'
import { cancelChat, getChat, resetChat, sendChat } from './chat-host'

const os = implement(chatContract)

export const chatRouter = os.router({
  get: os.get.handler(async ({ input }) => getChat(input.downloadId)),
  send: os.send.handler(async ({ input }) => {
    try {
      return sendChat(input.downloadId, input.message, input.webSearch === true)
    } catch (error) {
      throw new ORPCError('BAD_REQUEST', {
        message: error instanceof Error ? error.message : 'Failed to send the message.'
      })
    }
  }),
  cancel: os.cancel.handler(async ({ input }) => cancelChat(input.downloadId)),
  reset: os.reset.handler(async ({ input }) => resetChat(input.downloadId))
})

export type ChatRouter = typeof chatRouter
