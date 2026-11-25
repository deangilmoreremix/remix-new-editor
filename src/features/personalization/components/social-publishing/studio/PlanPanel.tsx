'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { PLATFORM_ORDER, PLATFORM_SPECS } from '@ohb/shared/api/socialPayloads'
import { duplicateDraft, cloneCampaign, DraftStore, type DraftRecord } from '@ohb/shared/social/draftStore'
import { viewDays, shiftAnchor, plansByDay, findConflicts, rescheduleToDay, queueBucket, formatInZone, timeZoneLabel, zonedParts, zonedToTimestamp, localTimeZone, isValidTimeZone, dayKey, type CalendarView, type PlanItem } from '@ohb/shared/social/calendar'
import { requestNotificationPermission, notify, dueNow } from '@ohb/shared/social/notifications'
import type { PublishResult } from '../types'
import { useCapabilities, useOnline, type Stores, btn, btnPrimary, field, h4 } from './useStudio'

export interface Schedule { at: number | null; timeZone: string }

interface Props {
  stores: Stores | null
  draftId: string
  /** Restore a saved draft into the modal. */
  onRestore: (rec: DraftRecord) => void
  schedule: Schedule
  onSchedule: (s: Schedule) => void
  scheduleError: string | null
  autosave: { state: 'idle' | 'saving' | 'saved' | 'error'; message?: string; at?: number }
  publishResults: PublishResult[]
  onRetry?: (platform: string, accountId?: string) => void | Promise<void>
  refreshKey: number
}

const BUCKETS: [ReturnType<typeof queueBucket>, string][] = [['drafts', 'Drafts'], ['scheduled', 'Scheduled'], ['inProgress', 'Publishing'], ['published', 'Published'], ['failed', 'Failed']]
const toLocalInput = (ts: number, tz: string) => { const p = zonedParts(ts, tz); const z = (n: number) => String(n).padStart(2, '0'); return `${p.year}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}` }
const fromLocalInput = (v: string, tz: string) => { const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/); return m ? zonedToTimestamp(+m[1], +m[2], +m[3], +m[4], +m[5], tz) : null }
const zones = (): string[] => { try { return (Intl as any).supportedValuesOf('timeZone') } catch { return [localTimeZone(), 'UTC'] } }

