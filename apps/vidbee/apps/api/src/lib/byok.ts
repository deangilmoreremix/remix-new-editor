/**
 * Bring your own key (VIDBEE_AI_MODE=byok).
 *
 * Every visitor uses their own OpenAI key. The browser keeps it and sends it with each AI request in the
 * `x-vidbee-openai-key` header (and an optional model in `x-vidbee-openai-model`). The server uses it for that
 * request only: it is never written to disk, never logged, and never returned. In this mode a key saved on the
 * server or in the environment is ignored, and the base URL cannot be changed by the visitor.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { IncomingHttpHeaders } from 'node:http'
import { trimEnv } from './api-paths'

export interface ClientAi {
  apiKey?: string
  model?: string
}

const store = new AsyncLocalStorage<ClientAi>()

export const byokEnabled = (): boolean => trimEnv('VIDBEE_AI_MODE') === 'byok'

const KEY_PATTERN = /^[A-Za-z0-9_\-.:]{8,400}$/
const MODEL_PATTERN = /^[A-Za-z0-9_\-.:/]{1,100}$/

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? ''

/** Read the visitor's key and model from the request headers; anything malformed is dropped. */
export const parseClientAi = (headers: IncomingHttpHeaders): ClientAi => {
  const apiKey = first(headers['x-vidbee-openai-key'])
  const model = first(headers['x-vidbee-openai-model'])
  return {
    apiKey: KEY_PATTERN.test(apiKey) ? apiKey : undefined,
    model: MODEL_PATTERN.test(model) ? model : undefined
  }
}

/** Run `next` (the rest of the request) with the visitor's key available to `clientAi()`. */
export const withClientAi = (headers: IncomingHttpHeaders, next: () => void): void => {
  store.run(parseClientAi(headers), next)
}

export const clientAi = (): ClientAi => store.getStore() ?? {}
