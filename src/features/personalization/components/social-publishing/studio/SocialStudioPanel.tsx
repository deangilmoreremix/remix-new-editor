'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isPublicMediaUrl, type PlatformId } from '@ohb/shared/api/socialPayloads'
import { validatePost, type Finding } from '@ohb/shared/social/validation'
import { newId, createAutosaver, type DraftRecord } from '@ohb/shared/social/draftStore'
import { localTimeZone, type PlanItem, type PlanStatus } from '@ohb/shared/social/calendar'
import { notify } from '@ohb/shared/social/notifications'
import type { Asset, CopyState, Destination, PublishResult, ThumbnailState } from '../types'
import { useStores, useMediaMeta, field, btn } from './useStudio'
import { PlatformPreviews } from './PlatformPreviews'
import { OptimizePanel } from './OptimizePanel'
import { MediaTools } from './MediaTools'
import { PlanPanel, type Schedule } from './PlanPanel'
import { AutoPublishPanel, useCloudJobs, type PreparedSchedule } from './AutoPublishPanel'
import { rescheduleJob } from '../../../../../lib/social/publishJobs.js'

export interface SocialStudioPanelProps {
  asset: Asset
  copy: CopyState
  writeCopy: CopyState
  socialCopy: CopyState
  thumbnail: ThumbnailState
  destinations: Destination[]
  publishResults: PublishResult[]
  onUpdateWriteCopy: (c: CopyState) => void
  onUpdateThumbnail: (t: ThumbnailState) => void
  onReplaceAsset?: (a: Asset) => void
  onRestoreDraft?: (snapshot: Record<string, any>) => void
  onRetry?: (platform: string, accountId?: string) => void | Promise<void>
  /** MuAPI key from the API-keys settings (sent once to the server only if the owner turns on automatic publishing). */
  apiKey?: string
  /** Makes the media public and builds the exact MuAPI request per destination (same code path as Publish). */
  onPrepareSchedule?: (scheduledAt: number) => Promise<PreparedSchedule>
  /** The modal's existing preview card. */
  children?: React.ReactNode
}

type Tab = 'preview' | 'platforms' | 'optimize' | 'media' | 'plan'
const TABS: [Tab, string][] = [['preview', 'Preview'], ['platforms', 'Platforms'], ['optimize', 'Optimize'], ['media', 'Media'], ['plan', 'Plan']]

export function derivePlanStatus(enabled: Destination[], results: PublishResult[]): PlanStatus {
  const mine = results.filter((r) => enabled.some((d) => d.platform === r.platform && d.accountId === r.accountId))
  if (mine.some((r) => r.status === 'processing' || r.status === 'uploading')) return 'processing'
  if (mine.some((r) => r.status === 'failed')) return 'failed'
  if (enabled.length > 0 && enabled.every((d) => mine.some((r) => r.platform === d.platform && r.accountId === d.accountId && r.status === 'published'))) return 'published'
  if (mine.some((r) => r.status === 'queued')) return 'queued'
  return 'draft'
}

