import type { Destination, CopyState, ThumbnailState, Asset, PublishResult } from '@ohb/components/social-publishing/types'
import {
  publishToYouTube,
  publishToInstagram,
  publishToTikTok,
  publishToFacebook,
  publishToLinkedIn,
  publishToPinterest,
  publishToThreads,
  publishToX,
  pollSocialResult,
  setYouTubeThumbnail,
} from '@ohb/lib/muapi'
import { PLATFORM_SPECS, buildPublishPayload, describePublishError, isPublicMediaUrl, type PlatformId } from './socialPayloads'

type PublishFn = (apiKey: string, payload: Record<string, any>) => Promise<any>

export interface PublishDeps {
  publish: Record<PlatformId, PublishFn>
  poll: (apiKey: string, requestId: string) => Promise<any>
  /** MuAPI youtube-set-thumbnail (optional so tests/other callers can omit it). */
  setYouTubeThumbnail?: PublishFn
}

const defaultDeps: PublishDeps = {
  publish: {
    youtube: publishToYouTube,
    instagram: publishToInstagram,
    tiktok: publishToTikTok,
    facebook: publishToFacebook,
    linkedin: publishToLinkedIn,
    pinterest: publishToPinterest,
    threads: publishToThreads,
    x: publishToX,
  },
  poll: (apiKey, requestId) => pollSocialResult(apiKey, requestId, 120, 2000),
  setYouTubeThumbnail,
}

export interface PublishOrchestratorOptions {
  destinations: Destination[]
  asset: Asset
  copy: CopyState
  thumbnail?: ThumbnailState
  apiKey: string
  /** Called after every state change with the full, ordered result list. */
  onProgress?: (results: PublishResult[]) => void
  deps?: PublishDeps
  /** `platform:accountId` -> MuAPI request id of a post that was already accepted; those are re-checked, not re-posted. */
  resumeRequestIds?: Record<string, string>
}

/** The YouTube video id from a publish result (watch / youtu.be / shorts URL, or an explicit id). */
export function extractYouTubeVideoId(out: any): string | null {
  if (!out || typeof out !== 'object') return null
  if (typeof out.video_id === 'string' && out.video_id) return out.video_id
  const url = out.url || out.link || out.permalink
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url)
    const v = u.searchParams.get('v')
    if (v) return v
    const m = u.pathname.match(/^\/(?:shorts\/|embed\/)?([A-Za-z0-9_-]{6,})$/)
    if (m && /youtu\.?be/.test(u.hostname)) return m[1]
  } catch {
    /* not a URL */
  }
  return null
}

function resultUrl(out: any): string | undefined {
  if (!out || typeof out !== 'object') return undefined
  return out.url || out.link || out.permalink || undefined
}

/**
 * After a YouTube video is published, set its thumbnail (MuAPI youtube-set-thumbnail:
 * account_id, video_id, thumbnail_url; JPEG/PNG under 2MB at a public URL). The post is
 * already live, so a failure here is reported as a note, never as a failed publish.
 */
async function applyYouTubeThumbnail(deps: PublishDeps, apiKey: string, accountId: string | undefined, out: any, thumbnailUrl: string): Promise<string> {
  if (!deps.setYouTubeThumbnail) return 'Published. The thumbnail was not set.'
  if (!isPublicMediaUrl(thumbnailUrl)) return 'Published. The thumbnail was not set because it is not a public image link.'
  const videoId = extractYouTubeVideoId(out)
  if (!videoId) return 'Published. The thumbnail was not set because YouTube did not return the video ID. Set it in YouTube Studio.'
  try {
    const submit = await deps.setYouTubeThumbnail(apiKey, { account_id: Number(accountId), video_id: videoId, thumbnail_url: thumbnailUrl })
    const id = String(submit?.request_id || submit?.id || '')
    if (id) await deps.poll(apiKey, id)
    return 'Thumbnail set on YouTube.'
  } catch (err) {
    return `Published, but the thumbnail could not be set: ${describePublishError(err, 'YouTube')} (JPEG or PNG under 2MB; custom thumbnails also need a verified YouTube channel).`
  }
}

/**
 * Publish ONE destination. Never throws: every outcome is a PublishResult
 * ('published' | 'failed'), with a plain-language error.
 */
