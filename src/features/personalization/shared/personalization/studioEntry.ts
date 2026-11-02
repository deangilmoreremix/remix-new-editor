'use client';

/**
 * Shared studio → Personalization Modal entry point.
 *
 * REUSES the existing `DemoPersonalizeProvider` (mounted once around every
 * studio tab by `components/StandaloneShell.js`) and the existing
 * `PersonalizationModal`. This module adds NO second provider and NO second
 * modal implementation — a studio only CONSUMES `useDemoPersonalize()`.
 *
 * The same shape as the canonical "shared modal, drop-in button" pattern in
 * this repo: `components/AiAssistantProvider.tsx` (`AssistStep`) and
 * `components/SocialPublishProvider.tsx` (`PublishStep`).
 *
 * Every import in this file is RELATIVE, not `@/`-aliased: the module is
 * imported across the `packages/studio` package boundary (see
 * `packages/studio/src/components/VideoStudio.jsx`), and that package is
 * published standalone with no alias resolution.
 */

import {
  createElement,
  useCallback,
  useContext,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { SmartVideoAccessContext } from '../../access/SmartVideoAccessProvider';
import { ENTITLEMENTS } from '../../access/entitlements';
import { useDemoPersonalize } from './DemoPersonalizeProvider';
import type { StudioTarget } from '../crossStudio';
import type {
  AssetLibrary,
  GenerationResult,
  PersonalizationAccessMode,
  PersonalizationCompletion,
  PersonalizationSource,
} from './types';

export type { PersonalizationCompletion };

/**
 * Which studio (or surface) opened the modal.
 *
 * The trailing `'demo-personalization'` is the pre-existing literal used by
 * the Personalization demo flow — it stays in the union so the demo run and a
 * studio run can be told apart in the persisted project and in shared media.
 */
export type PersonalizationOriginStudio =
  | 'video'
  | 'image'
  | 'clipping'
  | 'vibe-motion'
  | 'motion-control'
  | 'lipsync'
  | 'cinema'
  | 'marketing'
  | 'recast'
  | 'ai-influencer'
  | 'vfx-studio'
  | 'thumbnail-studio'
  | 'storyboard'
  | 'layers'
  | 'workflows'
  | 'agents'
  | 'design-agent'
  | 'apps'
  | 'social-publishing'
  | 'brand-studio'
  | 'photo-studio'
  | 'academy'
  | 'demo-personalization';

/** The media a studio hands to the modal. */
export interface StudioPersonalizeMedia {
  /** → `PersonalizationSource.mediaType`. */
  mediaType: 'image' | 'video';
  /** → `PersonalizationSource.sourceMedia`. Required — the modal has no source without it. */
  url: string | null;
  /** → `PersonalizationSource.poster`. */
  poster?: string | null;
  /** → `PersonalizationSource.aspectRatio`. Seeds the Remotion composition. */
  aspectRatio?: string;
  /** → `PersonalizationSource.duration`. Seeds `durationInFrames`. */
  duration?: number;
  /** → `PersonalizationSource.durationLabel`. */
  durationLabel?: string;
}

/** The prompt/model context of the studio project. */
export interface StudioPersonalizePrompt {
  /** → `PersonalizationSource.shortPrompt` / `fullPrompt` / `originalPrompt`. */
  text: string;
  /** → `PersonalizationSource.model`. */
  model?: string;
  /** → `PersonalizationSource.modelName`. */
  modelName?: string;
}

/** The full studio → modal hand-off payload. */
export interface StudioPersonalizeOptions {
  /** Which studio is handing off. Lands in `PersonalizationProjectState.originStudio`. */
  originStudio: PersonalizationOriginStudio;

  /** The media being personalized. */
  media: StudioPersonalizeMedia;

  /** The studio project's prompt/model context. */
  prompt?: StudioPersonalizePrompt;

  /**
   * Stable id for the studio project (NOT a demo id). Combined with
   * `originStudio` it forms the source id, which the provider keys its
   * persistence and restore on — so it MUST be unique per studio project.
   */
  studioProjectId?: string;

  /** Human label → `PersonalizationSource.title`. */
  title?: string;

  /** → `PersonalizationSource.category`. */
  category?: string;

  /** → `PersonalizationSource.sourceUrl`. */
  sourceUrl?: string;

  /** Pre-seed the modal's brand-asset library (the provider's `assets` state starts empty). */
  initialAssets?: AssetLibrary;

  /** The Remotion template the studio already selected. */
  remotionTemplateId?: string;

  /** Where the finished result is handed off (uses the existing `StudioHandoff` transport). */
  returnTo?: StudioTarget;

  /** Free-form payload carried along with the hand-off. */
  returnPayload?: Record<string, unknown>;

  /** → the provider's access mode. Defaults to `'authenticated'`. */
  access?: PersonalizationAccessMode;

  /** Called once, with the finished outputs, when the run produces a final result. */
  onComplete?: (completion: PersonalizationCompletion) => void;

  /** Element to restore focus to on close → the provider's focus restore. */
  trigger?: HTMLElement | null;
}

/**
 * Runtime guard for a studio hand-off.
 *
 * `openPersonalize` SILENTLY no-ops when the source is rejected by
 * `normalizePersonalizationSource`, so a malformed hand-off would look like a
 * dead button. These checks fail loudly instead.
 *
 * @throws {TypeError} when the origin studio or the source media is missing.
 */
export function assertStudioPersonalizeOptions(options: StudioPersonalizeOptions): void {
  if (!options || typeof options !== 'object') {
    throw new TypeError('StudioPersonalizeOptions: options object is required');
  }
  const origin = typeof options.originStudio === 'string' ? options.originStudio.trim() : '';
  if (!origin) {
    throw new TypeError('StudioPersonalizeOptions.originStudio is required');
  }
  const url = typeof options.media?.url === 'string' ? options.media.url.trim() : '';
  if (!url) {
    throw new TypeError('StudioPersonalizeOptions.media.url is required');
  }
}

/** Deterministic 32-bit FNV-1a fingerprint, as 8 hex chars. Not a security hash. */
export function fingerprint(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Build a complete `PersonalizationSource` for a studio hand-off.
 *
 * The result MUST satisfy `normalizePersonalizationSource` (it requires BOTH
 * `sourceType` and `originalPrompt`), otherwise the modal never opens and
 * nothing tells you why.
 *
 * The `id` is `${originStudio}:${studioProjectId}#${fingerprint(media.url)}`
 * — unique per studio, per studio project AND per uploaded media, because the provider keys project persistence and
 * project restore on `source.id`.
 */
export function buildStudioPersonalizeSource(
  options: StudioPersonalizeOptions,
): PersonalizationSource {
  assertStudioPersonalizeOptions(options)

  const text = options.prompt?.text ?? ''
  const studioKey = options.studioProjectId?.trim()
  const mediaUrl = options.media.url?.trim() || ''
  // A studio key is usually built from a file name or URL basename, so two
  // different uploads can share one. The full media URL's fingerprint keeps
  // their saved projects apart; the same upload always maps to the same id.
  const projectKey = studioKey
    ? mediaUrl
      ? `${studioKey}#${fingerprint(mediaUrl)}`
      : studioKey
    : mediaUrl || 'adhoc'

  return {
    sourceType: 'studio-project',
    id: `${options.originStudio}:${projectKey}`,
    title: options.title?.trim() || 'Personalization',
    mediaType: options.media.mediaType,
    sourceMedia: options.media.url ?? null,
    // An image source needs a poster: the composition draws an image source
    // through its poster (`sourceMedia` is fed to `<Video>`, which cannot
    // decode a still), so an image hand-off without one defaults to itself.
    poster:
      options.media.poster ??
      (options.media.mediaType === 'image' ? options.media.url ?? null : null),
    shortPrompt: text,
    fullPrompt: text,
    originalPrompt: text,
    model: options.prompt?.model,
    modelName: options.prompt?.modelName,
    aspectRatio: options.media.aspectRatio,
    duration: options.media.duration,
    durationLabel: options.media.durationLabel,
    category: options.category,
    sourceUrl: options.sourceUrl,
    sourceMetadata: {
      originStudio: options.originStudio,
      studioProjectId: options.studioProjectId ?? null,
      remotionTemplateId: options.remotionTemplateId ?? null,
      returnTo: options.returnTo ?? null,
      ...(options.returnPayload ? { returnPayload: options.returnPayload } : {}),
    },
  }
}

/** Used when the access provider is unavailable: allow the open to proceed. */
const ALLOW_ENTITLEMENT = async <T,>(_entitlement: string, onAllowed: () => T | Promise<T>) =>
  await onAllowed();

/**
 * The hook every studio uses to open the shared Personalization Modal.
 *
 * Mirrors `AssistStep` / `PublishStep`: a provider mounted once at the shell,
 * a hook, and a zero-state button the studio drops into its source area.
 *
 * MUST be called from inside `<DemoPersonalizeProvider>` —
 * `components/StandaloneShell.js` already mounts it around every studio tab.
 */
export function useStudioPersonalize(): {
  open: (options: StudioPersonalizeOptions) => Promise<unknown>
  isOpen: boolean
  result: GenerationResult | null
} {
  const { openPersonalize, isOpen, result } = useDemoPersonalize()

  // `useSmartVideoAccess()` already degrades to a permissive no-op when its
  // provider is missing, but the context is read directly here so the
  // fallback is explicit and cannot be lost if that provider changes.
  const accessContext = useContext(SmartVideoAccessContext)
  const requireEntitlement = accessContext?.requireEntitlement ?? ALLOW_ENTITLEMENT

  const open = useCallback(
    (options: StudioPersonalizeOptions) => {
      // Fail loudly in development, and never open the modal with a source the
      // provider would silently reject.
      try {
        assertStudioPersonalizeOptions(options)
      } catch (error) {
        console.error('[studioEntry] refusing to open personalization:', error)
        return Promise.resolve(undefined)
      }

      const source = buildStudioPersonalizeSource(options)

      const run = () => {
        openPersonalize({
          source,
          trigger: options.trigger ?? null,
          access: options.access ?? 'authenticated',
          originStudio: options.originStudio,
          initialAssets: options.initialAssets,
          onComplete: options.onComplete,
          returnTo: options.returnTo,
          returnPayload: options.returnPayload,
        })
      }

      // Same gate every studio uses for its own generate action
      // (src/apps/cinema/pages/CinemaGenerate.tsx, src/apps/thumbnail-studio,
      // app/(brand-studio)/photo-studio, …). The modal's own 401/403 handling
      // stays unchanged — this only raises the UpgradeModal up-front.
      return requireEntitlement(ENTITLEMENTS.SMARTVIDEO_GO, run)
    },
    [openPersonalize, requireEntitlement],
  )

  return { open, isOpen, result }
}

/**
 * Drop-in button for a studio's source area — the same shape as `AssistStep`
 * and `PublishStep`. Renders nothing when there is no source media, so it is
 * safe to place unconditionally next to the studio's other affordances.
 */
export function PersonalizeStep({
  options,
  children,
  className,
  style,
  disabled,
}: {
  options: StudioPersonalizeOptions
  children?: ReactNode
  className?: string
  style?: CSSProperties
  disabled?: boolean
}) {
  const { open } = useStudioPersonalize()
  if (!options?.media?.url) return null

  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        void open({ ...options, trigger: event.currentTarget })
      },
      className,
      style,
    },
    children ?? 'Personalize',
  )
}
