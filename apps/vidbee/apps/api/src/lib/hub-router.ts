/**
 * Host glue (NOT upstream code): transcript + AI endpoints for the web UI.
 *
 * Upstream ships the transcript viewer and AI prompts only in its Electron desktop app. These routes expose the
 * same data to the web client using upstream's own building blocks:
 *   - @vidbee/transcription  TranscriptStore, enqueueTranscription, findActiveTranscription
 *   - @vidbee/task-queue     task list / kinds
 *   - ../upstream/*          unmodified desktop shared modules (built-in prompts, provider presets, exporters)
 * Mounted under /hub (proxied by the web server alongside /rpc, /events, /files).
 */
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { TRANSCRIBABLE_TASK_KINDS, type Task } from '@vidbee/task-queue'
import {
  enqueueTranscription,
  findActiveTranscription,
  listTranscriptionChildren,
  type TranscriptRecord
} from '@vidbee/transcription'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { AI_PROVIDER_PRESETS, getAiProviderPreset, resolveAiProviderBaseUrl } from '../upstream/ai-presets'
import { agentChatPrompt, createDefaultAiPrompts, resolveAiPromptContent } from '../upstream/ai-prompts'
import { resolveTaskSourceFile } from '../upstream/source-file'
import { buildVttDocument } from '../upstream/subtitle-export'
import { buildTranscriptExportText } from '../upstream/transcript-export'
import { apiDataDir } from './api-paths'
import { getDatabaseConnection } from './database'
import { taskQueue, transcriptStore } from './task-queue-host'

const MEDIA_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac'
}
const AUDIO_EXT = /\.(mp3|m4a|opus|ogg|wav|flac|aac)$/i
/** Same wording as the desktop prompt runner so results match across surfaces. */
const SYSTEM_PROMPT = [
  "You are VidBee's transcript assistant. Follow the instruction exactly.",
  'Reply in Markdown. Use the same language as the transcript unless the instruction says otherwise.',
  'Keep each list marker on the same line as the item text.',
  'Do not wrap the whole reply in a code fence unless the instruction asks for a mermaid diagram. Do not add a preamble or closing remarks.'
].join(' ')
const MAX_TRANSCRIPT_CHARS = 120_000
const LANG_CODE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/

/* ───────── AI settings (server-side, shared by the allow-listed users of this instance) ───────── */

interface AiSettings {
  apiKey: string
  baseUrl: string
  model: string
  presetId: string
}
const settingsFile = path.join(apiDataDir, 'hub-ai-settings.json')
const loadAiSettings = (): AiSettings => {
  let saved: Partial<AiSettings> = {}
  try {
    saved = JSON.parse(readFileSync(settingsFile, 'utf8')) as Partial<AiSettings>
  } catch {
    /* first run */
  }
  return {
    presetId: saved.presetId ?? 'openai',
    baseUrl: saved.baseUrl ?? '',
    model: saved.model ?? '',
    apiKey: saved.apiKey ?? process.env.VIDBEE_AI_API_KEY ?? ''
  }
}
const publicAiSettings = (s: AiSettings) => ({
  presetId: s.presetId,
  baseUrl: s.baseUrl,
  model: s.model,
  hasApiKey: Boolean(s.apiKey)
})

/* ───────── transcript helpers ───────── */

const httpError = (reply: FastifyReply, status: number, message: string) => reply.code(status).send({ message })

const stateFor = (id: string) => {
  const active = findActiveTranscription(taskQueue, id)
  const latest = listTranscriptionChildren(taskQueue, id)[0]
  const record = transcriptStore.getLatestForDownload(id)
  if (active) {
    return { state: 'running' as const, stage: (active.progress as { stage?: string } | undefined)?.stage ?? active.status, error: null }
  }
  if (record) {
    return { state: record.resultKind === 'no-speech' ? ('no-speech' as const) : ('ready' as const), stage: null, error: null }
  }
  if (latest && (latest.status === 'failed' || latest.status === 'cancelled')) {
    const message = (latest.lastError as { message?: string } | null)?.message ?? latest.statusReason
    return { state: 'failed' as const, stage: null, error: message ?? 'Transcription failed' }
  }
  return { state: 'none' as const, stage: null, error: null }
}

