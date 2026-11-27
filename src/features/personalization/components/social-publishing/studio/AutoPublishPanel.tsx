'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { PLATFORM_SPECS } from '@ohb/shared/api/socialPayloads'
import { formatInZone, timeZoneLabel } from '@ohb/shared/social/calendar'
import {
  autoPublishStatus, enableAutoPublish, disableAutoPublish, scheduleJob, cancelJob, retryJob, listJobs, describeResult, cloudReady,
} from '../../../../../lib/social/publishJobs.js'
import { btn, btnPrimary, h4 } from './useStudio'

export interface CloudJob {
  id: string; job_key: string; status: string; scheduled_for: string | null; time_zone: string | null; platforms: string[]
  caption: string; media_url: string; results: Array<{ platform: string; account_id: number | string; status: string; url?: string; error?: string }>
  attempts: number; max_attempts: number; last_error: string | null; published_at: string | null
}

/** What the modal prepares for scheduling: public media, exact MuAPI payloads per destination, and any blockers. */
export interface PreparedSchedule {
  jobs: Array<{ platform: string; account_id: number | string; payload: Record<string, any> }>
  mediaUrl: string
  mediaType: 'video' | 'image'
  caption: string
  hashtags: string[]
  errors: string[]
  notes: string[]
}

/** Loads the owner's automatic jobs and refreshes while any is waiting or publishing. */
export function useCloudJobs(active: boolean) {
  const [jobs, setJobs] = useState<CloudJob[]>([])
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try { setJobs((await listJobs()) as CloudJob[]); setError(null) } catch (e: any) { setError(e?.message || 'Could not load scheduled posts.') }
  }, [])
  useEffect(() => { if (active && cloudReady()) void reload() }, [active, reload])
  const live = jobs.some((j) => j.status === 'scheduled' || j.status === 'publishing')
  useEffect(() => {
    if (!active || !live) return
    const t = setInterval(() => void reload(), 20_000)
    return () => clearInterval(t)
  }, [active, live, reload])
  return { jobs, error, reload }
}

const LABEL: Record<string, string> = { scheduled: 'Scheduled', publishing: 'Publishing', posted: 'Published', failed: 'Failed', cancelled: 'Cancelled' }
const TONE: Record<string, string> = { posted: 'text-emerald-300', failed: 'text-red-300', publishing: 'text-amber-200', scheduled: 'text-white/80', cancelled: 'text-white/40' }

interface Props {
  apiKey: string
  scheduledAt: number | null
  timeZone: string
  canPrepare: boolean
  onPrepare: (scheduledAt: number) => Promise<PreparedSchedule>
  jobs: CloudJob[]
  jobsError: string | null
  reload: () => Promise<void>
}

