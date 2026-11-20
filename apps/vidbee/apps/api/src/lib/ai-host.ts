/**
 * OpenAI-backed AI summaries for the web/API surface.
 *
 * Each skill is one of upstream's `skills/<id>/SKILL.md` prompts. A run sends the
 * skill body as `instructions` and the transcript as `input` to the OpenAI Responses
 * API (`POST {baseUrl}/responses`, streamed) and stores the result per
 * (download, skill) in the `transcript_prompt_runs` table that upstream already defines.
 *
 * The API key stays on the server: it comes from `OPENAI_API_KEY` or `ai-settings.json`
 * in the data directory, and is never returned to the browser.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROMPT_RUN_DDL_V1 } from '@vidbee/db/prompt-runs'
import type {
  WebAiRun,
  WebAiRunStatus,
  WebAiSettings,
  WebAiSkill
} from '@vidbee/transcription/web-contract'
import { apiDataDir, trimEnv } from './api-paths'
import { getDatabaseConnection } from './database'
import { getTranscriptDetail } from './transcripts-host'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4.1-mini'
/** Refuse rather than silently truncate: one request must hold the whole transcript. */
const MAX_TRANSCRIPT_CHARS = Number(trimEnv('VIDBEE_AI_MAX_TRANSCRIPT_CHARS')) || 400_000

/** Upstream skills that are plain prompts. Tool-driven skills (translate, rewrite, diagnose) are excluded. */
const PROMPT_SKILL_IDS = [
  'overview',
  'bullet-points',
  'create-mindmap',
  'generate-faq',
  'extract-statistics',
  'improve-grammar',
  'paraphrase-content'
]

// ---------- settings ----------

interface StoredAiSettings {
  apiKey?: string
  baseUrl?: string
  model?: string
}

const settingsFile = path.join(apiDataDir, 'ai-settings.json')

const readStored = (): StoredAiSettings => {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, 'utf-8')) as StoredAiSettings
  } catch {
    return {}
  }
}

const effective = () => {
  const stored = readStored()
  const envKey = trimEnv('OPENAI_API_KEY')
  const storedKey = stored.apiKey?.trim() || undefined
  return {
    apiKey: storedKey ?? envKey,
    keyFromEnv: !storedKey && Boolean(envKey),
    baseUrl: (stored.baseUrl?.trim() || trimEnv('OPENAI_BASE_URL') || DEFAULT_BASE_URL).replace(
      /\/+$/,
      ''
    ),
    model: stored.model?.trim() || trimEnv('VIDBEE_OPENAI_MODEL') || DEFAULT_MODEL
  }
}

export const getAiSettings = (): WebAiSettings => {
  const current = effective()
  return {
    baseUrl: current.baseUrl,
    hasApiKey: Boolean(current.apiKey),
    apiKeyHint: current.apiKey ? current.apiKey.slice(-4) : null,
    keyFromEnv: current.keyFromEnv,
    model: current.model
  }
}

export const setAiSettings = (input: {
  apiKey?: string
  clearApiKey?: boolean
  baseUrl?: string
  model?: string
}): WebAiSettings => {
  const stored = readStored()
  if (input.clearApiKey) {
    stored.apiKey = undefined
  } else if (input.apiKey?.trim()) {
    stored.apiKey = input.apiKey.trim()
  }
  if (input.baseUrl !== undefined) {
    const value = input.baseUrl.trim()
    if (value && !/^https?:\/\//i.test(value)) {
      throw new Error('Base URL must start with http:// or https://')
    }
    stored.baseUrl = value || undefined
  }
  if (input.model !== undefined) {
    stored.model = input.model.trim() || undefined
  }
  fs.mkdirSync(apiDataDir, { recursive: true })
  fs.writeFileSync(settingsFile, JSON.stringify(stored), { encoding: 'utf-8', mode: 0o600 })
  return getAiSettings()
}

// ---------- skills ----------

const here = path.dirname(fileURLToPath(import.meta.url))
const skillsDirCandidates = [
  trimEnv('VIDBEE_SKILLS_DIR'),
  path.resolve(here, '../../../../skills'),
  path.resolve(process.cwd(), 'skills'),
  path.resolve(process.cwd(), '../../skills')
].filter((value): value is string => Boolean(value))

