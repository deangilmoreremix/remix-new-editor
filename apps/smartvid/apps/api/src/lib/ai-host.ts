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
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROMPT_RUN_DDL_V1 } from '@smartvid/db/prompt-runs'
import type {
  WebAiConnectionTest,
  WebAiRun,
  WebAiRunStatus,
  WebAiSettings,
  WebAiSkill
} from '@smartvid/transcription/web-contract'
import { apiDataDir, trimEnv } from './api-paths'
import { byokEnabled } from './byok'
import { getDatabaseConnection } from './database'
import {
  aiSettingsFile,
  createResponse,
  DEFAULT_BASE_URL,
  getOpenAiConfig,
  readStoredAiSettings,
  sourcesMarkdown
} from './openai-responses'
import { aiChannel, publishLive } from './live-events'
import { getTranscriptDetail } from './transcripts-host'

/** Refuse rather than silently truncate: one request must hold the whole transcript. */
const MAX_TRANSCRIPT_CHARS = Number(trimEnv('SMARTVID_AI_MAX_TRANSCRIPT_CHARS')) || 400_000

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

const settingsFile = aiSettingsFile
const readStored = readStoredAiSettings
const effective = getOpenAiConfig

/** Compare base URLs ignoring a trailing slash and letter case. */
const normalizeBase = (value: string): string => value.trim().replace(/\/+$/, '').toLowerCase()

/** `SMARTVID_AI_LOCK_SETTINGS=1`: the key, model and base URL come from the server environment only. */
const settingsLocked = (): boolean => trimEnv('SMARTVID_AI_LOCK_SETTINGS') === '1'

export const getAiSettings = (): WebAiSettings => {
  const current = effective()
  return {
    baseUrl: current.baseUrl,
    hasApiKey: Boolean(current.apiKey),
    apiKeyHint: current.apiKey ? current.apiKey.slice(-4) : null,
    keyFromEnv: current.keyFromEnv,
    model: current.model,
    locked: settingsLocked(),
    byok: byokEnabled()
  }
}

export const setAiSettings = (input: {
  apiKey?: string
  clearApiKey?: boolean
  baseUrl?: string
  model?: string
}): WebAiSettings => {
  if (settingsLocked()) {
    throw new Error('AI settings are managed by the server and cannot be changed here.')
  }
  if (byokEnabled()) {
    throw new Error('Your OpenAI key is kept in your browser, not on the server.')
  }
  const stored = readStored()
  const before = getOpenAiConfig()
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
    // A key that is already held (saved here, or set by the server's environment) is only ever sent to the
    // address it was set up for: moving to another address requires typing the key for it.
    const nextBase = value || DEFAULT_BASE_URL
    const holdsKey = Boolean(stored.apiKey) || Boolean(trimEnv('OPENAI_API_KEY'))
    if (normalizeBase(nextBase) !== normalizeBase(before.baseUrl) && holdsKey && !input.apiKey?.trim()) {
      throw new Error('To use a different base URL, enter the API key for it too. The saved key is never sent to a new address.')
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
  trimEnv('SMARTVID_SKILLS_DIR'),
  path.resolve(here, '../../../../skills'),
  path.resolve(process.cwd(), 'skills'),
  path.resolve(process.cwd(), '../../skills')
].filter((value): value is string => Boolean(value))

const skillsDir = (): string | null =>
  skillsDirCandidates.find((dir) => fs.existsSync(path.join(dir, 'overview', 'SKILL.md'))) ?? null

interface LoadedSkill {
  id: string
  name: string
  description: string
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

/** Id of the structured-output skill whose result is JSON, not Markdown. */
export const CHAPTERS_SKILL_ID = 'chapters'

const CHAPTERS_SKILL: LoadedSkill = {
  id: CHAPTERS_SKILL_ID,
  name: CHAPTERS_SKILL_ID,
  description: 'Split the transcript into chapters with key quotes that jump to the moment.',
  body: [
    'Split this transcript into navigable chapters and pick key quotes.',
    'Each transcript line starts with [m:ss] or [h:mm:ss]. Read the whole transcript first and cover the full timeline.',
    'Start each chapter at the first line that introduces its topic. Use only moments that appear in the transcript, in order, with no duplicates.',
    'Express every moment as start_seconds: the number of seconds from the start (for example [1:05] is 65).',
    'Choose chapters by real topic changes and give each a specific title and a one-sentence summary. Do not split into equal intervals or invent topics.',
    'Pick 3-5 key quotes that are surprising, memorable or striking. Quotes must be the speaker\'s own words, lightly cleaned of filler.',
    'Write titles, summaries and quotes in the language of the transcript. Set takeaway to one sentence that captures the whole video.'
  ].join('\n')
}

const CHAPTERS_SCHEMA = {
  type: 'object',
  properties: {
    takeaway: { type: 'string' },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          start_seconds: { type: 'number' },
          title: { type: 'string' },
          summary: { type: 'string' }
        },
        required: ['start_seconds', 'title', 'summary'],
        additionalProperties: false
      }
    },
    quotes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { start_seconds: { type: 'number' }, quote: { type: 'string' } },
        required: ['start_seconds', 'quote'],
        additionalProperties: false
      }
    }
  },
  required: ['takeaway', 'chapters', 'quotes'],
  additionalProperties: false
}

