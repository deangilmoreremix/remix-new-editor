/**
 * Subtitle translation with OpenAI Structured Outputs.
 *
 * The current transcript's cues are translated in batches. Each batch is requested with a
 * strict JSON schema (`text.format: json_schema`) and checked: every input index must come
 * back exactly once, so cue timing never shifts. Progress is stored per (download, language).
 */
import type { WebTranslation, WebTranslationStatus } from '@smartvid/transcription/web-contract'
import { getDatabaseConnection } from './database'
import { translateChannel, publishLive } from './live-events'
import { createResponse, requireOpenAiConfig } from './openai-responses'
import { getTranscriptDetail } from './transcripts-host'

const BATCH_SIZE = 40
const CONTEXT_CUES = 3

const { sqlite } = getDatabaseConnection()
sqlite.exec(`
CREATE TABLE IF NOT EXISTS web_translations (
  download_id TEXT NOT NULL,
  language    TEXT NOT NULL,
  cues        TEXT NOT NULL,
  status      TEXT NOT NULL,
  done        INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  error       TEXT,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (download_id, language)
);`)

interface Cue {
  startMs: number
  endMs: number
  source: string
  /** Empty until translated. */
  text: string
}

interface Row {
  download_id: string
  language: string
  cues: string
  status: string
  done: number
  total: number
  error: string | null
  updated_at: number
}

const live = new Map<string, AbortController>()
const keyOf = (downloadId: string, language: string): string => `${downloadId}\u0000${language}`

const toView = (row: Row): WebTranslation => ({
  downloadId: row.download_id,
  language: row.language,
  status: row.status as WebTranslationStatus,
  done: row.done,
  total: row.total,
  error: row.error,
  updatedAt: row.updated_at
})

const getRow = (downloadId: string, language: string): Row | undefined =>
  sqlite
    .prepare('SELECT * FROM web_translations WHERE download_id = ? AND language = ?')
    .get(downloadId, language) as Row | undefined

const saveRow = (
  downloadId: string,
  language: string,
  cues: Cue[],
  status: WebTranslationStatus,
  done: number,
  error: string | null
): void => {
  sqlite
    .prepare(
      `INSERT INTO web_translations (download_id, language, cues, status, done, total, error, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(download_id, language) DO UPDATE SET
         cues = excluded.cues, status = excluded.status, done = excluded.done,
         total = excluded.total, error = excluded.error, updated_at = excluded.updated_at`
    )
    .run(downloadId, language, JSON.stringify(cues), status, done, cues.length, error, Date.now())
  publishLive(translateChannel(downloadId), 'state', listTranslations(downloadId))
}

export const listTranslations = (downloadId: string): WebTranslation[] =>
  (
    sqlite
      .prepare('SELECT * FROM web_translations WHERE download_id = ? ORDER BY updated_at DESC')
      .all(downloadId) as Row[]
  ).map(toView)

const SCHEMA = {
  type: 'object',
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: { index: { type: 'integer' }, text: { type: 'string' } },
        required: ['index', 'text'],
        additionalProperties: false
      }
    }
  },
  required: ['translations'],
  additionalProperties: false
}

const translateBatch = async (
  language: string,
  batch: Array<{ index: number; text: string }>,
  context: Array<{ source: string; translation: string }>,
  signal: AbortSignal,
  config: ReturnType<typeof requireOpenAiConfig>
): Promise<Map<number, string>> => {
  const expected = new Set(batch.map((cue) => cue.index))
  let lastProblem = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await createResponse({
      config,
      body: {
        instructions: [
          `Translate subtitle cues into ${language}.`,
          'Keep each cue separate: never merge, split, drop or reorder cues. Keep names and numbers.',
          'Make the translation read naturally as a short subtitle in the target language.',
          'Return exactly one item per input cue, using the same index.',
          lastProblem ? `Your previous answer was rejected: ${lastProblem}` : ''
        ]
          .filter(Boolean)
          .join('\n'),
        input: JSON.stringify({
          previous_cues_for_context_only: context,
          cues_to_translate: batch
        }),
        text: {
          format: { type: 'json_schema', name: 'subtitle_translation', strict: true, schema: SCHEMA }
        }
      },
      signal
    })
    let parsed: { translations?: Array<{ index: number; text: string }> }
    try {
      parsed = JSON.parse(result.text)
    } catch {
      lastProblem = 'the reply was not valid JSON'
      continue
    }
    const out = new Map<number, string>()
    for (const item of parsed.translations ?? []) {
      if (expected.has(item.index) && typeof item.text === 'string' && !out.has(item.index)) {
        out.set(item.index, item.text.trim())
      }
    }
    if (out.size === expected.size) {
      return out
    }
    lastProblem = `expected ${expected.size} cues with indexes ${[...expected].join(',')} but got ${out.size} usable ones`
  }
  throw new Error(`The model did not return every cue (${lastProblem}).`)
}

