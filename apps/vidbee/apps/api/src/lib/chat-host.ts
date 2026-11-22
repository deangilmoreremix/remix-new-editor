/**
 * Chat about a download's transcript, using OpenAI function calling on the Responses API.
 *
 * The model can call read-only tools over the stored transcripts. Each turn runs a short
 * loop on the server: call the model, run any function calls it asks for, send the results
 * back, and stop when it answers in text (or after MAX_ROUNDS). Only user and assistant text
 * and tool labels are kept between turns; the tool-call items of the turn in progress are
 * replayed verbatim inside that turn only.
 */
import type { WebChat, WebChatMessage, WebChatStatus } from '@vidbee/transcription/web-contract'
import { getDatabaseConnection } from './database'
import { chatChannel, publishLive } from './live-events'
import { createResponse, type OutputItem, requireOpenAiConfig } from './openai-responses'
import { getTranscriptDetail, getTranscriptStatusMap } from './transcripts-host'

const MAX_ROUNDS = 6
const MAX_HISTORY = 30
const MAX_TOOL_CHARS = 30_000

const { sqlite } = getDatabaseConnection()
sqlite.exec(`
CREATE TABLE IF NOT EXISTS web_chats (
  download_id TEXT PRIMARY KEY,
  messages    TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);`)

const INSTRUCTIONS = [
  'You answer questions about videos in the user\'s VidBee library using their transcripts.',
  'Use the tools to read or search transcripts instead of guessing. Do not invent quotes or timestamps.',
  'Cite moments as [m:ss] or [h:mm:ss] using timestamps returned by the tools.',
  'If the transcript does not contain the answer, say so. Reply in the language of the user\'s latest message.'
].join('\n')

// ---------- tools ----------

const clock = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