interface ChaptersResult {
  takeaway: string
  chapters: Array<{ start_seconds: number; title: string; summary: string }>
  quotes: Array<{ start_seconds: number; quote: string }>
}

/** Parse the model's JSON, drop moments outside the video, and sort by time. */
export const normalizeChapters = (raw: string, durationSeconds: number): string => {
  const parsed = JSON.parse(raw) as ChaptersResult
  const inRange = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= durationSeconds + 1
  const chapters = (parsed.chapters ?? [])
    .filter((c) => inRange(c.start_seconds) && c.title?.trim())
    .sort((a, b) => a.start_seconds - b.start_seconds)
  if (chapters.length === 0) {
    throw new Error('The model returned no usable chapters.')
  }
  const quotes = (parsed.quotes ?? [])
    .filter((q) => inRange(q.start_seconds) && q.quote?.trim())
    .sort((a, b) => a.start_seconds - b.start_seconds)
  return JSON.stringify({ takeaway: parsed.takeaway ?? '', chapters, quotes })
}

/**
 * The page's "Translate" prompt: translate the transcript text into the interface language as Markdown.
 * Upstream's own `translate` skill is an agent workflow that needs tools, so the web edition uses this
 * single-request prompt. Cue-aligned subtitle translation is the Translate tab.
 */
const TRANSLATE_SKILL: LoadedSkill = {
  id: 'translate',
  name: 'translate',
  description: 'Translate the transcript into the interface language.',
  body: [
    'Translate this transcript into {{uiLanguage}}.',
    'Keep the speaker labels and the order of the lines. Stay faithful to the meaning and keep names, numbers and technical terms accurate.',
    'Write natural {{uiLanguage}}, not a word-for-word copy. If a passage is already in {{uiLanguage}}, keep it unchanged.',
    'Output the translated transcript as paragraphs, one per speaker turn, with the speaker label in bold when there is one.',
    'Keep each list marker on the same line as the item text. Do not wrap the whole reply in a code fence. Do not add a preamble or closing remarks.'
  ].join('\n')
}

const grounded = (lines: string[]): string =>
  [...lines, 'Use only what the transcript says. Do not invent quotes, names, numbers or timestamps.'].join('\n')