const skillsDir = (): string | null =>
  skillsDirCandidates.find((dir) => fs.existsSync(path.join(dir, 'overview', 'SKILL.md'))) ?? null

interface LoadedSkill extends WebAiSkill {
  body: string
}

const parseSkill = (id: string, raw: string): LoadedSkill => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  const front = match?.[1] ?? ''
  const body = (match?.[2] ?? raw).trim()
  const field = (key: string): string => {
    const line = front.split(/\r?\n/).find((l) => l.startsWith(`${key}:`))
    return (line?.slice(key.length + 1).trim() ?? '').replace(/^["']|["']$/g, '')
  }
  return { id, name: field('name') || id, description: field('description'), body }
}

const loadSkills = (): LoadedSkill[] => {
  const dir = skillsDir()
  if (!dir) {
    return []
  }
  const out: LoadedSkill[] = []
  for (const id of PROMPT_SKILL_IDS) {
    const file = path.join(dir, id, 'SKILL.md')
    if (fs.existsSync(file)) {
      out.push(parseSkill(id, fs.readFileSync(file, 'utf-8')))
    }
  }
  return out
}

export const listAiSkills = (): WebAiSkill[] =>
  loadSkills().map(({ id, name, description }) => ({ id, name, description }))

// ---------- run storage ----------

const { sqlite } = getDatabaseConnection()
sqlite.exec(PROMPT_RUN_DDL_V1)

interface RunRow {
  download_id: string
  prompt_id: string
  status: string
  text: string
  error: string | null
  updated_at: number
}

const live = new Map<string, { run: WebAiRun; controller: AbortController }>()
const keyOf = (downloadId: string, skillId: string): string => `${downloadId}\u0000${skillId}`

const fromRow = (row: RunRow): WebAiRun => ({
  downloadId: row.download_id,
  skillId: row.prompt_id,
  status: row.status as WebAiRunStatus,
  text: row.text,
  error: row.error,
  model: null,
  updatedAt: row.updated_at
})

const save = (run: WebAiRun, createdAt: number): void => {
  sqlite
    .prepare(
      `INSERT INTO transcript_prompt_runs (download_id, prompt_id, status, text, error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(download_id, prompt_id) DO UPDATE SET
         status = excluded.status, text = excluded.text, error = excluded.error, updated_at = excluded.updated_at`
    )
    .run(run.downloadId, run.skillId, run.status, run.text, run.error, createdAt, run.updatedAt)
}

export const getAiRun = (downloadId: string, skillId: string): WebAiRun | null => {
  const inMemory = live.get(keyOf(downloadId, skillId))
  if (inMemory) {
    return { ...inMemory.run }
  }
  const row = sqlite
    .prepare('SELECT * FROM transcript_prompt_runs WHERE download_id = ? AND prompt_id = ?')
    .get(downloadId, skillId) as RunRow | undefined
  return row ? fromRow(row) : null
}

export const listAiRuns = (downloadId: string): WebAiRun[] => {
  const rows = sqlite
    .prepare('SELECT * FROM transcript_prompt_runs WHERE download_id = ? ORDER BY updated_at DESC')
    .all(downloadId) as RunRow[]
  return rows.map((row) => getAiRun(row.download_id, row.prompt_id) ?? fromRow(row))
}

/**
 * Mark runs left `running` by a previous process as failed, so the UI is not stuck.
 */
export const failInterruptedAiRuns = (): void => {
  sqlite
    .prepare(
      `UPDATE transcript_prompt_runs
       SET status = 'failed', error = 'Interrupted by a server restart', updated_at = ?
       WHERE status = 'running'`
    )
    .run(Date.now())
}

// ---------- transcript text ----------

const clock = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** Overview needs `[m:ss]` stamps; the other prompts take plain speaker lines, as upstream does. */
const buildTranscriptText = (downloadId: string, timestamps: boolean): string => {
  const detail = getTranscriptDetail(downloadId)
  const record = detail.record
  if (!record || record.segments.length === 0) {
    throw new Error('No transcript yet. Transcribe this download first.')
  }
  const names = new Map(record.speakers.map((s) => [s.id, s.displayName.trim()]))
  const lines = [...record.segments]
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((segment) => {
      const text = segment.text.trim()
      if (!text) {
        return ''
      }
      const who = segment.speakerId ? names.get(segment.speakerId) : ''
      const body = who ? `${who}: ${text}` : text
      return timestamps ? `[${clock(segment.startMs)}] ${body}` : body
    })
    .filter(Boolean)
  const last = record.segments.reduce((max, s) => Math.max(max, s.endMs), 0)
  const header = [
    detail.title ? `Title: ${detail.title}` : '',
    timestamps && last > 0 ? `Duration: ${clock(last)}` : ''
  ].filter(Boolean)
  const text = lines.join('\n')
  return header.length > 0 ? `${header.join('\n')}\n\n${text}` : text
}

// ---------- OpenAI Responses call ----------

const errorFromResponse = async (response: Response): Promise<string> => {
  const raw = await response.text().catch(() => '')
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } }
    if (parsed.error?.message) {
      return `OpenAI error ${response.status}: ${parsed.error.message}`
    }
  } catch {
    // fall through to the generic message
  }
  return `OpenAI error ${response.status}${raw ? `: ${raw.slice(0, 300)}` : ''}`
}