const downloadFor = (id: string): Task | null => {
  const task = taskQueue.get(id)
  return task && TRANSCRIBABLE_TASK_KINDS.has(task.kind) ? task : null
}

const viewRecord = (record: TranscriptRecord) => ({
  id: record.id,
  language: record.language,
  sourceKind: record.sourceKind,
  resultKind: record.resultKind,
  updatedAt: record.updatedAt,
  speakers: record.speakers.map((s) => ({ id: s.id, key: s.speakerKey, name: s.displayName })),
  segments: record.segments.map((s) => ({ id: s.id, speakerId: s.speakerId, startMs: s.startMs, endMs: s.endMs, text: s.text }))
})

const speakerName = (record: TranscriptRecord) => (speakerId: string | null) =>
  record.speakers.find((s) => s.id === speakerId)?.displayName ?? ''

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** `[m:ss] Speaker: text` lines, the format upstream's built-in prompts are written against. */
const transcriptForPrompt = (record: TranscriptRecord): string => {
  const name = speakerName(record)
  const last = record.segments.at(-1)
  const lines = record.segments.map((s) => `[${clock(s.startMs)}] ${name(s.speakerId) ? `${name(s.speakerId)}: ` : ''}${s.text}`)
  let body = lines.join('\n')
  if (body.length > MAX_TRANSCRIPT_CHARS) {
    body = `${body.slice(0, MAX_TRANSCRIPT_CHARS)}\n[transcript truncated]`
  }
  return `${last ? `Duration: ${clock(last.endMs)}\n` : ''}${body}`
}

/* ───────── LLM call (OpenAI-compatible or Anthropic) ───────── */

