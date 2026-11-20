import { oc, type } from '@orpc/contract'
import type { TranscriptRecord } from './types'

/** Lifecycle shown in the web transcripts list. */
export type WebTranscriptState =
  | 'none'
  | 'queued'
  | 'running'
  | 'completed'
  | 'no-speech'
  | 'failed'
  | 'cancelled'
  | 'retry-scheduled'

/** One download's transcript status, without caption text. */
export interface WebTranscriptStatus {
  downloadId: string
  title: string | null
  state: WebTranscriptState
  stage: string | null
  error: string | null
  sourceKind: 'asr' | 'captions' | null
  language: string | null
  sourceFilePath: string | null
  segmentCount: number
  updatedAt: number
}

/** Status plus the full transcript (speakers and segments) when one exists. */
export interface WebTranscriptDetail extends WebTranscriptStatus {
  record: TranscriptRecord | null
}

export type WebTranscriptExportFormat = 'txt' | 'md' | 'srt' | 'vtt'

export const transcriptsContract = {
  statusMap: oc.output(type<Record<string, WebTranscriptStatus>>()),
  get: oc.input(type<{ downloadId: string }>()).output(type<WebTranscriptDetail>()),
  start: oc
    .input(type<{ downloadId: string; force?: boolean }>())
    .output(type<WebTranscriptDetail>()),
  cancel: oc.input(type<{ downloadId: string }>()).output(type<WebTranscriptDetail>()),
  retry: oc.input(type<{ downloadId: string }>()).output(type<WebTranscriptDetail>()),
  export: oc
    .input(type<{ downloadId: string; format: WebTranscriptExportFormat }>())
    .output(type<{ filename: string; mimeType: string; content: string }>())
}

/** OpenAI settings as shown to the browser. The key itself is never returned. */
export interface WebAiSettings {
  baseUrl: string
  hasApiKey: boolean
  /** Last four characters of the stored key, for recognition only. */
  apiKeyHint: string | null
  /** True when the key comes from the server environment, not the settings file. */
  keyFromEnv: boolean
  model: string
}

export interface WebAiSkill {
  id: string
  name: string
  description: string
}

export type WebAiRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface WebAiRun {
  downloadId: string
  skillId: string
  status: WebAiRunStatus
  text: string
  error: string | null
  model: string | null
  updatedAt: number
}

export const aiContract = {
  settingsGet: oc.output(type<WebAiSettings>()),
  settingsSet: oc
    .input(type<{ apiKey?: string; clearApiKey?: boolean; baseUrl?: string; model?: string }>())
    .output(type<WebAiSettings>()),
  skills: oc.output(type<WebAiSkill[]>()),
  /** Starts a run in the background and returns immediately; poll `get` for text. */
  run: oc
    .input(type<{ downloadId: string; skillId: string; language?: string }>())
    .output(type<WebAiRun>()),
  get: oc
    .input(type<{ downloadId: string; skillId: string }>())
    .output(type<WebAiRun | null>()),
  list: oc.input(type<{ downloadId: string }>()).output(type<WebAiRun[]>()),
  cancel: oc
    .input(type<{ downloadId: string; skillId: string }>())
    .output(type<WebAiRun | null>())
}