const TOOLS = [
  {
    type: 'function',
    name: 'list_transcripts',
    description: 'List downloads that have a transcript or transcription state in the library.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true
  },
  {
    type: 'function',
    name: 'get_video_info',
    description: 'Get title, language, duration, speakers and segment count for a download.',
    parameters: {
      type: 'object',
      properties: { download_id: { type: ['string', 'null'], description: 'Defaults to the current download.' } },
      required: ['download_id'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'read_transcript',
    description:
      'Read transcript lines as "[m:ss] Speaker: text". Optionally limit to a time range in seconds.',
    parameters: {
      type: 'object',
      properties: {
        download_id: { type: ['string', 'null'], description: 'Defaults to the current download.' },
        from_seconds: { type: ['number', 'null'] },
        to_seconds: { type: ['number', 'null'] }
      },
      required: ['download_id', 'from_seconds', 'to_seconds'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'search_transcript',
    description: 'Find transcript lines containing a word or phrase (case-insensitive).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        download_id: { type: ['string', 'null'], description: 'Defaults to the current download.' },
        limit: { type: ['integer', 'null'], description: 'Maximum hits, default 20.' }
      },
      required: ['query', 'download_id', 'limit'],
      additionalProperties: false
    },
    strict: true
  }
]

const cap = (value: unknown): string => {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > MAX_TOOL_CHARS
    ? `${text.slice(0, MAX_TOOL_CHARS)}\n[truncated: ${text.length - MAX_TOOL_CHARS} more characters; narrow the time range or search instead]`
    : text
}

const loadRecord = (downloadId: string) => {
  const detail = getTranscriptDetail(downloadId)
  if (!detail.record || detail.record.segments.length === 0) {
    throw new Error(`No transcript available for ${downloadId}.`)
  }
  const names = new Map(detail.record.speakers.map((s) => [s.id, s.displayName.trim()]))
  const segments = [...detail.record.segments].sort((a, b) => a.sortIndex - b.sortIndex)
  return { detail, names, segments }
}

const lineOf = (
  segment: { startMs: number; speakerId: string | null; text: string },
  names: Map<string, string>
): string => {
  const who = segment.speakerId ? names.get(segment.speakerId) : ''
  return `[${clock(segment.startMs)}] ${who ? `${who}: ` : ''}${segment.text.trim()}`
}

const runTool = (name: string, args: Record<string, unknown>, currentId: string): string => {
  const target = typeof args.download_id === 'string' && args.download_id ? args.download_id : currentId
  if (name === 'list_transcripts') {
    return cap(
      Object.values(getTranscriptStatusMap())
        .slice(0, 100)
        .map((s) => ({
          download_id: s.downloadId,
          title: s.title,
          state: s.state,
          language: s.language,
          segments: s.segmentCount
        }))
    )
  }
  if (name === 'get_video_info') {
    const { detail, names, segments } = loadRecord(target)
    return cap({
      download_id: target,
      title: detail.title,
      language: detail.language,
      source: detail.sourceKind,
      duration: clock(segments.reduce((max, s) => Math.max(max, s.endMs), 0)),
      speakers: [...names.values()],
      segments: segments.length
    })
  }
  if (name === 'read_transcript') {
    const { names, segments } = loadRecord(target)
    const from = typeof args.from_seconds === 'number' ? args.from_seconds * 1000 : 0
    const to = typeof args.to_seconds === 'number' ? args.to_seconds * 1000 : Number.POSITIVE_INFINITY
    return cap(
      segments
        .filter((s) => s.endMs >= from && s.startMs <= to)
        .map((s) => lineOf(s, names))
        .join('\n')
    )
  }
  if (name === 'search_transcript') {
    const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : ''
    if (!query) {
      throw new Error('query is required')
    }
    const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 100) : 20
    const { names, segments } = loadRecord(target)
    return cap(
      segments
        .filter((s) => s.text.toLowerCase().includes(query))
        .slice(0, limit)
        .map((s) => lineOf(s, names))
        .join('\n') || 'No matches.'
    )
  }
  throw new Error(`Unknown tool: ${name}`)
}

// ---------- state ----------

const live = new Map<
  string,
  { status: WebChatStatus; partial: string; error: string | null; controller: AbortController }
>()

const readMessages = (downloadId: string): WebChatMessage[] => {
  const row = sqlite
    .prepare('SELECT messages FROM web_chats WHERE download_id = ?')
    .get(downloadId) as { messages: string } | undefined
  try {
    return row ? (JSON.parse(row.messages) as WebChatMessage[]) : []
  } catch {
    return []
  }
}

const writeMessages = (downloadId: string, messages: WebChatMessage[]): void => {
  sqlite
    .prepare(
      `INSERT INTO web_chats (download_id, messages, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(download_id) DO UPDATE SET messages = excluded.messages, updated_at = excluded.updated_at`
    )
    .run(downloadId, JSON.stringify(messages.slice(-200)), Date.now())
}

export const getChat = (downloadId: string): WebChat => {
  const state = live.get(downloadId)
  return {
    downloadId,
    status: state?.status ?? 'idle',
    messages: readMessages(downloadId),
    partial: state?.partial ?? '',
    error: state?.error ?? null,
    updatedAt: Date.now()
  }
}

export const resetChat = (downloadId: string): WebChat => {
  live.get(downloadId)?.controller.abort()
  live.delete(downloadId)
  sqlite.prepare('DELETE FROM web_chats WHERE download_id = ?').run(downloadId)
  return getChat(downloadId)
}

export const cancelChat = (downloadId: string): WebChat => {
  live.get(downloadId)?.controller.abort()
  return getChat(downloadId)
}

const textOf = (item: OutputItem): string => {
  const content = item.content
  return Array.isArray(content)
    ? content
        .map((p) => ((p as { type?: string }).type === 'output_text' ? String((p as { text?: unknown }).text ?? '') : ''))
        .join('')
    : ''
}

export const sendChat = (downloadId: string, message: string): WebChat => {
  const text = message.trim()
  if (!text) {
    throw new Error('Type a message first.')
  }
  if (live.get(downloadId)?.status === 'running') {
    throw new Error('The assistant is still answering.')
  }
  requireOpenAiConfig()
  const controller = new AbortController()
  const state = { status: 'running' as WebChatStatus, partial: '', error: null as string | null, controller }
  live.set(downloadId, state)
  const channel = chatChannel(downloadId)

  const history = readMessages(downloadId)
  history.push({ role: 'user', text })
  writeMessages(downloadId, history)
  queueMicrotask(() => publishLive(channel, 'state', getChat(downloadId)))

  void (async () => {
    try {
      // Input for this turn: earlier user/assistant text, then items produced during the loop.
      const input: Array<Record<string, unknown>> = history
        .filter((m) => m.role !== 'tool')
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.text }))
      const notes: WebChatMessage[] = []
      let answer = ''
      for (let round = 0; round < MAX_ROUNDS; round++) {
        state.partial = ''
        const result = await createResponse({
          body: {
            instructions: `${INSTRUCTIONS}\nThe user is viewing download id: ${downloadId}.`,
            input,
            tools: TOOLS,
            tool_choice: 'auto'
          },
          signal: controller.signal,
          onTextDelta: (delta) => {
            state.partial += delta
            publishLive(channel, 'delta', { delta })
          }
        })
        const calls = result.output.filter((item) => item.type === 'function_call')
        if (calls.length === 0) {
          answer = result.output
            .filter((item) => item.type === 'message')
            .map(textOf)
            .join('')
          answer = answer || result.text
          break
        }
        input.push(...result.output)
        for (const call of calls) {
          const name = String(call.name)
          let args: Record<string, unknown> = {}
          let output: string
          try {
            args = JSON.parse(String(call.arguments || '{}')) as Record<string, unknown>
            output = runTool(name, args, downloadId)
          } catch (error) {
            output = `Error: ${error instanceof Error ? error.message : 'tool failed'}`
          }
          notes.push({ role: 'tool', text: `${name}(${JSON.stringify(args)})` })
          input.push({ type: 'function_call_output', call_id: call.call_id, output })
          publishLive(channel, 'state', { ...getChat(downloadId), messages: [...history, ...notes] })
        }
        state.partial = ''
        if (round === MAX_ROUNDS - 1) {
          answer = 'I used too many tool steps without reaching an answer. Try a narrower question.'
        }
      }
      writeMessages(downloadId, [...history, ...notes, { role: 'assistant', text: answer || '(no answer)' }])
      state.status = 'idle'
      state.partial = ''
      publishLive(channel, 'state', getChat(downloadId))
    } catch (error) {
      if (controller.signal.aborted) {
        state.status = 'idle'
        state.partial = ''
        publishLive(channel, 'state', getChat(downloadId))
        return
      }
      state.status = 'failed'
      state.error = error instanceof Error ? error.message : 'Chat failed.'
      publishLive(channel, 'state', getChat(downloadId))
    }
  })()

  return getChat(downloadId)
}