/** Web-edition prompts written for the Responses API (plain instructions; some also use its built-in tools). */
const WEB_SKILLS: LoadedSkill[] = [
  {
    id: 'key-moments',
    name: 'key-moments',
    description: 'Find the best short clips to share, with start and end times.',
    body: grounded([
      'Find the 5-8 moments of this video that would make the best standalone short clips (30-90 seconds each).',
      'Each transcript line starts with [m:ss] or [h:mm:ss]. For every clip give: a catchy title, the start and end time as [m:ss] - [m:ss], a one-sentence hook, and why it works on its own.',
      'Prefer a complete thought with a strong opening line and a clear ending. Do not overlap clips. List them in time order.',
      'Write in {{uiLanguage}}.'
    ])
  },
  {
    id: 'quiz',
    name: 'quiz',
    description: 'Make a quiz that checks whether someone watched and understood the video.',
    body: grounded([
      'Write a quiz of 8 questions about this video: a mix of multiple choice (four options, one correct) and short answer.',
      'Only ask about things the transcript states. After each question give the answer and the timestamp [m:ss] where it comes up.',
      'Put all answers at the end under an "Answer key" heading, not next to the questions.',
      'Write in {{uiLanguage}}.'
    ])
  },
  {
    id: 'show-notes',
    name: 'show-notes',
    description: 'Show notes: summary, topics, notable quotes and resources mentioned.',
    body: grounded([
      'Write show notes for this video: a two-sentence summary, a bulleted list of topics with [m:ss] timestamps, up to five notable quotes with who said them, and a list of any books, tools, people or links that are mentioned.',
      'Omit a section if the transcript has nothing for it. Write in {{uiLanguage}}.'
    ])
  },
  {
    id: 'social-posts',
    name: 'social-posts',
    description: 'Draft posts for X, LinkedIn and a short-video caption from the video.',
    body: grounded([
      'Draft social posts for this video: one X post (under 280 characters), one LinkedIn post (a hook line, 3-5 short lines, a closing question) and one caption for a short vertical video with three hashtags.',
      'Lead with the most interesting point, not with "In this video". Write in {{uiLanguage}}.'
    ])
  },
  {
    id: 'fact-check',
    name: 'fact-check',
    description: 'Check the checkable claims in the video against the web, with sources.',
    body: [
      'Fact-check this video. List the 5-8 most important factual claims made (figures, dates, named events, scientific or legal statements), each with its [m:ss] timestamp.',
      'For each claim search the web and give a verdict: Supported, Partly supported, Not supported or Could not verify, plus one sentence of evidence.',
      'Skip opinions and predictions. Be honest when sources disagree or are weak. Write in {{uiLanguage}}.'
    ].join('\n')
  }
]

/** Built-in tools of the Responses API a web-edition prompt may use, by prompt id. */
const WEB_SKILL_TOOLS: Record<string, Array<Record<string, unknown>>> = {
  'fact-check': [{ type: 'web_search' }]
}

/** Prompts whose transcript is sent with [m:ss] timestamps. */
const TIMESTAMPED_SKILLS = new Set(['overview', CHAPTERS_SKILL_ID, 'key-moments', 'quiz', 'show-notes', 'fact-check'])

interface BuiltinMeta {
  title: string
  icon: string
  visible: boolean
  editable: boolean
}

/** Names match the AI prompts documentation; the first three tabs are upstream's default sidebar set. */
const BUILTIN_META: Record<string, BuiltinMeta> = {
  overview: { title: 'Overview', icon: '🧭', visible: true, editable: true },
  chapters: { title: 'Chapters', icon: '📑', visible: true, editable: false },
  'generate-faq': { title: 'Generate FAQ', icon: '❓', visible: true, editable: true },
  'create-mindmap': { title: 'Create a mindmap', icon: '🧠', visible: true, editable: true },
  'bullet-points': { title: 'Bullet Points', icon: '📝', visible: false, editable: true },
  'improve-grammar': { title: 'Improve Grammar & Punctuation', icon: '✍️', visible: false, editable: true },
  'extract-statistics': { title: 'Extract Statistics', icon: '📊', visible: false, editable: true },
  'paraphrase-content': { title: 'Paraphrase Content', icon: '🔁', visible: false, editable: true },
  translate: { title: 'Translate', icon: '🌐', visible: false, editable: true },
  'key-moments': { title: 'Key moments', icon: '🎬', visible: false, editable: true },
  quiz: { title: 'Quiz', icon: '🎓', visible: false, editable: true },
  'show-notes': { title: 'Show notes', icon: '🗒️', visible: false, editable: true },
  'social-posts': { title: 'Social posts', icon: '📣', visible: false, editable: true },
  'fact-check': { title: 'Fact-check (web)', icon: '🔎', visible: false, editable: true }
}

const loadSkills = (): LoadedSkill[] => {
  const dir = skillsDir()
  const out: LoadedSkill[] = [CHAPTERS_SKILL, TRANSLATE_SKILL, ...WEB_SKILLS]
  if (!dir) {
    return out
  }
  for (const id of PROMPT_SKILL_IDS) {
    const file = path.join(dir, id, 'SKILL.md')
    if (fs.existsSync(file)) {
      out.push(parseSkill(id, fs.readFileSync(file, 'utf-8')))
    }
  }
  return out
}