export function AutoPublishPanel({ apiKey, scheduledAt, timeZone, canPrepare, onPrepare, jobs, jobsError, reload }: Props) {
  const signedIn = cloudReady()
  const [status, setStatus] = useState<{ enabled: boolean; available: boolean } | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => { if (signedIn) void autoPublishStatus().then((s: any) => setStatus({ enabled: !!s.enabled, available: s.available !== false })).catch((e: Error) => setMsg({ kind: 'err', text: e.message })) }, [signedIn])
  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label); setMsg(null)
    try { const text = await fn(); if (text) setMsg({ kind: 'ok', text }); await reload() } catch (e: any) { setMsg({ kind: 'err', text: e?.message || 'That did not work.' }) } finally { setBusy(null) }
  }

  if (!signedIn) return <p className="text-[11px] text-white/50">Sign in to publish automatically. Automatic jobs are saved to your account, never only in this browser.</p>

  return (
    <div className="space-y-3">
      {!status ? <p className="text-[11px] text-white/40">Checking…</p> : !status.available ? (
        <p role="alert" className="text-[11px] text-amber-200">Automatic publishing isn't set up on the server yet (an administrator needs to add the encryption secret).</p>
      ) : status.enabled ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-emerald-300">Automatic publishing is on.</span>
          <button type="button" className={btn} disabled={!!busy} onClick={() => run('off', async () => { await disableAutoPublish(); setStatus({ enabled: false, available: true }); return 'Turned off. Your stored key was deleted and waiting automatic jobs were cancelled.' })}>Turn off &amp; delete my key</button>
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 p-2.5 text-[11px] space-y-2">
          <p className="text-white/70">To publish while your browser is closed, SmartVideo must keep your MuAPI key on the server, encrypted. It is used only to publish the posts you schedule, can't be read back by your browser, and is deleted when you turn this off.</p>
          <label className="flex items-start gap-2"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I allow SmartVideo to publish my scheduled posts to my connected accounts using my MuAPI key.</label>
          <button type="button" className={btnPrimary} disabled={!consent || !apiKey || !!busy} onClick={() => run('on', async () => { await enableAutoPublish(apiKey); setStatus({ enabled: true, available: true }); return 'Your key is stored encrypted on the server. Posts you schedule will now publish by themselves.' })}>Turn on</button>
          {!apiKey && <p className="text-amber-200">Add your MuAPI key in the API keys settings first.</p>}
        </div>
      )}

      {status?.enabled && (
        <div className="space-y-1">
          <button type="button" className={btnPrimary} disabled={!!busy || !canPrepare || !scheduledAt}
            onClick={() => run('schedule', async () => {
              const p = await onPrepare(scheduledAt as number)
              if (p.errors.length) throw new Error(p.errors.join(' '))
              await scheduleJob({ jobs: p.jobs, mediaUrl: p.mediaUrl, mediaType: p.mediaType, caption: p.caption, hashtags: p.hashtags, scheduledFor: new Date(scheduledAt as number), timeZone })
              return `Scheduled. It will publish automatically at ${formatInZone(scheduledAt as number, timeZone)} ${timeZoneLabel(scheduledAt as number, timeZone)}, even if you close this page.${p.notes.length ? ` ${p.notes.join(' ')}` : ''}`
            })}>{busy === 'schedule' ? 'Preparing…' : 'Publish automatically at the time above'}</button>
          {!scheduledAt && <p className="text-[10px] text-white/40">Pick a date and time above first.</p>}
          <p className="text-[10px] text-white/40">The post is sent exactly as prepared now; to change it, cancel the job and schedule a new one.</p>
        </div>
      )}
      {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} className={`text-[11px] ${msg.kind === 'err' ? 'text-red-300' : 'text-emerald-300'}`}>{msg.text}</p>}
      {jobsError && <p role="alert" className="text-[11px] text-red-300">{jobsError}</p>}

      <div>
        <h4 className={h4}>Publishing history</h4>
        <p className="text-[10px] text-white/40 mb-1">Results recorded by the server. Engagement numbers (views, reach) aren't shown: MuAPI doesn't provide them to this app.</p>
        <ul className="space-y-1.5">
          {jobs.map((j) => (
            <li key={j.id} className="rounded-lg border border-white/10 p-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${TONE[j.status] || ''}`}>{LABEL[j.status] || j.status}</span>
                <span className="flex-1 truncate text-white/60">{j.platforms.map((p) => PLATFORM_SPECS[p as keyof typeof PLATFORM_SPECS]?.label ?? p).join(', ')} · {j.scheduled_for ? formatInZone(Date.parse(j.scheduled_for), j.time_zone || timeZone) : 'no time'}</span>
              </div>
              {j.caption && <p className="truncate text-white/40">{j.caption}</p>}
              {(j.results || []).map((r) => <p key={`${r.platform}:${r.account_id}`} className={r.status === 'failed' ? 'text-red-300' : 'text-white/60'}>{PLATFORM_SPECS[r.platform as keyof typeof PLATFORM_SPECS]?.label ?? r.platform}: {describeResult(r)}</p>)}
              {j.status === 'scheduled' && j.attempts > 0 && <p className="text-amber-200">Retry {j.attempts}/{j.max_attempts} pending{j.last_error ? ` — ${j.last_error}` : ''}</p>}
              {j.status === 'failed' && j.last_error && !(j.results || []).length && <p className="text-red-300">{j.last_error}</p>}
              <div className="mt-1 flex gap-1.5">
                {j.status === 'scheduled' && <button type="button" className={btn} disabled={!!busy} onClick={() => run('cancel', async () => { await cancelJob(j.id); return 'Cancelled.' })}>Cancel</button>}
                {(j.status === 'failed' || j.status === 'cancelled') && <button type="button" className={btn} disabled={!!busy} onClick={() => run('retry', async () => { await retryJob(j.id); return j.status === 'failed' ? 'Retrying now. Destinations already published are not sent again.' : 'Scheduled again.' })}>{j.status === 'failed' ? 'Retry' : 'Schedule again'}</button>}
              </div>
            </li>
          ))}
          {jobs.length === 0 && <li className="text-[11px] text-white/40">No automatic posts yet.</li>}
        </ul>
      </div>
    </div>
  )
}
