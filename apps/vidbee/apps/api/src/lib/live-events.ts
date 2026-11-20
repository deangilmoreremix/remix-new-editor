/**
 * In-process pub/sub for live AI output. Hosts publish text deltas and state changes
 * on a channel such as `ai:<downloadId>:<skillId>` or `chat:<downloadId>`; the
 * `/stream` route forwards them to the browser as server-sent events.
 */
import { EventEmitter } from 'node:events'

export interface LiveEvent {
  event: string
  payload: unknown
}

const bus = new EventEmitter()
bus.setMaxListeners(0)

export const aiChannel = (downloadId: string, skillId: string): string =>
  `ai:${downloadId}:${skillId}`
export const chatChannel = (downloadId: string): string => `chat:${downloadId}`

export const publishLive = (channel: string, event: string, payload: unknown): void => {
  bus.emit(channel, { event, payload } satisfies LiveEvent)
}

export const subscribeLive = (channel: string, listener: (event: LiveEvent) => void): (() => void) => {
  bus.on(channel, listener)
  return () => bus.off(channel, listener)
}