export const startTranslation = (downloadId: string, languageInput: string): WebTranslation => {
  const language = languageInput.trim().slice(0, 40)
  if (!language) {
    throw new Error('Choose a target language.')
  }
  const key = keyOf(downloadId, language)
  if (live.has(key)) {
    throw new Error('This translation is already running.')
  }
  const detail = getTranscriptDetail(downloadId)
  if (!detail.record || detail.record.segments.length === 0) {
    throw new Error('No transcript yet. Transcribe this download first.')
  }
  const cues: Cue[] = [...detail.record.segments]
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((segment) => ({
      startMs: segment.startMs,
      endMs: segment.endMs,
      source: segment.text.trim(),
      text: ''
    }))
  const controller = new AbortController()
  live.set(key, controller)
  saveRow(downloadId, language, cues, 'running', 0, null)

  const config = requireOpenAiConfig()
  void (async () => {
    try {
      let done = 0
      for (let start = 0; start < cues.length; start += BATCH_SIZE) {
        const slice = cues.slice(start, start + BATCH_SIZE)
        const batch = slice.map((cue, offset) => ({ index: start + offset, text: cue.source }))
        const context = cues
          .slice(Math.max(0, start - CONTEXT_CUES), start)
          .map((cue) => ({ source: cue.source, translation: cue.text }))
        const translated = await translateBatch(language, batch, context, controller.signal, config)
        for (const item of batch) {
          const cue = cues[item.index]
          if (cue) {
            cue.text = translated.get(item.index) ?? ''
          }
        }
        done += slice.length
        saveRow(downloadId, language, cues, 'running', done, null)
      }
      saveRow(downloadId, language, cues, 'completed', cues.length, null)
    } catch (error) {
      const current = getRow(downloadId, language)
      const progress = current?.done ?? 0
      if (controller.signal.aborted) {
        saveRow(downloadId, language, cues, 'cancelled', progress, null)
      } else {
        saveRow(
          downloadId,
          language,
          cues,
          'failed',
          progress,
          error instanceof Error ? error.message : 'Translation failed.'
        )
      }
    } finally {
      live.delete(key)
    }
  })()

  const row = getRow(downloadId, language)
  if (!row) {
    throw new Error('Failed to start translation.')
  }
  return toView(row)
}

export const cancelTranslation = (downloadId: string, language: string): WebTranslation | null => {
  live.get(keyOf(downloadId, language.trim().slice(0, 40)))?.abort()
  const row = getRow(downloadId, language.trim().slice(0, 40))
  return row ? toView(row) : null
}

/** Mark runs left `running` by a previous process as failed. */
export const failInterruptedTranslations = (): void => {
  sqlite
    .prepare(
      `UPDATE web_translations SET status = 'failed', error = 'Interrupted by a server restart', updated_at = ?
       WHERE status = 'running'`
    )
    .run(Date.now())
}

const pad = (n: number, w = 2): string => String(Math.floor(n)).padStart(w, '0')
const stamp = (ms: number, sep: ',' | '.'): string => {
  const t = Math.max(0, Math.round(ms))
  return `${pad(t / 3_600_000)}:${pad((t / 60_000) % 60)}:${pad((t / 1000) % 60)}${sep}${pad(t % 1000, 3)}`
}

export const exportTranslation = (
  downloadId: string,
  languageInput: string,
  format: 'srt' | 'vtt' | 'txt'
): { filename: string; mimeType: string; content: string } => {
  const language = languageInput.trim().slice(0, 40)
  const row = getRow(downloadId, language)
  if (!row || row.status !== 'completed') {
    throw new Error('The translation is not finished yet.')
  }
  const cues = JSON.parse(row.cues) as Cue[]
  const title = getTranscriptDetail(downloadId).title ?? downloadId
  const base = `${title}.${language}`.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 120)
  let content: string
  let mimeType = 'text/plain; charset=utf-8'
  if (format === 'srt') {
    content = cues
      .map((cue, i) => `${i + 1}\n${stamp(cue.startMs, ',')} --> ${stamp(cue.endMs, ',')}\n${cue.text}\n`)
      .join('\n')
  } else if (format === 'vtt') {
    mimeType = 'text/vtt; charset=utf-8'
    content = `WEBVTT\n\n${cues.map((cue) => `${stamp(cue.startMs, '.')} --> ${stamp(cue.endMs, '.')}\n${cue.text}\n`).join('\n')}`
  } else {
    content = `${cues.map((cue) => cue.text).join('\n')}\n`
  }
  return { filename: `${base}.${format}`, mimeType, content }
}