export function PlanPanel({ stores, draftId, onRestore, schedule, onSchedule, scheduleError, autosave, publishResults, onRetry, refreshKey }: Props) {
  const caps = useCapabilities()
  const online = useOnline()
  const tz = schedule.timeZone
  const [drafts, setDrafts] = useState<DraftRecord[]>([])
  const [view, setView] = useState<CalendarView>('month')
  const [anchor, setAnchor] = useState(() => Date.now())
  const [pf, setPf] = useState('')
  const [bucketFilter, setBucketFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStart, setBulkStart] = useState('')
  const [bulkHours, setBulkHours] = useState(24)
  const [dupPlatform, setDupPlatform] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [perm, setPerm] = useState(caps.notificationPermission)
  const [dragging, setDragging] = useState<string | null>(null)
  const notified = React.useRef(new Set<string>())

  const reload = useCallback(async () => { if (stores) setDrafts(await stores.drafts.list()) }, [stores])
  useEffect(() => { void reload() }, [reload, refreshKey])

  const plans: PlanItem[] = useMemo(() => drafts.map((d) => d.plan).filter((p) => (!pf || p.platforms.includes(pf)) && (!bucketFilter || queueBucket(p) === bucketFilter)), [drafts, pf, bucketFilter])
  const conflicts = useMemo(() => new Set(findConflicts(plans).flat()), [plans])
  const byDay = useMemo(() => plansByDay(plans, tz), [plans, tz])
  const days = useMemo(() => viewDays(view, anchor, tz), [view, anchor, tz])
  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice((c) => (c === m ? null : c)), 4000) }

  // In-app reminders while the app is open (not a scheduler: nothing publishes by itself).
  useEffect(() => {
    const t = setInterval(() => {
      for (const p of dueNow(plans, Date.now(), notified.current)) { notified.current.add(p.id); notify('due', p.title) }
    }, 30_000)
    return () => clearInterval(t)
  }, [plans])

  const saveRec = async (rec: DraftRecord) => { const r = await stores?.drafts.save(rec); if (r && !r.ok) flash(r.message); await reload() }
  const onDropDay = async (key: string, id: string) => {
    const rec = drafts.find((d) => d.id === id)
    if (!rec || rec.plan.status === 'published') return
    const plan = rescheduleToDay(rec.plan, key, tz)
    if (plan.scheduledAt !== null && plan.scheduledAt < Date.now()) return flash('That day is in the past.')
    await saveRec({ ...rec, plan })
    if (rec.id === draftId) onSchedule({ at: plan.scheduledAt, timeZone: tz })
  }
  const failed = publishResults.filter((r) => r.status === 'failed')

  return (
    <div className="space-y-5">
      <section aria-label="Schedule this post">
        <h4 className={h4}>Plan this post</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-[11px] text-white/60">Date &amp; time<input type="datetime-local" className={field} value={schedule.at ? toLocalInput(schedule.at, tz) : ''} onChange={(e) => onSchedule({ ...schedule, at: e.target.value ? fromLocalInput(e.target.value, tz) : null })} /></label>
          <label className="text-[11px] text-white/60">Time zone
            <select className={field} value={tz} onChange={(e) => isValidTimeZone(e.target.value) && onSchedule({ at: schedule.at ? (() => { const p = zonedParts(schedule.at as number, tz); return zonedToTimestamp(p.year, p.month, p.day, p.hour, p.minute, e.target.value) })() : null, timeZone: e.target.value })}>
              {[...new Set([tz, localTimeZone(), 'UTC', ...zones()])].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
        </div>
        {schedule.at && <p className="mt-1 text-[11px] text-white/60">{formatInZone(schedule.at, tz)} {timeZoneLabel(schedule.at, tz)} · your device: {formatInZone(schedule.at, localTimeZone())} {timeZoneLabel(schedule.at, localTimeZone())}</p>}
        {scheduleError && <p role="alert" className="mt-1 text-[11px] text-red-300">{scheduleError}</p>}
        <p className="mt-1 text-[10px] text-white/40">This is a reminder plan. MuAPI publishes when you press Publish; SmartVideo does not auto-post at the planned time, and this browser's timers aren't relied on for that.</p>
      </section>

      <section aria-label="Drafts and autosave">
        <h4 className={h4}>Drafts</h4>
        <p role="status" className="text-[11px] text-white/60">
          {autosave.state === 'saving' && 'Saving…'}{autosave.state === 'saved' && `Saved ${autosave.at ? formatInZone(autosave.at, tz, { timeStyle: 'short' }) : ''}`}{autosave.state === 'error' && <span className="text-red-300">{autosave.message}</span>}{autosave.state === 'idle' && 'Autosave starts when you write something.'}
          {' · '}<span className={online ? 'text-emerald-300' : 'text-amber-200'}>{online ? 'Online' : 'Offline — drafts keep saving locally; publishing needs a connection'}</span>
        </p>
        <p className="text-[10px] text-white/40 mb-2">Drafts are stored in this browser only (not synced across devices). Media from temporary links may need to be re-added after a reload.</p>
        <ul className="space-y-1.5">
          {drafts.map((d) => {
            const bucket = queueBucket(d.plan)
            return (
              <li key={d.id} className="rounded-lg border border-white/10 p-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <input type="checkbox" aria-label={`Select ${d.title}`} checked={selected.has(d.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); e.target.checked ? n.add(d.id) : n.delete(d.id); return n })} />
                  <span className="flex-1 truncate font-medium text-white/90">{d.title || 'Untitled'}{d.id === draftId && <span className="ml-1 text-[#d9ff00]">· current</span>}</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{BUCKETS.find((b) => b[0] === bucket)?.[1]}</span>
                </div>
                <p className="text-white/40">{d.plan.platforms.map((p) => PLATFORM_SPECS[p as keyof typeof PLATFORM_SPECS]?.label ?? p).join(', ') || 'No destinations'} · {d.plan.scheduledAt ? formatInZone(d.plan.scheduledAt, tz) : 'unscheduled'}{!d.mediaRestorable && ' · media must be re-added'}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button type="button" className={btn} onClick={() => onRestore(d)}>Open</button>
                  <button type="button" className={btn} onClick={async () => { await saveRec(duplicateDraft(d)); flash('Duplicated as a new draft (nothing was published).') }}>Duplicate</button>
                  <select aria-label="Duplicate to platform" className={`${field} !w-auto`} value={dupPlatform} onChange={(e) => setDupPlatform(e.target.value)}><option value="">to platform…</option>{PLATFORM_ORDER.map((p) => <option key={p} value={p}>{PLATFORM_SPECS[p].label}</option>)}</select>
                  <button type="button" className={btn} disabled={!dupPlatform} onClick={async () => { await saveRec(duplicateDraft(d, { platforms: [dupPlatform], titleSuffix: ` (${dupPlatform})` })); flash('Duplicated to another platform.') }}>Go</button>
                  <button type="button" className={`${btn} hover:!text-red-300`} onClick={async () => { await stores?.drafts.remove(d.id); setSelected((s) => { const n = new Set(s); n.delete(d.id); return n }); await reload() }}>Delete</button>
                </div>
              </li>
            )
          })}
          {drafts.length === 0 && <li className="text-[11px] text-white/40">No saved drafts yet.</li>}
        </ul>
        {selected.size > 0 && (
          <div className="mt-2 rounded-lg border border-white/10 p-2 text-[11px] space-y-2">
            <p className="text-white/70">{selected.size} selected</p>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="text-white/60">Start<input type="datetime-local" className={field} value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} /></label>
              <label className="text-white/60">Every (hours)<input type="number" min={1} className={`${field} !w-20`} value={bulkHours} onChange={(e) => setBulkHours(Math.max(1, +e.target.value))} /></label>
              <button type="button" className={btnPrimary} disabled={!fromLocalInput(bulkStart, tz)} onClick={async () => {
                const start = fromLocalInput(bulkStart, tz) as number
                if (start < Date.now()) return flash('Pick a start time in the future.')
                let i = 0
                for (const d of drafts.filter((x) => selected.has(x.id) && x.plan.status !== 'published')) { await saveRec({ ...d, plan: { ...d.plan, scheduledAt: start + i++ * bulkHours * 3_600_000 } }) }
                flash('Plans scheduled.')
              }}>Bulk schedule</button>
              <button type="button" className={btn} onClick={async () => { const src = drafts.filter((x) => selected.has(x.id)); for (const c of cloneCampaign(src, 7 * 86_400_000)) await saveRec(c); flash('Campaign cloned one week later.') }}>Clone campaign +7d</button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Content calendar">
        <h4 className={h4}>Calendar · {timeZoneLabel(anchor, tz)}</h4>
        <div className="flex flex-wrap gap-2 items-center mb-2">
          {(['day', 'week', 'month'] as CalendarView[]).map((v) => <button key={v} type="button" aria-pressed={view === v} className={`${btn} ${view === v ? '!bg-white/15 !text-white' : ''}`} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
          <button type="button" aria-label="Previous" className={btn} onClick={() => setAnchor(shiftAnchor(view, anchor, -1, tz))}>‹</button>
          <span className="text-[11px] text-white/70">{formatInZone(anchor, tz, view === 'month' ? { month: 'long', year: 'numeric' } : { dateStyle: 'medium' })}</span>
          <button type="button" aria-label="Next" className={btn} onClick={() => setAnchor(shiftAnchor(view, anchor, 1, tz))}>›</button>
          <button type="button" className={btn} onClick={() => setAnchor(Date.now())}>Today</button>
          <select aria-label="Filter by platform" className={`${field} !w-auto`} value={pf} onChange={(e) => setPf(e.target.value)}><option value="">All platforms</option>{PLATFORM_ORDER.map((p) => <option key={p} value={p}>{PLATFORM_SPECS[p].label}</option>)}</select>
          <select aria-label="Filter by status" className={`${field} !w-auto`} value={bucketFilter} onChange={(e) => setBucketFilter(e.target.value)}><option value="">All statuses</option>{BUCKETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        <div className={`grid gap-1 ${view === 'day' ? 'grid-cols-1' : 'grid-cols-7'}`}>
          {days.map((k) => {
            const items = byDay.get(k) || []
            const today = k === dayKey(Date.now(), tz)
            return (
              <div key={k} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || dragging; if (id) void onDropDay(k, id); setDragging(null) }}
                className={`min-h-[56px] rounded-md border p-1 text-[10px] ${today ? 'border-[#d9ff00]/60' : 'border-white/10'} ${k.slice(0, 7) !== dayKey(anchor, tz).slice(0, 7) && view === 'month' ? 'opacity-40' : ''}`}>
                <div className="text-white/50">{Number(k.slice(8))}</div>
                {items.map((p) => (
                  <div key={p.id} draggable={p.status !== 'published'} onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); setDragging(p.id) }}
                    title={`${p.title} · ${formatInZone(p.scheduledAt as number, tz, { timeStyle: 'short' })}${conflicts.has(p.id) ? ' · conflicts with another post' : ''}`}
                    className={`mt-0.5 truncate rounded px-1 py-0.5 ${conflicts.has(p.id) ? 'bg-red-500/30 text-red-100' : p.status === 'published' ? 'bg-emerald-500/20 text-emerald-100' : p.status === 'failed' ? 'bg-red-500/20 text-red-200' : 'bg-white/10 text-white/90'} ${p.status !== 'published' ? 'cursor-grab' : ''}`}>
                    {formatInZone(p.scheduledAt as number, tz, { hour: 'numeric', minute: '2-digit' })} {p.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        {conflicts.size > 0 && <p className="mt-1 text-[11px] text-red-200">Red items share a platform within 30 minutes of another post.</p>}
        <p className="mt-1 text-[10px] text-white/40">Drag a post to another day to reschedule (keeps its time of day). Published posts can't be moved.</p>
      </section>

      <section aria-label="Publishing queue">
        <h4 className={h4}>Publishing queue</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-center">
          {BUCKETS.map(([k, l]) => <div key={k} className="rounded-lg border border-white/10 py-1.5"><div className="text-sm font-semibold text-white">{drafts.filter((d) => queueBucket(d.plan) === k).length}</div><div className="text-[10px] text-white/40">{l}</div></div>)}
        </div>
        {failed.length > 0 && (
          <ul className="mt-2 space-y-1">
            {failed.map((r) => (
              <li key={`${r.platform}:${r.accountId}`} className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-[11px] text-red-200">
                <span className="flex-1">{PLATFORM_SPECS[r.platform as keyof typeof PLATFORM_SPECS]?.label ?? r.platform}: {r.error}</span>
                <button type="button" className={btn} disabled={!onRetry} onClick={() => void onRetry?.(r.platform, r.accountId)}>{r.requestId ? 'Check again' : 'Retry'}</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Notifications">
        <h4 className={h4}>Notifications</h4>
        {perm === 'unsupported' ? <p className="text-[11px] text-white/50">This browser doesn't support notifications.</p> : perm === 'denied' ? <p className="text-[11px] text-amber-200">Notifications are blocked. Enable them in your browser's site settings, then reload.</p> : perm === 'granted' ? <p className="text-[11px] text-emerald-300">On — you'll see published/failed results and due reminders while SmartVideo is open.</p> : (
          <button type="button" className={btn} onClick={async () => setPerm(await requestNotificationPermission())}>Enable notifications</button>
        )}
        <p className="mt-1 text-[10px] text-white/40">Background push (when the app is closed) needs the server-side push delivery; these alerts only fire while the app is open.</p>
      </section>
      {notice && <p role="status" className="text-[11px] text-amber-200">{notice}</p>}
    </div>
  )
}