// ---------- prompt catalog (built-ins + the user's edits and custom prompts) ----------

interface StoredPrompts {
  custom: Array<{ id: string; title: string; icon: string; content: string }>
  /** Edits to built-ins, by id. */
  overrides: Record<string, { title?: string; icon?: string; content?: string }>
  /** Explicit tab visibility, by id. Missing means the default. */
  visibility: Record<string, boolean>
}

const promptsFile = path.join(apiDataDir, 'ai-prompts.json')

const readPromptStore = (): StoredPrompts => {
  try {
    const parsed = JSON.parse(fs.readFileSync(promptsFile, 'utf-8')) as Partial<StoredPrompts>
    return {
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      overrides: parsed.overrides ?? {},
      visibility: parsed.visibility ?? {}
    }
  } catch {
    return { custom: [], overrides: {}, visibility: {} }
  }
}

const writePromptStore = (store: StoredPrompts): void => {
  fs.mkdirSync(apiDataDir, { recursive: true })
  fs.writeFileSync(promptsFile, JSON.stringify(store, null, 2), 'utf-8')
}

/** Every prompt with its current title, icon and instructions. */
export const listAiSkills = (): WebAiSkill[] => {
  const store = readPromptStore()
  const out: WebAiSkill[] = loadSkills()
    .filter((skill) => BUILTIN_META[skill.id])
    .map((skill) => {
      const meta = BUILTIN_META[skill.id] as BuiltinMeta
      const override = store.overrides[skill.id]
      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        title: override?.title?.trim() || meta.title,
        icon: override?.icon?.trim() || meta.icon,
        content: override?.content?.trim() || skill.body,
        builtin: true,
        visible: store.visibility[skill.id] ?? meta.visible,
        edited: Boolean(override),
        editable: meta.editable
      }
    })
  for (const item of store.custom) {
    out.push({
      id: item.id,
      name: item.id,
      description: 'Custom prompt',
      title: item.title,
      icon: item.icon,
      content: item.content,
      builtin: false,
      visible: store.visibility[item.id] ?? true,
      edited: false,
      editable: true
    })
  }
  return out
}

const checkPromptFields = (input: { title: string; icon?: string; content: string }): void => {
  if (!input.title.trim() || input.title.trim().length > 60) {
    throw new Error('Give the prompt a title of up to 60 characters.')
  }
  if (!input.content.trim() || input.content.length > 20_000) {
    throw new Error('Write the instructions (up to 20,000 characters).')
  }
  if ((input.icon ?? '').length > 8) {
    throw new Error('The icon must be a single emoji.')
  }
}

export const savePrompt = (input: {
  id?: string
  title: string
  icon?: string
  content: string
}): WebAiSkill[] => {
  checkPromptFields(input)
  const store = readPromptStore()
  const title = input.title.trim()
  const icon = input.icon?.trim() || '✨'
  if (!input.id) {
    const id = `custom-${randomUUID()}`
    store.custom.push({ id, title, icon, content: input.content.trim() })
    store.visibility[id] = true
  } else if (BUILTIN_META[input.id]) {
    if (!BUILTIN_META[input.id]?.editable) {
      throw new Error('This prompt cannot be edited because the page depends on its output format.')
    }
    store.overrides[input.id] = { title, icon, content: input.content.trim() }
  } else {
    const existing = store.custom.find((item) => item.id === input.id)
    if (!existing) {
      throw new Error('Prompt not found.')
    }
    Object.assign(existing, { title, icon, content: input.content.trim() })
  }
  writePromptStore(store)
  return listAiSkills()
}

export const deletePrompt = (id: string): WebAiSkill[] => {
  const store = readPromptStore()
  if (BUILTIN_META[id]) {
    delete store.overrides[id]
  } else {
    store.custom = store.custom.filter((item) => item.id !== id)
    delete store.visibility[id]
  }
  writePromptStore(store)
  return listAiSkills()
}

export const setPromptVisible = (id: string, visible: boolean): WebAiSkill[] => {
  const store = readPromptStore()
  store.visibility[id] = visible
  writePromptStore(store)
  return listAiSkills()
}