/** Read an SSE stream and call `onDelta` for each `response.output_text.delta`. */
const streamResponses = async (
  response: Response,
  onDelta: (delta: string) => void
): Promise<void> => {
  if (!response.body) {
    throw new Error('OpenAI returned an empty response body.')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
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
    if (dataLines.length === 0) {
      return
    }
    const data = dataLines.join('\n')
    if (data === '[DONE]') {
      return
    }
    let payload: { type?: string; delta?: string; error?: { message?: string }; message?: string }
    try {
      payload = JSON.parse(data)
    } catch {
      return
    }
    const type = payload.type ?? eventName
    if (type === 'response.output_text.delta' && typeof payload.delta === 'string') {
      onDelta(payload.delta)
    } else if (type === 'response.failed' || type === 'error') {
      throw new Error(payload.error?.message ?? payload.message ?? 'OpenAI reported a failure.')
    }
  }
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
}

export const startAiRun = (input: {
  downloadId: string
  skillId: string
  language?: string
}): WebAiRun => {
  const skill = loadSkills().find((item) => item.id === input.skillId)
  if (!skill) {
    throw new Error(`Unknown skill: ${input.skillId}`)
  }
  const settings = effective()
  if (!settings.apiKey) {
    throw new Error('Add an OpenAI API key in AI settings first.')
  }
  const key = keyOf(input.downloadId, input.skillId)
  if (live.has(key)) {
    throw new Error('This summary is already running.')
  }
  const transcript = buildTranscriptText(input.downloadId, skill.id === 'overview')
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    throw new Error(
      `This transcript is too long for one request (${transcript.length} characters, limit ${MAX_TRANSCRIPT_CHARS}).`
    )
  }
  const instructions = skill.body.replaceAll('{{uiLanguage}}', input.language?.trim() || 'English')
  const controller = new AbortController()
  const createdAt = Date.now()
  const run: WebAiRun = {
    downloadId: input.downloadId,
    skillId: input.skillId,
    status: 'running',
    text: '',
    error: null,
    model: settings.model,
    updatedAt: createdAt
  }
  live.set(key, { run, controller })
  save(run, createdAt)

  const finish = (status: WebAiRunStatus, error: string | null): void => {
    run.status = status
    run.error = error
    run.updatedAt = Date.now()
    save(run, createdAt)
    live.delete(key)
  }

  void (async () => {
    try {
      const response = await fetch(`${settings.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${settings.apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: settings.model,
          instructions,
          input: transcript,
          stream: true,
          store: false
        }),
        signal: controller.signal
      })
      if (!response.ok) {
        throw new Error(await errorFromResponse(response))
      }
      await streamResponses(response, (delta) => {
        run.text += delta
        run.updatedAt = Date.now()
      })
      if (!run.text.trim()) {
        throw new Error('The model returned no text.')
      }
      finish('completed', null)
    } catch (error) {
      if (controller.signal.aborted) {
        finish('cancelled', null)
        return
      }
      finish('failed', error instanceof Error ? error.message : 'AI request failed.')
    }
  })()

  return { ...run }
}

export const cancelAiRun = (downloadId: string, skillId: string): WebAiRun | null => {
  live.get(keyOf(downloadId, skillId))?.controller.abort()
  return getAiRun(downloadId, skillId)
}
