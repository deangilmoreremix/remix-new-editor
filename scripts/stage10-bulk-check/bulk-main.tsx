// Browser side of the Stage 10 check: the REAL CSV parser, batch runner, IndexedDB stores, per-recipient props, the REAL composition
// (thumbnail, GIF and MP4 export) and the real package builder. Nothing in the pipeline is faked. A page reload is a real reload.
import { createDefaultPreviewSettings, normalizePreviewSettings } from '@ohb/shared/personalization/preview/presets'
import { buildRecipients, parseCsv, suggestMapping, type Recipient } from '@ohb/shared/personalization/bulk/csv'
import { createIdbStores, createJob, markStepsMissing, runBatch, summarize, type BatchJob } from '@ohb/shared/personalization/bulk/batchJob'
import { templateFingerprint } from '@ohb/shared/personalization/bulk/recipientInput'
import { buildPackage } from '@ohb/shared/personalization/bulk/outputPackage'
import { createBatchRunner } from '@ohb/shared/personalization/guided/batchSteps'
import { createWebStillDeps, makeThumbnail } from '@ohb/shared/personalization/guided/renderStills'

const W = window as any
const b64 = async (blob: Blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s) }
const RK = (id: string) => `${id}/recipients`

const baseProps = (cfg: any, headline: string) => {
  const base = createDefaultPreviewSettings()
  const settings = normalizePreviewSettings({ ...base, width: 320, height: 180, fps: 30, durationInFrames: cfg.frames, showEndCard: false, brandColors: { ...base.brandColors, backgroundDim: 0 },
    layers: [{ id: 'headline', kind: 'headline', visible: true, x: 0.5, y: 0.25, scale: 0.16, animation: 'none', animationDelay: 0, startFrame: 0, opacity: 1, text: headline, color: '#ffffff' }],
    thumbnail: { frame: 10, width: 320, playButton: false }, gif: { startSec: 0, durationSec: 1.2, fps: 6, width: 240, dither: false, loop: true } } as any)
  return { videoUrl: cfg.videoUrl, posterUrl: null, isImageSource: false, audioUrl: null, settings, brand: { businessName: 'Base Co', headline: 'Base Co', offer: '', cta: 'Visit base.com', phone: '', website: 'https://base.com', logoUrl: null, productUrl: null, serviceUrl: null } } as any
}
const recipientsFrom = (csv: string): Recipient[] => { const p = parseCsv(csv); return buildRecipients(p.rows, p.header, suggestMapping(p.header)).recipients }
const log = (e: string) => { const a = JSON.parse(localStorage.getItem('calls') || '[]'); a.push(e); localStorage.setItem('calls', JSON.stringify(a)) }

W.parse = (csv: string) => { const p = parseCsv(csv); const r = buildRecipients(p.rows, p.header, suggestMapping(p.header)); return { counts: r.counts, issues: r.issues, ids: r.recipients.map((x) => x.id), companies: r.recipients.map((x) => x.company) } }

