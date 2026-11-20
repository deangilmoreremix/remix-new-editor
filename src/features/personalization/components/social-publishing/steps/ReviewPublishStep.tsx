'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  X,
  Send,
} from 'lucide-react';
import type { ReviewPublishStepProps, PublishResult } from '../types';
import AssetPreviewCard from '../review/AssetPreviewCard';
import CopyPreviewCard from '../review/CopyPreviewCard';
import ThumbnailPreviewCard from '../review/ThumbnailPreviewCard';
import DestinationsSummaryCard from '../review/DestinationsSummaryCard';
import { PLATFORM_SPECS, estimateCostUsd, type PlatformId } from '@ohb/shared/api/socialPayloads';

const PLATFORMS: Record<string, { name: string; accent: string }> = {
  youtube: { name: 'YouTube', accent: '#ff0033' },
  instagram: { name: 'Instagram', accent: '#e1306c' },
  tiktok: { name: 'TikTok', accent: '#d9ff00' },
  facebook: { name: 'Facebook', accent: '#1877f2' },
  linkedin: { name: 'LinkedIn', accent: '#0a66c2' },
  pinterest: { name: 'Pinterest', accent: '#e60023' },
  threads: { name: 'Threads', accent: '#fff' },
  x: { name: 'X', accent: '#fff' },
};

function getResultForPlatform(results: PublishResult[], platform: string): PublishResult | undefined {
  return results.find((r) => r.platform === platform);
}

