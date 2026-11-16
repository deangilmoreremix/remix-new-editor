'use client';

import type { DesignProject } from './thumbnail/designer/model';

export interface Asset {
  id?: string;
  type: 'video' | 'image';
  url: string;
  thumbnailUrl?: string;
  title?: string;
  description?: string;
  prompt?: string;
  script?: string;
  studio?: string;
  aspectRatio?: string;
}

export interface ThumbnailState {
  templateId?: string;
  values?: Record<string, any>;
  references?: string[];
  imageUrl?: string;
  responseId?: string;
  aspectRatio?: string;
  /** The layered design behind the exported thumbnail (kept so it can be edited again). */
  design?: DesignProject;
}

export interface CopyState {
  master: string
  platforms: Record<
    string,
    { caption?: string; title?: string; description?: string }
  >
  responseId?: string
  variants: Array<{ id: string; label: string; text: string }>
  selectedVariantId?: string
  headline?: string
  subheadline?: string
  subject?: string
  visualIdea?: string
  title?: string
  description?: string
  tags?: string
  caption?: string
  tiktokTitle?: string
  /** Fields the learner has edited in the Write step (even if cleared); these beat studio-supplied fallbacks. */
  edited?: { master?: boolean; title?: boolean; platforms?: Record<string, { caption?: boolean; description?: boolean; title?: boolean }> }
}

export type WriteCopyState = CopyState

export interface ThumbnailState {
  templateId?: string
  values?: Record<string, any>
  references?: string[]
  imageUrl?: string
  responseId?: string
  aspectRatio?: string
  /** The layered design behind the exported thumbnail (kept so it can be edited again). */
  design?: DesignProject
}

export interface Destination {
  id: string
  platform: 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'linkedin' | 'pinterest' | 'threads' | 'x'
  accountId?: string
  accountName?: string
  accountImage?: string
  enabled: boolean
  settings?: Record<string, any>
}

export type PublishStatus = 'queued' | 'uploading' | 'processing' | 'published' | 'failed'

export interface PublishResult {
  platform: string
  status: PublishStatus
  url?: string
  error?: string
  accountId?: string
  requestId?: string
  output?: any
  link?: string | null
  /** Non-fatal follow-up result, e.g. the YouTube thumbnail could not be set. */
  note?: string
}

export interface WriteStepProps {
  asset: Asset
  copy: CopyState
  onUpdateCopy: (copy: CopyState) => void
  /** Opens the API keys modal (AI writing uses the customer's own OpenAI key). */
  onRequestApiKey?: () => void
  /** Publishing session this step belongs to; AI results from an older session are dropped. */
  sessionId?: number
}

export interface ThumbnailStepProps {
  asset: Asset
  thumbnail: ThumbnailState
  onUpdateThumbnail: (t: ThumbnailState) => void
  copy: CopyState
  /** Opens Settings so the user can add their OpenAI key. */
  onRequestApiKey?: () => void
}

export interface DestinationsStepProps {
  asset: Asset
  copy: CopyState
  destinations: Destination[]
  onChange: (destinations: Destination[]) => void
  publishResults: PublishResult[]
  /** Publish the selected destinations (already-published ones are skipped). */
  onPublish: (destinations: Destination[]) => void | Promise<void>
  /** Retry one failed destination only. */
  onRetry?: (platform: string, accountId?: string) => void | Promise<void>
  onUpdatePublishResults: (results: PublishResult[]) => void
  publishing: boolean
  apiKey: string
  mediaType: 'video' | 'image'
}

export interface ReviewPublishStepProps {
  asset: Asset
  copy: CopyState
  thumbnail: ThumbnailState
  destinations: Destination[]
  publishResults: PublishResult[]
  onConfirm: () => void | Promise<void>
  /** Retry one failed destination only (never re-posts to the ones that succeeded). */
  onRetry?: (platform: string, accountId?: string) => void | Promise<void>
  onBack: () => void
  publishing: boolean
  /** Why publishing is blocked, if it is (shown instead of failing silently). */
  blockers?: string[]
}

export const STEPS = [
  { id: 'write', label: 'Write' },
  { id: 'thumbnail', label: 'Thumbnail' },
  { id: 'destinations', label: 'Destinations' },
  { id: 'review', label: 'Review & Publish' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];
