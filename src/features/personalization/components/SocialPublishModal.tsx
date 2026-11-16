'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { mergeCopy } from './social-publishing/mergeCopy';
import { publishOrchestrator, publishOne } from '@ohb/shared/api/publishOrchestrator';
import { PLATFORM_ORDER, PLATFORM_SPECS, buildPublishPayload, isPublicMediaUrl, type PlatformId } from '@ohb/shared/api/socialPayloads';
import { uploadPublishMedia } from '@ohb/lib/muapi';
import { prepareThumbnailFile } from '@ohb/lib/thumbnailUpload';
import SocialPublishStepper from './social-publishing/SocialPublishStepper';
import { WriteStep } from './social-publishing/steps/WriteStep';
import ThumbnailStep from './social-publishing/steps/ThumbnailStep';
import DestinationsStep from './social-publishing/steps/DestinationsStep';
import ReviewPublishStep from './social-publishing/steps/ReviewPublishStep';
import type {
  Asset,
  CopyState,
  ThumbnailState,
  Destination,
  PublishResult,
  WriteCopyState,
} from './social-publishing/types';

interface SocialPublishModalProps {
  open: boolean;
  onClose: () => void;
  apiKey: string;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  asset: Asset | null;
  writeCopy: WriteCopyState;
  socialCopy: CopyState;
  thumbnail: ThumbnailState;
  destinations: Destination[];
  publishResults: PublishResult[];
  updateWriteCopy: (copy: WriteCopyState) => void;
  updateSocialCopy: (copy: CopyState) => void;
  updateThumbnail: (state: ThumbnailState) => void;
  updateDestinations: (destinations: Destination[]) => void;
  /** Identifies the publishing session; results for an older session are ignored. */
  sessionId?: number;
  updatePublishResults: (results: PublishResult[], forSession?: number) => void;
  /** Opens the API keys modal (AI writing uses the customer's own OpenAI key). */
  onRequestApiKey?: () => void;
}

const TOTAL_STEPS = 4;