export default function ReviewPublishStep({
  asset,
  copy,
  thumbnail,
  destinations,
  publishResults,
  onConfirm,
  onRetry,
  onBack,
  publishing,
  blockers = [],
}: ReviewPublishStepProps) {
  const [retrying, setRetrying] = useState<string | null>(null);
  const enabledDestinations = destinations.filter((d) => d.enabled && d.accountId);
  const hasEnabledDestinations = enabledDestinations.length > 0;

  const allPublished = publishResults.length > 0 && publishResults.every((r) => r.status === 'published');
  const hasFailures = publishResults.some((r) => r.status === 'failed');
  const hasResults = publishResults.length > 0;

  const publishedCount = publishResults.filter((r) => r.status === 'published').length;
  const failedCount = publishResults.filter((r) => r.status === 'failed').length;
  const inProgressCount = publishResults.filter((r) => r.status === 'queued' || r.status === 'uploading' || r.status === 'processing').length;

  // Retry ONE destination; never re-post to the ones that already succeeded.
  const handleRetry = async (platform: string, accountId?: string) => {
    const id = `${platform}:${accountId ?? ''}`;
    setRetrying(id);
    try {
      await onRetry?.(platform, accountId);
    } finally {
      setRetrying(null);
    }
  };

  const pendingToPublish = enabledDestinations.filter(
    (d) => !publishResults.some((r) => r.platform === d.platform && r.accountId === d.accountId && r.status === 'published'),
  );
  const platformsToPublish = pendingToPublish.map((d) => d.platform as PlatformId);
  const estimatedCost = estimateCostUsd(platformsToPublish);
  const basicPlatforms = [...new Set(platformsToPublish.filter((p) => PLATFORM_SPECS[p]?.confidence === 'basic'))].map((p) => PLATFORM_SPECS[p].label);

  if (allPublished && !publishing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
          <CheckCircle2 size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-base font-semibold text-white mb-1">Published successfully</h2>
        <p className="text-xs text-white/50 mb-6">
          Published to {publishedCount} of {publishResults.length} platforms
        </p>

        <div className="w-full max-w-sm space-y-2 mb-6">
          {publishResults.map((r) => {
            const meta = PLATFORMS[r.platform] || { name: r.platform, accent: '#d9ff00' };
            return (
              <div
                key={`${r.platform}:${r.accountId ?? ''}`}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: r.status === 'published' ? '#10b981' : '#ef4444' }}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs text-white/80">{meta.name}</span>
                    {/* follow-up notes (for example a YouTube thumbnail that could not be applied) */}
                    {r.note && <span className="mt-0.5 max-w-[240px] text-left text-[10px] leading-snug text-white/50">{r.note}</span>}
                  </div>
                </div>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-[#d9ff00] hover:underline"
                  >
                    View <ExternalLink size={10} />
                  </a>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={14} />
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Review & Publish</h2>
          <p className="text-[11px] text-white/40">
            {asset.type === 'video' ? 'Video' : 'Image'} · {asset.studio || 'Social Publishing'}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeft size={13} />
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AssetPreviewCard asset={asset} />
        <ThumbnailPreviewCard thumbnail={thumbnail} />
      </div>

      <CopyPreviewCard copy={copy} />

      <DestinationsSummaryCard destinations={destinations} />

      {hasResults && (
        <div
          aria-live="polite"
          className="rounded-xl border p-3"
          style={{
            background: hasFailures ? 'rgba(239,68,68,0.06)' : 'rgba(217,255,0,0.06)',
            borderColor: hasFailures ? 'rgba(239,68,68,0.15)' : 'rgba(217,255,0,0.15)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white">
              {publishing ? 'Publishing…' : 'Publish results'}
            </span>
            <span className="text-[10px] text-white/40">
              {publishedCount}/{publishResults.length} published
            </span>
          </div>

          <div className="space-y-2">
            {publishResults.map((r) => {
              const meta = PLATFORMS[r.platform] || { name: r.platform, accent: '#d9ff00' };
              const rid = `${r.platform}:${r.accountId ?? ''}`;
              const isPublishing = publishing && (r.status === 'queued' || r.status === 'uploading' || r.status === 'processing');
              const isPublished = r.status === 'published';
              const isFailed = r.status === 'failed';
              const isRetrying = retrying === rid;

              return (
                <div
                  key={rid}
                  className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isPublishing && <Loader2 size={14} className="animate-spin text-[#d9ff00] shrink-0" />}
                    {isPublished && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
                    {isFailed && <XCircle size={14} className="text-red-400 shrink-0" />}
                    {!isPublishing && !isPublished && !isFailed && (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 shrink-0" />
                    )}
                    <span className="text-xs text-white/80 truncate">{meta.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isFailed && r.error && (
                      <span className="text-[10px] text-red-400/80 max-w-[340px] text-right leading-snug">
                        {r.error}
                      </span>
                    )}
                    {isPublished && r.note && (
                      <span className="text-[10px] text-white/50 max-w-[320px] text-right leading-snug">{r.note}</span>
                    )}
                    {isPublished && r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-[#d9ff00] hover:underline"
                      >
                        View <ExternalLink size={10} />
                      </a>
                    )}
                    {isFailed && (
                      <button
                        type="button"
                        onClick={() => handleRetry(r.platform, r.accountId)}
                        disabled={isRetrying}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
                      >
                        {isRetrying ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                        {r.requestId ? 'Check again' : 'Retry'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {publishResults.some((r) => r.status === 'failed' && /disconnected|not found/i.test(r.error || '')) && (
        <p className="text-[11px] text-white/50">
          To reconnect an account, go Back to Destinations, click Connect for that platform, finish signing in and click Refresh, then click Retry here.
        </p>
      )}

      {!publishing && pendingToPublish.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <span className="text-[11px] text-amber-300/80">
              {hasResults ? 'Still to publish' : 'Ready to publish'}: {pendingToPublish.length} destination{pendingToPublish.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[11px] text-white/50" title="Approximate MuAPI charge per publish. See MuAPI pricing for current rates.">
              ≈ ${estimatedCost.toFixed(2)} MuAPI cost
            </span>
          </div>
          {basicPlatforms.length > 0 && (
            <p className="text-[11px] text-white/40">
              {basicPlatforms.join(', ')}: MuAPI documents only the basics (account, media and text) for {basicPlatforms.length === 1 ? 'this platform' : 'these platforms'}, so only those are sent.
            </p>
          )}
        </div>
      )}

      {blockers.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
          <p className="mb-1 font-semibold">Fix this before publishing:</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onConfirm}
        disabled={!hasEnabledDestinations || publishing || blockers.length > 0 || pendingToPublish.length === 0}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[#d9ff00] text-black font-semibold text-sm hover:bg-[#d9ff00]/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {publishing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Publishing…
          </>
        ) : (
          <>
            <Send size={16} />
            {hasResults ? 'Publish remaining' : 'Publish'} ({pendingToPublish.length})
          </>
        )}
      </button>
    </div>
  );
}
