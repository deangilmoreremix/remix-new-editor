/**
 * Web/API transcript reads and actions.
 *
 * A trimmed counterpart of the desktop `transcript-host`: it derives one status per
 * download from the transcript store plus the task queue's transcription children,
 * and starts, cancels and retries work through the shared `enqueueTranscription`.
 * Speaker re-labelling, model-tier management and segment editing are not exposed here.
 */
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Task } from '@vidbee/task-queue'
import { TRANSCRIBABLE_TASK_KINDS } from '@vidbee/task-queue'
import {
  enqueueTranscription,
  findActiveTranscription,
  listTranscriptionChildren,
  type TranscriptRecord,
  transcriptionPartials
} from '@vidbee/transcription'
import type {
  WebTranscriptDetail,
  WebTranscriptExportFormat,
  WebTranscriptState,
  WebTranscriptStatus
} from '@vidbee/transcription/web-contract'
import { getDatabaseConnection } from './database'
import { taskQueue, transcriptStore } from './task-queue-host'
import { webSettingsStore } from './web-settings-store'

const { sqlite: titlesDb } = getDatabaseConnection()
titlesDb.exec(`
CREATE TABLE IF NOT EXISTS web_titles (
  download_id TEXT PRIMARY KEY,
  title       TEXT NOT NULL
);`)

const storedTitle = (downloadId: string): string | null => {
  const row = titlesDb.prepare('SELECT title FROM web_titles WHERE download_id = ?').get(downloadId) as
    | { title: string }
    | undefined
  return row?.title ?? null
}

const fileOk = (p: string | null | undefined): p is string =>
  Boolean(p && fs.existsSync(p) && fs.statSync(p).size > 0)

/** Resolve the playable media for a finished download, never a subtitle-only task. */
const resolveSourceFile = (task: Readonly<Task>): string | null => {
  if (task.kind === 'subtitles') {
    return null
  }
  if (fileOk(task.output?.filePath)) {
    return task.output.filePath
  }
  const opts = (task.input.options ?? {}) as Record<string, unknown>
  const dir =
    (typeof opts.customDownloadPath === 'string' && opts.customDownloadPath) ||
    (typeof opts.downloadPath === 'string' && opts.downloadPath) ||
    null
  const saved = typeof opts.savedFileName === 'string' ? opts.savedFileName : null
  if (dir && saved && fileOk(path.join(dir, saved))) {
    return path.join(dir, saved)
  }
  return null
}