export async function publishOne(
  destination: Destination,
  asset: Asset,
  copy: CopyState,
  thumbnail: ThumbnailState | undefined,
  apiKey: string,
  deps: PublishDeps = defaultDeps,
  onSubmitted?: (requestId: string) => void,
  /** The post was already accepted by MuAPI: only check its result again, never submit it a second time. */
  resumeRequestId?: string,
): Promise<PublishResult> {
  const platform = destination.platform as PlatformId
  const spec = PLATFORM_SPECS[platform]
  const label = spec?.label ?? destination.platform
  const fail = (error: string, requestId?: string): PublishResult => ({
    platform: destination.platform,
    status: 'failed',
    error,
    accountId: destination.accountId,
    requestId: requestId ?? '',
  })

  if (!apiKey) return fail('Add your MuAPI key in the API keys settings first.', resumeRequestId)
  // A post MuAPI already accepted is only re-checked: its payload is not rebuilt or re-validated, so
  // later edits (even invalid ones) can neither block the check nor cause a second submission.
  let payload: Record<string, any> | null = null
  if (!resumeRequestId) {
    const built = buildPublishPayload({
      platform,
      accountId: destination.accountId ?? '',
      mediaUrl: asset.url,
      mediaType: asset.type,
      copy,
      settings: destination.settings,
      thumbnailUrl: thumbnail?.imageUrl,
    })
    if (!built.payload) return fail(built.errors.join(' '))
    payload = built.payload
  }

  // One completion path for both an immediate and a polled result, so the YouTube
  // thumbnail follow-up (and its note) can never be skipped.
  const finish = async (out: any, reqId: string): Promise<PublishResult> => {
    const result: PublishResult = {
      platform: destination.platform,
      status: 'published',
      url: resultUrl(out),
      accountId: destination.accountId,
      requestId: reqId,
      output: out,
    }
    if (platform === 'youtube' && thumbnail?.imageUrl) {
      result.note = await applyYouTubeThumbnail(deps, apiKey, destination.accountId, out, thumbnail.imageUrl)
    }
    return result
  }

  let requestId = resumeRequestId || ''
  try {
    if (resumeRequestId) {
      const again = await deps.poll(apiKey, resumeRequestId)
      return await finish(again?.output ?? again?.data?.output ?? again, resumeRequestId)
    }
    const submit = await deps.publish[platform](apiKey, payload!)
    requestId = String(submit?.request_id || submit?.id || '')
    if (!requestId) {
      // Some responses complete immediately with an output; anything else is unexpected.
      const done = String(submit?.status || '').toLowerCase() === 'completed'
      const out = submit?.output ?? submit?.data?.output
      if (done && out) return await finish(out, '')
      return fail(`${label} did not accept the post (unexpected response from MuAPI). Nothing was published.`)
    }
    onSubmitted?.(requestId)
    const final = await deps.poll(apiKey, requestId)
    const out = final?.output ?? final?.data?.output ?? final
    return await finish(out, requestId)
  } catch (err) {
    // Once MuAPI has accepted the post (we hold a request id) a polling failure does not mean it did not post.
    if (requestId && !(err as any)?.isRejected) {
      return fail(`${describePublishError(err, label)} The post was already sent to ${label}, so it may still go live. Use "Check again" instead of posting it a second time.`, requestId)
    }
    // A terminal rejection means nothing went live: drop the id so the destination can be submitted again.
    return fail(describePublishError(err, label), (err as any)?.isRejected ? '' : requestId)
  }
}

/**
 * Publish every enabled destination, one after another (so rate limits and
 * per-platform errors stay readable), reporting progress after each change.
 * Replaces any earlier result for the same platform + account.
 */
export async function publishOrchestrator({
  destinations,
  asset,
  copy,
  thumbnail,
  apiKey,
  onProgress,
  deps = defaultDeps,
  resumeRequestIds,
}: PublishOrchestratorOptions): Promise<PublishResult[]> {
  const enabled = destinations.filter((d) => d.enabled && d.accountId)
  if (enabled.length === 0) return []

  const results: PublishResult[] = enabled.map((d) => ({
    platform: d.platform,
    status: 'queued',
    accountId: d.accountId,
    requestId: '',
  }))
  onProgress?.([...results])

  for (let i = 0; i < enabled.length; i++) {
    results[i] = { ...results[i], status: 'processing' }
    onProgress?.([...results])
    // A destination whose post MuAPI already accepted is only re-checked, never submitted a second time.
    const resumeId = resumeRequestIds?.[`${enabled[i].platform}:${enabled[i].accountId ?? ''}`]
    results[i] = await publishOne(enabled[i], asset, copy, thumbnail, apiKey, deps, (requestId) => {
      results[i] = { ...results[i], status: 'processing', requestId }
      onProgress?.([...results])
    }, resumeId)
    onProgress?.([...results])
  }
  return results
}