const callModel = async (
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> => {
  const settings = loadAiSettings()
  const preset = getAiProviderPreset(settings.presetId)
  if (!preset) {
    throw new Error(`Unknown AI provider: ${settings.presetId}`)
  }
  const model = settings.model || preset.defaultModel
  if (!model) {
    throw new Error('Choose a model in AI settings.')
  }
  if (preset.needsApiKey && !settings.apiKey) {
    throw new Error('Add your AI provider API key in AI settings.')
  }
  const base = resolveAiProviderBaseUrl(preset, settings.baseUrl).replace(/\/+$/, '')
  if (!/^https?:\/\//.test(base)) {
    throw new Error('AI base URL must be http(s).')
  }
  const isAnthropic = preset.id === 'anthropic'
  const response = await fetch(isAnthropic ? `${base}/v1/messages` : `${base}/chat/completions`, {
    method: 'POST',
    headers: isAnthropic
      ? { 'content-type': 'application/json', 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01' }
      : { 'content-type': 'application/json', ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}) },
    body: JSON.stringify(
      isAnthropic
        ? { model, max_tokens: 4096, system, messages }
        : { model, messages: [{ role: 'system', content: system }, ...messages] }
    ),
    signal: AbortSignal.timeout(180_000)
  })
  const body = (await response.json().catch(() => ({}))) as {
    content?: Array<{ text?: string }>
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}): ${body.error?.message ?? 'error'}`)
  }
  return (isAnthropic ? (body.content ?? []).map((c) => c.text ?? '').join('') : body.choices?.[0]?.message?.content) ?? ''
}

/* ───────── routes ───────── */

export const registerHubRoutes = (fastify: FastifyInstance): void => {
  // Library: completed downloads that can be transcribed, with their transcript state.
  fastify.get('/hub/library', async () => {
    const items: unknown[] = []
    let cursor: string | null = null
    do {
      const page = taskQueue.list({ limit: 200, cursor })
      for (const task of page.tasks) {
        if (!TRANSCRIBABLE_TASK_KINDS.has(task.kind) || task.status !== 'completed') {
          continue
        }
        const file = resolveTaskSourceFile(task)
        if (!file) {
          continue
        }
        items.push({
          id: task.id,
          title: task.input.title || path.basename(file),
          url: task.input.url ?? null,
          mediaKind: AUDIO_EXT.test(file) ? 'audio' : 'video',
          createdAt: task.createdAt,
          ...stateFor(task.id)
        })
      }
      cursor = page.nextCursor
    } while (cursor)
    return { items }
  })

  fastify.get<{ Params: { id: string } }>('/hub/transcripts/:id', async (request, reply) => {
    const download = downloadFor(request.params.id)
    if (!download) {
      return httpError(reply, 404, 'Download not found.')
    }
    const record = transcriptStore.getLatestForDownload(download.id)
    return {
      id: download.id,
      title: download.input.title ?? null,
      mediaKind: AUDIO_EXT.test(resolveTaskSourceFile(download) ?? '') ? 'audio' : 'video',
      ...stateFor(download.id),
      record: record ? viewRecord(record) : null
    }
  })

  fastify.post<{ Params: { id: string }; Body: { force?: boolean; language?: string } }>(
    '/hub/transcripts/:id/start',
    async (request, reply) => {
      const download = downloadFor(request.params.id)
      const source = download ? resolveTaskSourceFile(download) : null
      if (!(download && source)) {
        return httpError(reply, 404, 'Download or media file not found.')
      }
      const language = LANG_CODE.test(request.body?.language ?? '') ? request.body?.language : undefined
      try {
        await enqueueTranscription({
          queue: taskQueue,
          store: transcriptStore,
          downloadTaskId: download.id,
          sourceFilePath: source,
          title: download.input.title,
          trigger: request.body?.force ? 'force' : 'manual',
          language
        })
      } catch (error) {
        return httpError(reply, 400, error instanceof Error ? error.message : 'Could not start transcription.')
      }
      return { ok: true, ...stateFor(download.id) }
    }
  )

  fastify.post<{ Params: { id: string }; Body: { speakerId?: string; name?: string } }>(
    '/hub/transcripts/:id/speakers',
    async (request, reply) => {
      const record = transcriptStore.getLatestForDownload(request.params.id)
      const speakerId = request.body?.speakerId
      const name = request.body?.name?.trim().slice(0, 80)
      if (!(record && speakerId && name && record.speakers.some((s) => s.id === speakerId))) {
        return httpError(reply, 400, 'Unknown speaker or empty name.')
      }
      // Same relabel the desktop does: only the display name changes, never the text.
      getDatabaseConnection()
        .sqlite.prepare('UPDATE transcript_speakers SET display_name = ? WHERE id = ? AND transcript_id = ?')
        .run(name, speakerId, record.id)
      return { ok: true }
    }
  )

  fastify.get<{ Params: { id: string }; Querystring: { format?: string } }>(
    '/hub/transcripts/:id/export',
    async (request, reply) => {
      const record = transcriptStore.getLatestForDownload(request.params.id)
      if (!record) {
        return httpError(reply, 404, 'No transcript yet.')
      }
      const format = request.query.format ?? 'txt'
      if (!['txt', 'md', 'srt', 'vtt'].includes(format)) {
        return httpError(reply, 400, 'format must be txt, md, srt or vtt.')
      }
      const resolveSpeaker = speakerName(record)
      const text =
        format === 'vtt'
          ? buildVttDocument(record.segments.map((s) => ({ startMs: s.startMs, endMs: s.endMs, text: `${resolveSpeaker(s.speakerId) ? `${resolveSpeaker(s.speakerId)}: ` : ''}${s.text}` })))
          : buildTranscriptExportText({
              format: format as 'txt' | 'md' | 'srt',
              grouping: 'none',
              resolveSpeaker,
              segments: record.segments,
              showTimestamp: true,
              // Upstream's "segments" style is the one that prints speaker names; SRT stays speaker-free like upstream.
              style: format === 'srt' ? 'subtitles' : record.speakers.length > 0 ? 'segments' : 'transcript'
            })
      reply.header('content-type', 'text/plain; charset=utf-8')
      reply.header('content-disposition', `attachment; filename="transcript.${format}"`)
      return text
    }
  )

  // Media for the in-page player, with HTTP Range so seeking works (upstream's /files is download-only).
  fastify.get<{ Params: { id: string } }>('/hub/media/:id', async (request, reply) => {
    const download = downloadFor(request.params.id)
    const file = download ? resolveTaskSourceFile(download) : null
    if (!(download && file && existsSync(file))) {
      return httpError(reply, 404, 'Media not available.')
    }
    const size = statSync(file).size
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(request.headers.range ?? ''))
    let start = 0
    let end = size - 1
    if (range && (range[1] || range[2])) {
      if (range[1] === '') {
        start = Math.max(0, size - Number(range[2]))
      } else {
        start = Number(range[1])
        end = range[2] ? Math.min(end, Number(range[2])) : end
      }
      if (start > end || start >= size) {
        return reply.code(416).header('content-range', `bytes */${size}`).send()
      }
      reply.code(206).header('content-range', `bytes ${start}-${end}/${size}`)
    }
    reply
      .header('content-type', MEDIA_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
      .header('accept-ranges', 'bytes')
      .header('content-length', String(end - start + 1))
    return reply.send(createReadStream(file, { start, end }))
  })

  /* AI */
  fastify.get('/hub/ai/config', async () => ({
    settings: publicAiSettings(loadAiSettings()),
    providers: AI_PROVIDER_PRESETS.map((p) => ({ id: p.id, defaultModel: p.defaultModel, needsApiKey: p.needsApiKey, requiresBaseUrl: p.requiresBaseUrl })),
    // Built-in skills from upstream (Overview, Translate, Generate FAQ, Mindmap, …).
    prompts: createDefaultAiPrompts().map((p) => ({ name: p.name, description: p.description ?? '' }))
  }))

  fastify.post<{ Body: Partial<AiSettings> }>('/hub/ai/settings', async (request, reply) => {
    const current = loadAiSettings()
    const body = request.body ?? {}
    if (body.presetId !== undefined && !getAiProviderPreset(body.presetId)) {
      return httpError(reply, 400, 'Unknown provider.')
    }
    const next: AiSettings = {
      presetId: body.presetId ?? current.presetId,
      baseUrl: (body.baseUrl ?? current.baseUrl).trim(),
      model: (body.model ?? current.model).trim(),
      // An omitted key keeps the saved one; an empty string clears it.
      apiKey: body.apiKey === undefined ? current.apiKey : body.apiKey.trim()
    }
    writeFileSync(settingsFile, JSON.stringify(next), { mode: 0o600 })
    return { settings: publicAiSettings(next) }
  })

  fastify.post<{ Body: { downloadId?: string; prompt?: string; language?: string } }>('/hub/ai/run', async (request, reply) => {
    const record = transcriptStore.getLatestForDownload(request.body?.downloadId ?? '')
    const prompt = createDefaultAiPrompts().find((p) => p.name === request.body?.prompt)
    const language = LANG_CODE.test(request.body?.language ?? '') ? (request.body?.language as string) : 'en'
    if (!(record && prompt)) {
      return httpError(reply, 400, 'Transcribe first, and pick a built-in prompt.')
    }
    try {
      const instruction = resolveAiPromptContent(prompt.content, language)
      const text = await callModel(SYSTEM_PROMPT, [{ role: 'user', content: `${instruction}\n\nTRANSCRIPT:\n${transcriptForPrompt(record)}` }])
      return { text }
    } catch (error) {
      return httpError(reply, 502, error instanceof Error ? error.message : 'AI request failed.')
    }
  })

  fastify.post<{ Body: { downloadId?: string; messages?: Array<{ role?: string; content?: string }>; language?: string } }>(
    '/hub/ai/chat',
    async (request, reply) => {
      const record = transcriptStore.getLatestForDownload(request.body?.downloadId ?? '')
      const history = (request.body?.messages ?? [])
        .slice(-20)
        .filter((m): m is { role: 'user' | 'assistant'; content: string } => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      if (!record || history.at(-1)?.role !== 'user') {
        return httpError(reply, 400, 'Transcribe first and send a user message.')
      }
      const language = LANG_CODE.test(request.body?.language ?? '') ? (request.body?.language as string) : 'en'
      // Upstream's chat instruction, minus its tool-use sentence: the web chat has no tools, only the transcript.
      const instruction = resolveAiPromptContent(agentChatPrompt(Date.now(), true).content, language)
        .split('\n')
        .filter((line) => !line.startsWith('Use tools'))
        .join('\n')
      try {
        const text = await callModel(`${instruction}\nOnly the transcript below is available; cite [m:ss] timestamps.\n\nTRANSCRIPT:\n${transcriptForPrompt(record)}`, history)
        return { text }
      } catch (error) {
        return httpError(reply, 502, error instanceof Error ? error.message : 'AI request failed.')
      }
    }
  )
}