/** Channel or uploader saved with the download's options, when present. */
const authorOf = (download: Readonly<Task> | undefined): string | null => {
  const options = (download?.input.options ?? {}) as Record<string, unknown>
  for (const key of ['uploader', 'channel']) {
    const value = options[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

const stateOf = (
  active: Task | undefined,
  latest: Task | undefined,
  record: TranscriptRecord | null
): WebTranscriptState => {
  if (active) {
    if (active.status === 'queued') {
      return 'queued'
    }
    if (active.status === 'retry-scheduled') {
      return 'retry-scheduled'
    }
    return 'running'
  }
  if (record) {
    return record.resultKind === 'no-speech' ? 'no-speech' : 'completed'
  }
  if (latest?.status === 'failed') {
    return 'failed'
  }
  if (latest?.status === 'cancelled') {
    return 'cancelled'
  }
  return 'none'
}

const buildStatus = (downloadId: string): WebTranscriptStatus & { record: TranscriptRecord | null } => {
  const download = taskQueue.get(downloadId)
  const children = listTranscriptionChildren(taskQueue, downloadId)
  const active = findActiveTranscription(taskQueue, downloadId)
  const latest = children[0]
  const record = transcriptStore.getLatestForDownload(downloadId)
  const state = stateOf(active, latest, record)
  const sourceFilePath = download ? resolveSourceFile(download) : (record?.sourceFilePath ?? null)
  const title =
    download?.input.title?.trim() ||
    storedTitle(downloadId) ||
    (sourceFilePath ? path.basename(sourceFilePath) : null) ||
    null
  const partial = active ? transcriptionPartials.getByTask(active.id) : null
  return {
    downloadId,
    title,
    author: authorOf(download),
    state,
    stage: active ? (partial?.stage ?? null) : null,
    error:
      state === 'failed' ? (latest?.lastError?.rawMessage?.trim() || 'Transcription failed') : null,
    sourceKind: record?.sourceKind ?? null,
    language: record?.language ?? null,
    sourceFilePath,
    segmentCount: record?.segments.length ?? 0,
    updatedAt: record?.updatedAt ?? latest?.updatedAt ?? download?.updatedAt ?? 0,
    record
  }
}

/** Status without caption text, for lists. */
export const getTranscriptStatus = (downloadId: string): WebTranscriptStatus => {
  const { record: _record, ...status } = buildStatus(downloadId)
  return status
}

export const getTranscriptDetail = (downloadId: string): WebTranscriptDetail =>
  buildStatus(downloadId)

/** Every download that is transcribable or already has transcript state. */
export const getTranscriptStatusMap = (): Record<string, WebTranscriptStatus> => {
  const ids = new Set<string>()
  let cursor: string | null = null
  do {
    const page = taskQueue.list({ cursor, limit: 500 })
    for (const task of page.tasks) {
      if (task.kind === 'transcription' && task.parentId) {
        ids.add(task.parentId)
      } else if (TRANSCRIBABLE_TASK_KINDS.has(task.kind) && task.status === 'completed') {
        ids.add(task.id)
      }
    }
    cursor = page.nextCursor
  } while (cursor)
  for (const head of transcriptStore.listHeads()) {
    if (head.supersededAt == null) {
      ids.add(head.downloadTaskId)
    }
  }
  const out: Record<string, WebTranscriptStatus> = {}
  for (const id of ids) {
    const status = getTranscriptStatus(id)
    if (status.state !== 'none' || status.sourceFilePath) {
      out[id] = status
    }
  }
  return out
}

export const startTranscript = async (
  downloadId: string,
  force = false
): Promise<WebTranscriptDetail> => {
  const download = taskQueue.get(downloadId)
  if (!download) {
    throw new Error(`download not found: ${downloadId}`)
  }
  const source = resolveSourceFile(download)
  if (!source) {
    throw new Error('source file missing')
  }
  const existing = transcriptStore.getLatestForDownload(downloadId)
  if (!force && existing?.sourceKind === 'captions' && existing.resultKind === 'transcript') {
    return getTranscriptDetail(downloadId)
  }
  const settings = await webSettingsStore.get()
  await enqueueTranscription({
    queue: taskQueue,
    store: transcriptStore,
    downloadTaskId: downloadId,
    sourceFilePath: source,
    title: download.input.title,
    trigger: force ? 'force' : 'manual',
    language: settings.language
  })
  return getTranscriptDetail(downloadId)
}

export const cancelTranscript = async (downloadId: string): Promise<WebTranscriptDetail> => {
  const active = findActiveTranscription(taskQueue, downloadId)
  if (active) {
    await taskQueue.cancel(active.id, 'user')
  }
  return getTranscriptDetail(downloadId)
}

export const retryTranscript = async (downloadId: string): Promise<WebTranscriptDetail> => {
  const latest = listTranscriptionChildren(taskQueue, downloadId)[0]
  if (latest && (latest.status === 'failed' || latest.status === 'cancelled')) {
    await taskQueue.retryManual(latest.id)
    return getTranscriptDetail(downloadId)
  }
  return startTranscript(downloadId, false)
}

const pad = (n: number, w = 2): string => String(Math.floor(n)).padStart(w, '0')

const clock = (ms: number, sep: ',' | '.'): string => {
  const total = Math.max(0, Math.round(ms))
  return `${pad(total / 3_600_000)}:${pad((total / 60_000) % 60)}:${pad((total / 1000) % 60)}${sep}${pad(total % 1000, 3)}`
}

const short = (ms: number): string => {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return `${pad(s / 60)}:${pad(s % 60)}`
}

/** Render the current transcript as text, Markdown, SRT or WebVTT. */
export const exportTranscript = (
  downloadId: string,
  format: WebTranscriptExportFormat
): { filename: string; mimeType: string; content: string } => {
  const { record, title } = buildStatus(downloadId)
  if (!record) {
    throw new Error('no transcript to export')
  }
  const names = new Map(record.speakers.map((s) => [s.id, s.displayName]))
  const label = (speakerId: string | null): string => (speakerId ? (names.get(speakerId) ?? '') : '')
  const segments = [...record.segments].sort((a, b) => a.sortIndex - b.sortIndex)
  const base = (title ?? downloadId).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || downloadId
  let content: string
  let mimeType = 'text/plain; charset=utf-8'
  if (format === 'srt') {
    content = segments
      .map((seg, i) => {
        const who = label(seg.speakerId)
        return `${i + 1}\n${clock(seg.startMs, ',')} --> ${clock(seg.endMs, ',')}\n${who ? `${who}: ` : ''}${seg.text}\n`
      })
      .join('\n')
  } else if (format === 'vtt') {
    mimeType = 'text/vtt; charset=utf-8'
    content = `WEBVTT\n\n${segments
      .map((seg) => {
        const who = label(seg.speakerId)
        return `${clock(seg.startMs, '.')} --> ${clock(seg.endMs, '.')}\n${who ? `<v ${who}>` : ''}${seg.text}\n`
      })
      .join('\n')}`
  } else if (format === 'md') {
    mimeType = 'text/markdown; charset=utf-8'
    content = `# ${title ?? 'Transcript'}\n\n${segments
      .map((seg) => {
        const who = label(seg.speakerId)
        return `**${who ? `${who} ` : ''}[${short(seg.startMs)}]** ${seg.text}`
      })
      .join('\n\n')}\n`
  } else {
    content = `${segments
      .map((seg) => {
        const who = label(seg.speakerId)
        return `[${short(seg.startMs)}] ${who ? `${who}: ` : ''}${seg.text}`
      })
      .join('\n')}\n`
  }
  return { filename: `${base}.${format}`, mimeType, content }
}

const MAX_IMPORT_CUES = 8000
const MAX_CUE_CHARS = 2000

/** Store a transcript made in the browser. */
export const importTranscriptCues = (input: {
  downloadId?: string
  title?: string
  language?: string | null
  model: string
  cues: Array<{ startMs: number; endMs: number; text: string }>
}): WebTranscriptStatus => {
  if (!Array.isArray(input.cues) || input.cues.length > MAX_IMPORT_CUES) {
    throw new Error(`A transcript can have at most ${MAX_IMPORT_CUES} lines.`)
  }
  const segments = input.cues
    .map((cue) => ({
      startMs: Math.max(0, Math.round(Number(cue.startMs))),
      endMs: Math.max(0, Math.round(Number(cue.endMs))),
      text: String(cue.text ?? '').trim().slice(0, MAX_CUE_CHARS)
    }))
    .filter((cue) => cue.text.length > 0 && Number.isFinite(cue.startMs) && Number.isFinite(cue.endMs))
    .sort((a, b) => a.startMs - b.startMs)
    .map((cue) => ({
      speakerKey: null,
      startMs: cue.startMs,
      endMs: Math.max(cue.endMs, cue.startMs + 1),
      text: cue.text,
      confidence: null
    }))
  let downloadId = input.downloadId?.trim()
  let sourceFilePath: string | null = null
  if (downloadId) {
    const download = taskQueue.get(downloadId)
    if (!download) {
      throw new Error(`download not found: ${downloadId}`)
    }
    sourceFilePath = resolveSourceFile(download)
  } else {
    downloadId = `local-${randomUUID()}`
  }
  const title = input.title?.trim().slice(0, 200)
  if (title && !input.downloadId) {
    titlesDb
      .prepare('INSERT OR REPLACE INTO web_titles (download_id, title) VALUES (?, ?)')
      .run(downloadId, title)
  }
  transcriptStore.commit({
    downloadTaskId: downloadId,
    transcriptionTaskId: `import-${randomUUID()}`,
    sourceFilePath,
    result: {
      resultKind: segments.length > 0 ? 'transcript' : 'no-speech',
      language: input.language?.trim().slice(0, 20) || null,
      modelVersion: `browser:${input.model.slice(0, 100)}`,
      asrTier: null,
      sourceKind: 'asr',
      speakers: [],
      segments
    }
  })
  return getTranscriptStatus(downloadId)
}