export function SocialStudioPanel(p: SocialStudioPanelProps) {
  const stores = useStores()
  const [tab, setTab] = useState<Tab>('preview')
  const [visited, setVisited] = useState<Set<Tab>>(new Set(['preview']))
  const [draftId, setDraftId] = useState(() => newId())
  const [schedule, setSchedule] = useState<Schedule>({ at: null, timeZone: localTimeZone() })
  const [altText, setAltText] = useState('')
  const [hasCaptions, setHasCaptions] = useState(false)
  const [autosave, setAutosave] = useState<{ state: 'idle' | 'saving' | 'saved' | 'error'; message?: string; at?: number }>({ state: 'idle' })
  const [refreshKey, setRefreshKey] = useState(0)
  const meta = useMediaMeta(p.asset.url, p.asset.type)
  const cloud = useCloudJobs(visited.has('plan'))

  const enabled = useMemo(() => p.destinations.filter((d) => d.enabled && d.accountId), [p.destinations])
  const platforms = useMemo(() => [...new Set(enabled.map((d) => d.platform))] as PlatformId[], [enabled])

  const textFor = useCallback((pl: PlatformId) => {
    const pc = p.copy.platforms?.[pl] || {}
    return (pl === 'youtube' ? pc.description || pc.caption : pc.caption) || p.copy.caption || p.copy.master || ''
  }, [p.copy])
  const titleFor = useCallback((pl: PlatformId) => p.copy.platforms?.[pl]?.title || p.copy.title || '', [p.copy])
  const title = p.copy.title || p.asset.title || p.copy.master?.slice(0, 40) || 'post'

  const status = derivePlanStatus(enabled, p.publishResults)
  const [others, setOthers] = useState<PlanItem[]>([])
  useEffect(() => { if (stores) void stores.drafts.list().then((l) => setOthers(l.filter((d) => d.id !== draftId).map((d) => d.plan))) }, [stores, draftId, refreshKey])

  const findings: Finding[] = useMemo(() => validatePost({
    platforms, mediaType: p.asset.type, mediaUrl: p.asset.url, mediaWidth: meta.width, mediaHeight: meta.height, mediaDurationSeconds: meta.duration,
    hasThumbnail: !!p.thumbnail.imageUrl, hasCaptions: p.asset.type === 'video' ? hasCaptions : undefined, altText,
    captions: Object.fromEntries(platforms.map((pl) => [pl, textFor(pl)])), titles: Object.fromEntries(platforms.map((pl) => [pl, titleFor(pl)])),
    scheduledAt: schedule.at,
    otherSchedules: others.map((o) => ({ id: o.id, scheduledAt: o.scheduledAt, platforms: o.platforms, caption: o.caption })),
  }), [platforms, p.asset, p.thumbnail.imageUrl, meta, hasCaptions, altText, textFor, titleFor, schedule.at, others])
  const scheduleError = findings.find((f) => f.id === 'sched-past' || f.id === 'sched-invalid')?.message ?? null

  // ---- autosave -----------------------------------------------------------
  const snapshot = useMemo(() => ({ writeCopy: p.writeCopy, socialCopy: p.socialCopy, destinations: p.destinations, thumbnail: p.thumbnail, asset: p.asset, schedule, altText, hasCaptions }), [p.writeCopy, p.socialCopy, p.destinations, p.thumbnail, p.asset, schedule, altText, hasCaptions])
  const latest = useRef({ snapshot, title, status, platforms, schedule, draftId, stores })
  latest.current = { snapshot, title, status, platforms, schedule, draftId, stores }
  const hasContent = !!(p.writeCopy.master || p.copy.title || platforms.length || schedule.at)

  const save = useCallback(async () => {
    const c = latest.current
    if (!c.stores) return
    setAutosave({ state: 'saving' })
    const plan: PlanItem = { id: c.draftId, title: c.title, platforms: c.platforms, scheduledAt: c.schedule.at, status: c.status, mediaUrl: isPublicMediaUrl(c.snapshot.asset.url) ? c.snapshot.asset.url : undefined, caption: c.snapshot.writeCopy.master }
    const rec: DraftRecord = { id: c.draftId, updatedAt: Date.now(), title: c.title, snapshot: c.snapshot, plan, mediaRestorable: isPublicMediaUrl(c.snapshot.asset.url) }
    const r = await c.stores.drafts.save(rec)
    setAutosave(r.ok ? { state: 'saved', at: Date.now() } : { state: 'error', message: r.message })
    if (r.ok) setRefreshKey((k) => k + 1)
  }, [])
  const saver = useMemo(() => createAutosaver(save, 900), [save])
  const snapKey = useMemo(() => { try { return JSON.stringify([snapshot, title, status]) } catch { return String(Date.now()) } }, [snapshot, title, status])
  useEffect(() => { if (hasContent && stores) saver.touch() }, [snapKey, hasContent, stores, saver])
  useEffect(() => () => { void saver.flush() }, [saver]) // flush when the modal closes

  // Unsaved-change protection while a save is pending or failed.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (saver.dirty || autosave.state === 'error') { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [saver, autosave.state])

  // Notify on real publish results (the app already observes these; nothing is polled here).
  const prev = useRef(new Map<string, string>())
  useEffect(() => {
    for (const r of p.publishResults) {
      const k = `${r.platform}:${r.accountId ?? ''}`
      if (prev.current.get(k) !== r.status) {
        if (r.status === 'published') notify('published', `${r.platform} post is live.`)
        if (r.status === 'failed') notify(r.requestId ? 'action-required' : 'failed', `${r.platform}: ${r.error ?? 'publishing failed'}`)
        prev.current.set(k, r.status)
      }
    }
  }, [p.publishResults])

  const restore = (rec: DraftRecord) => {
    setDraftId(rec.id)
    const s = rec.snapshot as any
    if (s.schedule) setSchedule(s.schedule)
    setAltText(s.altText ?? ''); setHasCaptions(!!s.hasCaptions)
    p.onRestoreDraft?.(rec.snapshot)
  }

  const go = (t: Tab) => { setTab(t); setVisited((v) => new Set(v).add(t)) }
  const JOB_STATUS: Record<string, PlanStatus> = { scheduled: 'queued', publishing: 'processing', posted: 'published', failed: 'failed' }
  const cloudPlans: PlanItem[] = useMemo(() => cloud.jobs.filter((j) => j.status in JOB_STATUS && j.scheduled_for).map((j) => ({
    id: `job:${j.id}`, title: j.caption?.slice(0, 40) || 'Scheduled post', platforms: j.platforms, scheduledAt: Date.parse(j.scheduled_for as string),
    status: JOB_STATUS[j.status], caption: j.caption,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [cloud.jobs])
  const moveCloud = async (planId: string, to: number) => {
    // moving a waiting job keeps it scheduled; moving a failed one schedules it again at the new time
    await rescheduleJob(planId.slice(4), new Date(to), schedule.timeZone)
    await cloud.reload()
  }
  const errorCount = findings.filter((f) => f.severity === 'error').length

  return (
    <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
      <div role="tablist" aria-label="Studio tools" className="flex flex-wrap gap-1 mb-3">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" id={`studio-tab-${id}`} aria-selected={tab === id} aria-controls={`studio-panel-${id}`} type="button" onClick={() => go(id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${tab === id ? 'bg-white text-black' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
            {label}{id === 'optimize' && errorCount > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[9px] text-white">{errorCount}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="studio-panel-preview" aria-labelledby="studio-tab-preview" hidden={tab !== 'preview'}>{p.children}</div>
      {visited.has('platforms') && <div role="tabpanel" id="studio-panel-platforms" aria-labelledby="studio-tab-platforms" hidden={tab !== 'platforms'}>
        <PlatformPreviews asset={p.asset} platforms={platforms} textFor={textFor} titleFor={titleFor} thumbnailUrl={p.thumbnail.imageUrl} meta={meta} />
      </div>}
      {visited.has('optimize') && <div role="tabpanel" id="studio-panel-optimize" aria-labelledby="studio-tab-optimize" hidden={tab !== 'optimize'}>
        <div className="mb-4 space-y-2">
          {p.asset.type === 'image' && <label className="block text-[11px] text-white/60">Alt text (describe the image)<input className={field} value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="A short description for screen-reader users" /></label>}
          {p.asset.type === 'video' && <label className="flex items-center gap-2 text-[11px] text-white/60"><input type="checkbox" checked={hasCaptions} onChange={(e) => setHasCaptions(e.target.checked)} /> This video already has captions or burned-in subtitles</label>}
        </div>
        <OptimizePanel copy={p.copy} writeCopy={p.writeCopy} onUpdateWriteCopy={p.onUpdateWriteCopy} findings={findings} stores={stores} />
      </div>}
      {visited.has('media') && <div role="tabpanel" id="studio-panel-media" aria-labelledby="studio-tab-media" hidden={tab !== 'media'}>
        <MediaTools asset={p.asset} title={title} meta={meta} onReplaceAsset={p.onReplaceAsset} onUpdateThumbnail={p.onUpdateThumbnail} />
      </div>}
      {visited.has('plan') && <div role="tabpanel" id="studio-panel-plan" aria-labelledby="studio-tab-plan" hidden={tab !== 'plan'}>
        <PlanPanel stores={stores} draftId={draftId} onRestore={restore} schedule={schedule} onSchedule={setSchedule} scheduleError={scheduleError} autosave={autosave} publishResults={p.publishResults} onRetry={p.onRetry} refreshKey={refreshKey} cloudPlans={cloudPlans} onMoveCloud={moveCloud}
          autoPublish={<AutoPublishPanel apiKey={p.apiKey ?? ''} scheduledAt={schedule.at} timeZone={schedule.timeZone} canPrepare={!!p.onPrepareSchedule && platforms.length > 0} onPrepare={(at) => p.onPrepareSchedule!(at)} jobs={cloud.jobs} jobsError={cloud.error} reload={cloud.reload} />} />
      </div>}
      <button type="button" className={`${btn} mt-3`} hidden={tab === 'preview'} onClick={() => go('preview')}>← Back to preview</button>
    </div>
  )
}