/** Starts a batch. `pauseAtCall` (1-based) aborts the run at the START of that step call, like closing the tab in the middle of a recipient. */
W.start = async (cfg: any) => {
  localStorage.setItem('calls', '[]')
  const base = baseProps(cfg, 'Hi {{company}}'); const recipients = recipientsFrom(cfg.csv)
  const { store, artifacts } = await createIdbStores('stage10check')
  await store.clear()
  const job = createJob(recipients.map((r) => ({ id: r.id, label: r.company })), cfg.steps, templateFingerprint(base.settings))
  await artifacts.put(RK(job.id), new Blob([JSON.stringify(recipients)], { type: 'application/json' })); await store.save(job)
  return run(job, base, recipients, store, artifacts, cfg.pauseAtCall)
}
W.resume = async (cfg: any) => {
  const base = baseProps(cfg, 'Hi {{company}}'); const { store, artifacts } = await createIdbStores('stage10check')
  const job = await store.load(); if (!job) return { ok: false, error: 'no saved job' }
  const recipients = JSON.parse(await (await artifacts.get(RK(job.id)))!.text()) as Recipient[]
  const same = job.templateHash === templateFingerprint(base.settings)
  return { ...(await run(job, base, recipients, store, artifacts, undefined)), sameDesign: same }
}
async function run(job: BatchJob, base: any, recipients: Recipient[], store: any, artifacts: any, pauseAtCall?: number) {
  const ac = new AbortController(); let n = 0; const real = createBatchRunner(base, recipients)
  const deps = { async runStep(step: any, item: any, ctx: any) {
    n += 1; log(`start:${item.id}:${step}`)
    if (pauseAtCall && n === pauseAtCall) ac.abort()
    const r = await real.runStep(step, item, ctx); log(`end:${item.id}:${step}`); return r
  } }
  const t0 = performance.now(); const out = await runBatch(job, deps, { store, artifacts, signal: ac.signal, concurrency: 1, maxAttempts: 2 })
  return { ok: true, state: out.state, summary: summarize(out), ms: Math.round(performance.now() - t0), items: out.items.map((i) => ({ id: i.id, status: i.status, steps: i.steps })), calls: JSON.parse(localStorage.getItem('calls') || '[]'), message: out.message }
}
W.idb = async () => { const { store } = await createIdbStores('stage10check'); const j = await store.load(); return j ? { state: j.state, items: j.items.map((i) => i.status) } : null }
W.pack = async (links: Record<string, string>) => {
  const { store, artifacts } = await createIdbStores('stage10check'); const job = (await store.load())!
  const recipients = JSON.parse(await (await artifacts.get(RK(job.id)))!.text()) as Recipient[]
  const pkg = await buildPackage({ job, recipients, artifacts, links }); return { b64: await b64(pkg.blob), files: pkg.files, included: pkg.included, missing: pkg.missing }
}
W.discard = async () => { const { store, artifacts } = await createIdbStores('stage10check'); const job = await store.load(); if (job) await artifacts.clearJob(job.id); await store.clear(); return W.idb() }
/** The same thumbnail made the ordinary single-video way, with the recipient's text typed in literally (no {{field}}). */
W.literalThumb = async (cfg: any, text: string) => { const p = baseProps(cfg, text); const deps = await createWebStillDeps(p); const t = await makeThumbnail(p, deps, { format: 'jpeg' }); return b64(t.blob) }
W.ready = true
/** Diagnostic: which stored files can be read, with the error for the ones that cannot. */
W.diag = async () => {
  const { store, artifacts } = await createIdbStores('stage10check'); const job = (await store.load())!; const res: any[] = []
  for (const it of job.items) for (const step of job.stepNames) {
    const k = `${job.id}/${it.id}/${step}`; const b = await artifacts.get(k); let one = 'n/a', full = 'n/a'
    if (b) { try { await b.slice(0, 1).arrayBuffer(); one = 'ok' } catch (e: any) { one = `${e.name}` } try { await b.arrayBuffer(); full = 'ok' } catch (e: any) { full = `${e.name}` } }
    res.push({ k: k.slice(-24), status: it.steps[step]?.status, size: b?.size ?? null, one, full })
  }
  return res
}

/** What the panel's Download button does when files have been lost: package → mark the lost steps → resume → package again. */
W.packRepair = async (cfg: any) => {
  const { store, artifacts } = await createIdbStores('stage10check'); let job = (await store.load())!
  const recipients = JSON.parse(await (await artifacts.get(RK(job.id)))!.text()) as Recipient[]
  let pkg = await buildPackage({ job, recipients, artifacts }); const first = { included: pkg.included, missing: pkg.missing }; let resumed: any = null
  if (pkg.missing > 0) {
    job = markStepsMissing(job, pkg.missingSteps); await store.save(job)
    resumed = await W.resume(cfg)
    job = (await store.load())!; pkg = await buildPackage({ job, recipients, artifacts })
  }
  return { first, remadeSteps: resumed ? resumed.calls.filter((c: string) => c.startsWith('end:')).length : 0, included: pkg.included, missing: pkg.missing, b64: await b64(pkg.blob) }
}
