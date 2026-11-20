/**
 * Thin client for the OpenAI Responses API (`POST {baseUrl}/responses`).
 *
 * Shared by AI summaries, chat and subtitle translation. It knows only the wire
 * format: it streams server-sent events, forwards text deltas, and returns the
 * response's output items so callers can replay them (tool calls, reasoning) next turn.
 */
import fs from 'node:fs'
import path from 'node:path'
import { apiDataDir, trimEnv } from './api-paths'

export const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
export const DEFAULT_MODEL = 'gpt-4.1-mini'

interface StoredAiSettings {
  apiKey?: string
  baseUrl?: string
  model?: string
}

export const aiSettingsFile = path.join(apiDataDir, 'ai-settings.json')

export const readStoredAiSettings = (): StoredAiSettings => {
  try {
    return JSON.parse(fs.readFileSync(aiSettingsFile, 'utf-8')) as StoredAiSettings
  } catch {
    return {}
  }
}

export const getOpenAiConfig = () => {
  const stored = readStoredAiSettings()
  const envKey = trimEnv('OPENAI_API_KEY')
  const storedKey = stored.apiKey?.trim() || undefined
  const keyFromEnv = !storedKey && Boolean(envKey)
  const envBase = trimEnv('OPENAI_BASE_URL') || DEFAULT_BASE_URL
  // A key supplied by the server's environment is bound to the environment's endpoint: a base URL saved from the UI
  // (e.g. together with a throwaway key that was later cleared) must never receive it.
  const baseUrl = keyFromEnv ? envBase : stored.baseUrl?.trim() || envBase
  return {
    apiKey: storedKey ?? envKey,
    keyFromEnv,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model: stored.model?.trim() || trimEnv('VIDBEE_OPENAI_MODEL') || DEFAULT_MODEL
  }
}

export const requireOpenAiConfig = () => {
  const config = getOpenAiConfig()
  if (!config.apiKey) {
    throw new Error('Add an OpenAI API key in AI settings first.')
  }
  return { ...config, apiKey: config.apiKey }
}

/** One item of `response.output`, kept opaque so it can be replayed verbatim. */
export type OutputItem = { type: string; [key: string]: unknown }

export interface ResponseResult {
  /** All output items in order (messages, function calls, reasoning). */
  output: OutputItem[]
  /** Concatenated assistant text. */
  text: string
  /** Pages the model cited (from the built-in web search tool), de-duplicated by address. */
  sources: Array<{ title: string; url: string }>
}

export interface CreateResponseOptions {
  /** Request body fields other than `model` and `stream` (instructions, input, tools, text...). */
  body: Record<string, unknown>
  signal?: AbortSignal
  onTextDelta?: (delta: string) => void
  /** Overrides the configured model for this call. */
  model?: string
  /** Use these settings instead of the saved ones (for testing unsaved values). */
  config?: { apiKey: string; baseUrl: string; model: string }
}

const errorFromResponse = async (response: Response): Promise<string> => {
  const raw = await response.text().catch(() => '')
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } }
    if (parsed.error?.message) {
      return `OpenAI error ${response.status}: ${parsed.error.message}`
    }
  } catch {
    // Not a JSON error body.
  }
  // Never echo a body that is not an API error: the base URL can point anywhere, and the caller must not be able
  // to read what an internal address returns.
  return `OpenAI error ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
}

const textOfMessage = (item: OutputItem): string => {
  const content = item.content
  if (!Array.isArray(content)) {
    return ''
  }
  return content
    .map((part) =>
      part && typeof part === 'object' && (part as { type?: string }).type === 'output_text'
        ? String((part as { text?: unknown }).text ?? '')
        : ''
    )
    .join('')
}

/** Pages cited in the answer: `url_citation` annotations on the output text. */
export const citedSources = (output: OutputItem[]): Array<{ title: string; url: string }> => {
  const seen = new Map<string, { title: string; url: string }>()
  for (const item of output) {
    if (item.type !== 'message' || !Array.isArray(item.content)) {
      continue
    }
    for (const part of item.content as Array<{ annotations?: unknown }>) {
      if (!Array.isArray(part?.annotations)) {
        continue
      }
      for (const note of part.annotations as Array<{ type?: string; url?: string; title?: string }>) {
        if (note?.type === 'url_citation' && typeof note.url === 'string' && /^https?:\/\//i.test(note.url) && !seen.has(note.url)) {
          seen.set(note.url, { title: (note.title ?? '').trim() || note.url, url: note.url })
        }
      }
    }
  }
  return [...seen.values()]
}

/** "Sources" list in Markdown, or an empty string. */
export const sourcesMarkdown = (sources: Array<{ title: string; url: string }>): string =>
  sources.length === 0
    ? ''
    : `\n\n**Sources**\n${sources.map((s) => `- [${s.title.replace(/[\[\]]/g, '')}](${s.url})`).join('\n')}`

/** Create a streamed response and wait for it to finish. */
export const createResponse = async (options: CreateResponseOptions): Promise<ResponseResult> => {
  const config = options.config ?? requireOpenAiConfig()
  const response = await fetch(`${config.baseUrl}/responses`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: options.model ?? config.model,
      stream: true,
      store: false,
      ...options.body
    }),
    signal: options.signal
  })
  if (!response.ok) {
    throw new Error(await errorFromResponse(response))
  }
  if (!response.body) {
    throw new Error('OpenAI returned an empty response body.')
  }

  const doneItems: OutputItem[] = []
  let completedOutput: OutputItem[] | null = null
  let streamedText = ''
  let completed = false

  const handle = (block: string): void => {
    let eventName = ''
    const dataLines: string[] = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }
    const data = dataLines.join('\n')
    if (!data || data === '[DONE]') {
      return
    }
    let payload: {
      type?: string
      delta?: string
      item?: OutputItem
      response?: { output?: OutputItem[]; error?: { message?: string } }
      error?: { message?: string }
      message?: string
    }
    try {
      payload = JSON.parse(data)
    } catch {
      return
    }
    const type = payload.type ?? eventName
    if (type === 'response.output_text.delta' && typeof payload.delta === 'string') {
      streamedText += payload.delta
      options.onTextDelta?.(payload.delta)
    } else if (type === 'response.output_item.done' && payload.item) {
      doneItems.push(payload.item)
    } else if (type === 'response.completed') {
      completed = true
      if (Array.isArray(payload.response?.output)) {
        completedOutput = payload.response.output
      }
    } else if (type === 'response.incomplete') {
      throw new Error('OpenAI returned an incomplete response.')
    } else if (type === 'response.failed') {
      throw new Error(payload.response?.error?.message ?? 'OpenAI reported a failure.')
    } else if (type === 'error') {
      throw new Error(payload.error?.message ?? payload.message ?? 'OpenAI reported an error.')
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    let index = buffer.search(/\r?\n\r?\n/)
    while (index !== -1) {
      handle(buffer.slice(0, index))
      buffer = buffer.slice(index).replace(/^\r?\n\r?\n/, '')
      index = buffer.search(/\r?\n\r?\n/)
    }
  }
  if (buffer.trim()) {
    handle(buffer)
  }

  if (!completed) {
    throw new Error('The OpenAI stream ended before the response completed.')
  }
  const output = completedOutput ?? doneItems
  const text =
    output
      .filter((item) => item.type === 'message')
      .map(textOfMessage)
      .join('') || streamedText
  return { output, text, sources: citedSources(output) }
}
