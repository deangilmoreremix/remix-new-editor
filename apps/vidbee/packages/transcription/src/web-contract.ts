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