export default function SocialPublishModal({
  open,
  onClose,
  apiKey,
  currentStep,
  setCurrentStep,
  asset,
  writeCopy,
  socialCopy,
  thumbnail,
  destinations,
  publishResults,
  updateWriteCopy,
  updateSocialCopy,
  updateThumbnail,
  updateDestinations,
  sessionId,
  updatePublishResults,
  onRequestApiKey,
}: SocialPublishModalProps) {
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  // Local/temporary media (blob:, data:) is uploaded once and the hosted URL reused.
  const [hostedUrl, setHostedUrl] = useState<{ from: string; url: string } | null>(null);
  // Generated thumbnails are data: URLs; they are uploaded once so the platforms get a public link.
  const [hostedThumb, setHostedThumb] = useState<{ from: string; url: string } | null>(null);

  // The copy every step after Write (and publishing) uses: Write-step text wins.
  const copy = useMemo(() => mergeCopy(writeCopy, socialCopy), [writeCopy, socialCopy]);
  // Publishing for one asset can still be running when the modal is reopened for another.
  // Handlers remember the session they started in and stop touching state once it has changed.
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;
  useEffect(() => {
    setPublishing(false);
    setPublishError(null);
  }, [sessionId]);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleContinue = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, setCurrentStep]);


  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onClose();
    }
  }, [currentStep, setCurrentStep, onClose]);

  /** Make sure MuAPI can fetch the media: upload local/temporary files first. */
  const resolveAsset = useCallback(async (a: Asset): Promise<Asset> => {
    if (isPublicMediaUrl(a.url)) return a;
    if (hostedUrl && hostedUrl.from === a.url) return { ...a, url: hostedUrl.url };
    let blob: Blob;
    try {
      blob = await (await fetch(a.url)).blob();
    } catch {
      throw new Error('This file is only available on your device and could not be read. Download it and upload it, or regenerate it, then publish again.');
    }
    const type = blob.type || (a.type === 'video' ? 'video/mp4' : 'image/png');
    const file = new File([blob], `publish-${Date.now()}.${type.split('/')[1]?.split(';')[0] || 'bin'}`, { type });
    const url = await uploadPublishMedia(apiKey, file);
    setHostedUrl({ from: a.url, url });
    return { ...a, url };
  }, [apiKey, hostedUrl]);

  /** Same idea for the thumbnail: upload generated/edited images and use the hosted link. */
  const resolveThumbnail = useCallback(async (t: typeof thumbnail): Promise<typeof thumbnail> => {
    const src = t?.imageUrl;
    if (!src || isPublicMediaUrl(src)) return t;
    if (hostedThumb && hostedThumb.from === src) return { ...t, imageUrl: hostedThumb.url };
    const url = await uploadPublishMedia(apiKey, await prepareThumbnailFile(src));
    setHostedThumb({ from: src, url });
    return { ...t, imageUrl: url };
  }, [apiKey, hostedThumb]);

  // Only YouTube (thumbnail) and Instagram *videos* (cover) use the thumbnail; images and other platforms never need it uploaded.
  const usesThumbnail = (platforms: string[]) => platforms.some((p) => p === 'youtube' || (p === 'instagram' && asset?.type === 'video'));

  const key = (d: { platform: string; accountId?: string }) => `${d.platform}:${d.accountId ?? ''}`;

  /**
   * THE publish path (Destinations "Publish Now", Review "Publish", footer
   * "Publish"). Skips destinations that already published, so a second click can
   * never post twice; failed ones are retried.
   */
  const handlePublish = useCallback(
    async (dests: Destination[] = destinations) => {
      if (!asset || publishing) return;
      const already = new Set(publishResults.filter((r) => r.status === 'published').map(key));
      const todo = dests.filter((d) => d.enabled && d.accountId && !already.has(key(d)));
      if (todo.length === 0) return;
      const session = sessionId;
      setPublishing(true);
      setPublishError(null);
      try {
        const ready = await resolveAsset(asset);
        const readyThumb = usesThumbnail(todo.map((d) => d.platform)) ? await resolveThumbnail(thumbnail) : thumbnail;
        const keep = publishResults.filter((r) => !todo.some((d) => key(d) === key(r)));
        // Destinations whose post MuAPI already accepted (a failed poll kept the request id) are re-checked, not re-posted.
        const resumeRequestIds: Record<string, string> = {};
        for (const r of publishResults) if (r.status === 'failed' && r.requestId) resumeRequestIds[key(r)] = r.requestId;
        await publishOrchestrator({
          resumeRequestIds,
          destinations: todo,
          asset: ready,
          copy,
          thumbnail: readyThumb,
          apiKey,
          onProgress: (r) => updatePublishResults([...keep, ...r], session),
        });
      } catch (err) {
        if (sessionRef.current === session) setPublishError(err instanceof Error ? err.message : 'Publishing failed.');
      } finally {
        if (sessionRef.current === session) setPublishing(false);
      }
    },
    [asset, publishing, publishResults, destinations, resolveAsset, resolveThumbnail, copy, thumbnail, apiKey, updatePublishResults, sessionId],
  );

  const handleRetry = useCallback(
    async (platform: string, accountId?: string) => {
      const dest = destinations.find((d) => d.platform === platform && d.accountId === accountId);
      if (!dest || !asset || publishing) return;
      const session = sessionId;
      setPublishing(true);
      setPublishError(null);
      try {
        const ready = await resolveAsset(asset);
        const readyThumb = usesThumbnail([dest.platform]) ? await resolveThumbnail(thumbnail) : thumbnail;
        const others = publishResults.filter((r) => !(r.platform === platform && r.accountId === accountId));
        updatePublishResults([...others, { platform, accountId, status: 'processing', requestId: '' }], session);
        // An already-accepted post is only re-checked, never submitted again.
        const earlier = publishResults.find((r) => r.platform === platform && r.accountId === accountId && r.status === 'failed' && r.requestId);
        const result = await publishOne(dest, ready, copy, readyThumb, apiKey, undefined, undefined, earlier?.requestId);
        updatePublishResults([...others, result], session);
      } catch (err) {
        if (sessionRef.current === session) setPublishError(err instanceof Error ? err.message : 'Publishing failed.');
      } finally {
        if (sessionRef.current === session) setPublishing(false);
      }
    },
    [destinations, asset, publishing, publishResults, resolveAsset, resolveThumbnail, copy, thumbnail, apiKey, updatePublishResults, sessionId],
  );

  /** Why the selected destinations cannot be published right now (shown in the UI). */
  const blockers = useMemo(() => {
    const out: string[] = [];
    if (!apiKey) out.push('Add your MuAPI key in the API keys settings first.');
    for (const d of destinations.filter((x) => x.enabled && x.accountId)) {
      const spec = PLATFORM_SPECS[d.platform as PlatformId];
      const mediaUrlForCheck = isPublicMediaUrl(asset?.url) ? (asset?.url as string) : 'https://placeholder.invalid/media';
      const built = buildPublishPayload({ platform: d.platform as PlatformId, accountId: d.accountId ?? '', mediaUrl: mediaUrlForCheck, mediaType: asset?.type || 'video', copy, settings: d.settings, thumbnailUrl: thumbnail?.imageUrl });
      for (const e of built.errors) out.push(`${spec?.label ?? d.platform}: ${e}`);
    }
    return out;
  }, [apiKey, destinations, asset, copy, thumbnail]);

  const canContinue = useMemo(() => {
    if (!asset) return false;
    if (currentStep === 0) return true;
    if (currentStep === 1) return true;
    if (currentStep === 2) return destinations.length > 0;
    if (currentStep === 3) return destinations.some((d) => d.enabled && d.accountId);
    return false;
  }, [asset, currentStep, destinations]);

  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const showPreview = asset && (asset.type === 'image' || asset.type === 'video');

  if (!open) return null;

  const safeAsset = asset as Asset;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-publish-title"
        aria-live="polite"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        className="w-full max-w-[1100px] lg:max-w-[1300px] max-h-[90vh] flex flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl overflow-hidden"
        style={{ animation: 'fadeInUp 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] flex-shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2">
              <Share2 size={18} className="text-[#d9ff00] flex-shrink-0" />
              <div>
                <h2 id="social-publish-title" className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
                  Publish to social
                </h2>
                <p className="text-[11px] text-white/40 leading-tight">
                  {safeAsset.type === 'image' ? 'Image' : 'Video'} · {PLATFORM_ORDER.filter((p) => PLATFORM_SPECS[p].media.includes(safeAsset.type)).map((p) => PLATFORM_SPECS[p].label).join(' · ')}
                </p>
              </div>
            </div>
            <div className="hidden sm:block">
              <SocialPublishStepper currentStep={currentStep} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile stepper */}
        <div className="sm:hidden px-5 pt-3 flex-shrink-0">
          <SocialPublishStepper currentStep={currentStep} />
        </div>

        {/* Scrollable workspace */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main editor */}
            <div className="flex-1 min-w-0">
              {currentStep === 0 && safeAsset && (
                <WriteStep asset={safeAsset} copy={writeCopy} onUpdateCopy={updateWriteCopy} sessionId={sessionId} onRequestApiKey={onRequestApiKey ? () => { onClose(); onRequestApiKey(); } : undefined} />
              )}
              {currentStep === 1 && safeAsset && (
                <ThumbnailStep
                  asset={safeAsset}
                  thumbnail={thumbnail}
                  onUpdateThumbnail={updateThumbnail}
                  copy={copy}
                  onRequestApiKey={onRequestApiKey ? () => { onClose(); onRequestApiKey(); } : undefined}
                />
              )}
              {currentStep === 2 && safeAsset && (
                <DestinationsStep
                  asset={safeAsset}
                  copy={copy}
                  destinations={destinations}
                  onChange={updateDestinations}
                  publishResults={publishResults}
                  onPublish={handlePublish}
                  onRetry={handleRetry}
                  onUpdatePublishResults={updatePublishResults}
                  publishing={publishing}
                  apiKey={apiKey}
                  mediaType={safeAsset.type}
                />
              )}
              {currentStep === 3 && (
                <ReviewPublishStep
                  asset={safeAsset}
                  copy={copy}
                  thumbnail={thumbnail}
                  destinations={destinations}
                  publishResults={publishResults}
                  onConfirm={() => handlePublish(destinations)}
                  onRetry={handleRetry}
                  onBack={handleBack}
                  publishing={publishing}
                  blockers={blockers}
                />
              )}
            </div>

            {/* Live preview */}
            {showPreview && (
              <div className="w-full lg:w-[340px] flex-shrink-0">
                <div className="sticky top-0 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-white/40 mb-3">
                    Preview
                  </h3>
                  <div className="aspect-video rounded-lg overflow-hidden bg-black/50 flex items-center justify-center">
                    {safeAsset.type === 'image' ? (
                      <img
                        src={safeAsset.url}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <video
                        src={safeAsset.url}
                        controls
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-white/50 truncate" title={safeAsset.url}>
                      {safeAsset.url}
                    </p>
                    {copy.title && (
                      <p className="text-xs text-[var(--text-primary)] font-medium truncate">
                        {copy.title}
                      </p>
                    )}
                    {(copy.caption || copy.master) && (
                      <p className="text-xs text-white/60 line-clamp-2">
                        {copy.caption || copy.master}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {publishError && (
          <div role="alert" className="mx-5 mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{publishError}</div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
          >
            <ChevronLeft size={16} />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">
              Step {currentStep + 1} of {TOTAL_STEPS}
            </span>
            <button
              type="button"
              onClick={isLastStep ? () => { void handlePublish(); } : handleContinue}
              disabled={!canContinue || (isLastStep && (publishing || blockers.length > 0))}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#d9ff00] text-black font-semibold text-sm hover:bg-[#d9ff00]/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLastStep ? 'Publish' : 'Continue'}
              {!isLastStep && <ChevronRight size={16} />}
            </button>
          </div>
        </div>

        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            div[class*='max-w'] {
              animation: none;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