/** Undo edits to built-ins and reset their tab visibility; custom prompts stay. */
export const restorePrompts = (): WebAiSkill[] => {
  const store = readPromptStore()
  store.overrides = {}
  for (const id of Object.keys(BUILTIN_META)) {
    delete store.visibility[id]
  }
  writePromptStore(store)
  return listAiSkills()
}

const resolvePrompt = (id: string): { id: string; body: string } | null => {
  const found = listAiSkills().find((item) => item.id === id)
  return found ? { id: found.id, body: found.content } : null
}

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

interface RunSpec {
  downloadId: string
  skillId: string
  instructions: string
  transcript: string
  durationSeconds: number
  chapters: boolean
  /** Built-in Responses API tools (for example web search) this run may use. */
  tools?: Array<Record<string, unknown>>
  /** False for test runs: nothing is written to the database. */
  persist: boolean
}

const executeRun = (spec: RunSpec): WebAiRun => {
  const settings = effective()
  if (!settings.apiKey) {
    throw new Error('Add an OpenAI API key in AI settings first.')
  }
  const key = keyOf(spec.downloadId, spec.skillId)
  if (live.has(key)) {
    throw new Error('This summary is already running.')
  }
  if (spec.transcript.length > MAX_TRANSCRIPT_CHARS) {
    throw new Error(
      `This transcript is too long for one request (${spec.transcript.length} characters, limit ${MAX_TRANSCRIPT_CHARS}).`
    )
  }
  const controller = new AbortController()
  const createdAt = Date.now()
  const run: WebAiRun = {
    downloadId: spec.downloadId,
    skillId: spec.skillId,
    status: 'running',
    text: '',
    error: null,
    model: settings.model,
    updatedAt: createdAt
  }
  live.set(key, { run, controller })
  if (spec.persist) {
    save(run, createdAt)
  }
  const channel = aiChannel(spec.downloadId, spec.skillId)
  publishLive(channel, 'state', { ...run })

  const finish = (status: WebAiRunStatus, error: string | null): void => {
    run.status = status
    run.error = error
    run.updatedAt = Date.now()
    if (spec.persist) {
      save(run, createdAt)
    }
    live.delete(key)
    publishLive(channel, 'state', { ...run })
  }

  void (async () => {
    try {
      const result = await createResponse({
        config: { apiKey: settings.apiKey as string, baseUrl: settings.baseUrl, model: settings.model },
        body: {
          instructions: spec.instructions,
          input: spec.transcript,
          ...(spec.chapters
            ? {
                text: {
                  format: { type: 'json_schema', name: 'chapters', strict: true, schema: CHAPTERS_SCHEMA }
                }
              }
            : {}),
          ...(spec.tools?.length ? { tools: spec.tools } : {})
        },
        signal: controller.signal,
        onTextDelta: (delta) => {
          run.text += delta
          run.updatedAt = Date.now()
          publishLive(channel, 'delta', { delta })
        }
      })
      if (!run.text) {
        run.text = result.text
      }
      if (!run.text.trim()) {
        throw new Error('The model returned no text.')
      }
      if (spec.chapters) {
        run.text = normalizeChapters(run.text, spec.durationSeconds)
      } else {
        const sources = sourcesMarkdown(result.sources)
        if (sources) {
          run.text += sources
          publishLive(channel, 'delta', { delta: sources })
        }
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

export const startAiRun = (input: {
  downloadId: string
  skillId: string
  /** The interface language's name, for example "English" or "中文". */
  language?: string
}): WebAiRun => {
  const skill = resolvePrompt(input.skillId)
  if (!skill) {
    throw new Error(`Unknown skill: ${input.skillId}`)
  }
  if (!effective().apiKey) {
    throw new Error('Add an OpenAI API key in AI settings first.')
  }
  const chapters = skill.id === CHAPTERS_SKILL_ID
  const timestamped = TIMESTAMPED_SKILLS.has(skill.id)
  const transcript = buildTranscriptText(input.downloadId, timestamped)
  const durationSeconds =
    (getTranscriptDetail(input.downloadId).record?.segments.reduce((max, seg) => Math.max(max, seg.endMs), 0) ?? 0) /
    1000
  return executeRun({
    downloadId: input.downloadId,
    skillId: input.skillId,
    instructions: skill.body.replaceAll('{{uiLanguage}}', input.language?.trim() || 'English'),
    transcript,
    durationSeconds,
    chapters,
    tools: WEB_SKILL_TOOLS[skill.id],
    persist: true
  })
}

/** A short made-up interview used to try instructions in the prompt editor. */
const SAMPLE_TRANSCRIPT = [
  '[0:00] Maya: Welcome back to the show. Today we are talking about how small teams ship faster.',
  '[0:12] Jon: Thanks for having me. We cut our release cycle from three weeks to four days last year.',
  '[0:24] Maya: What changed?',
  '[0:27] Jon: Mostly two things. We stopped batching work, and we automated roughly 80% of our manual testing.',
  '[0:45] Maya: Did quality suffer?',
  '[0:48] Jon: The opposite. Bugs reported by customers dropped by 35% in six months.',
  '[1:05] Maya: Any advice for a team starting out?',
  '[1:09] Jon: Ship something small every day, and measure what breaks.'
].join('\n')

export const SAMPLE_DOWNLOAD_ID = '__sample__'
export const SAMPLE_PROMPT_ID = '__test__'

export const startPromptTest = (input: { content: string; language?: string }): WebAiRun => {
  if (!input.content.trim() || input.content.length > 20_000) {
    throw new Error('Write the instructions first (up to 20,000 characters).')
  }
  return executeRun({
    downloadId: SAMPLE_DOWNLOAD_ID,
    skillId: SAMPLE_PROMPT_ID,
    instructions: input.content.replaceAll('{{uiLanguage}}', input.language?.trim() || 'English'),
    transcript: SAMPLE_TRANSCRIPT,
    durationSeconds: 70,
    chapters: false,
    persist: false
  })
}

/** Send a short ping so the user can check the key, model and base URL before relying on them. */
export const testConnection = async (input: {
  apiKey?: string
  baseUrl?: string
  model?: string
}): Promise<WebAiConnectionTest> => {
  const saved = getOpenAiConfig()
  // When the server owner locked the settings, only the server's own configuration is tested: nothing typed by the caller is used.
  const locked = settingsLocked()
  // Bring your own key: the visitor's typed key and model are theirs to try, but the address stays the server's.
  const byok = byokEnabled()
  const typedKey = locked ? '' : input.apiKey?.trim() || ''
  const baseUrl = ((locked || byok ? '' : input.baseUrl?.trim()) || saved.baseUrl).replace(/\/+$/, '')
  const model = (locked ? '' : input.model?.trim()) || saved.model
  // The server's key (saved or from the environment) is only ever sent to the address it is configured for.
  if (!typedKey && normalizeBase(baseUrl) !== normalizeBase(saved.baseUrl)) {
    return {
      ok: false,
      model,
      reply: null,
      error: 'To test a different base URL, enter the API key for it. The saved key is never sent to a new address.'
    }
  }
  const config = { apiKey: typedKey || saved.apiKey || '', baseUrl, model }
  if (!config.apiKey) {
    return { ok: false, model: config.model, reply: null, error: 'Add an OpenAI API key first.' }
  }
  if (!config.model) {
    return { ok: false, model: config.model, reply: null, error: 'Enter a model ID.' }
  }
  if (!/^https?:\/\//i.test(config.baseUrl)) {
    return { ok: false, model: config.model, reply: null, error: 'Base URL must start with http:// or https://' }
  }
  try {
    const result = await createResponse({
      config,
      body: { input: 'Reply with the single word: ready', max_output_tokens: 32 },
      signal: AbortSignal.timeout(20_000)
    })
    return { ok: true, model: config.model, reply: result.text.trim().slice(0, 80) || '(empty reply)', error: null }
  } catch (error) {
    return {
      ok: false,
      model: config.model,
      reply: null,
      error: error instanceof Error ? error.message : 'The connection failed.'
    }
  }
}

export const cancelAiRun = (downloadId: string, skillId: string): WebAiRun | null => {
  live.get(keyOf(downloadId, skillId))?.controller.abort()
  return getAiRun(downloadId, skillId)
}
