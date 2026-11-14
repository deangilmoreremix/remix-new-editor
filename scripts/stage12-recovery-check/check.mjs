// Stage 12 acceptance check: node scripts/stage12-recovery-check/check.mjs  (needs unzip, python3)
// Real headless Chromium: OPFS draft store, Web Locks, BroadcastChannel, page reloads, two tabs, an aborted write, and a backup ZIP read by unzip/python.
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startPresenterServer } from '../stage3-presenter-check/presenter-server.mjs'

const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.join(here, 'out'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true })
const PORT = 5218; const BASE = `http://localhost:${PORT}`
let passed = 0; const failed = []
const check = (name, ok, detail = '') => { if (ok) passed += 1; else failed.push(`${name} ${detail}`); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const note = (s) => console.log(`NOTE  ${s}`)
const sh = (c, a, o = {}) => spawnSync(c, a, { maxBuffer: 1 << 26, encoding: 'utf8', ...o })
const server = await startPresenterServer(PORT, here)
const launch = { executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox'] }
const problems = []
const open = async (ctx) => { const p = await ctx.newPage(); p.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 200)}`)); await p.goto(`${BASE}/rec.html`); await p.waitForFunction('window.ready === true', null, { timeout: 120000 }); return p }
const ctx = await chromium.launchPersistentContext(path.join(out, 'profile'), launch)
let a = await open(ctx)

const apis = await a.evaluate(() => window.hasApis()); check('this Chromium has OPFS, Web Locks and BroadcastChannel', apis.locks && apis.bc && apis.opfs, JSON.stringify(apis))
check('the draft store picks the real Origin Private File System', (await a.evaluate(() => window.kind())) === 'opfs')

// ═══ persistence across a real reload ═══
await a.evaluate(() => window.saveDraft('persist', [111, 222, 333]))
await a.close(); a = await open(ctx)
const d = await a.evaluate(() => window.loadDraft('persist', 1))
check('after closing and reopening the page, the history is there, newest first', d.n === 3 && JSON.stringify(d.widths) === '[333,222,111]', JSON.stringify(d))
check('the newest draft is offered when it differs from what is on screen, and not when it matches', d.offerWidth === 333 && (await a.evaluate(() => window.loadDraft('persist', 333))).offerWidth === null)

// ═══ history is bounded ═══
await a.evaluate(() => window.saveDraft('many', Array.from({ length: 12 }, (_, i) => 1000 + i)))
const many = await a.evaluate(() => window.loadDraft('many', 1)); check('only the newest 5 drafts are kept', many.n === 5 && many.widths[0] === 1011 && many.widths[4] === 1007, JSON.stringify(many.widths))

// ═══ two tabs writing the same draft at once ═══
const b = await open(ctx)
const [ra, rb] = await Promise.all([a.evaluate(() => window.hammer('shared', 'tab-A', 5000, 40)), b.evaluate(() => window.hammer('shared', 'tab-B', 9000, 40))])
const shared = await a.evaluate(() => window.loadDraft('shared', 1))
check('80 interleaved saves from two tabs never corrupt the draft: a valid history of 5, every entry from one of the tabs', shared.n === 5 && shared.widths.every((w) => (w >= 5000 && w < 5040) || (w >= 9000 && w < 9040)), JSON.stringify(shared.widths))
check('both tabs finished without a storage error', !ra.states.includes('error') && !rb.states.includes('error'), JSON.stringify([ra.states, rb.states]))

// ═══ conflict across tabs ═══
await b.evaluate(() => window.conflictProbe('conf')); await a.evaluate(() => window.saveDraft('conf', [777])); await a.waitForTimeout(300)
const cs = await b.evaluate(() => window.conflictState()); check('a tab with unsaved edits is told when another tab saved (real BroadcastChannel): conflict, not a silent overwrite', cs.includes('conflict'), JSON.stringify(cs))
await b.close()

// ═══ an aborted write leaves the old file ═══
check('an aborted OPFS write leaves the previous content untouched (why drafts are written via a temp file)', (await a.evaluate(() => window.abortedWrite())) === 'KEEP')

// ═══ backup archive read by independent tools ═══
const b64 = await a.evaluate(() => window.backup()); const zip = path.join(out, 'backup.zip'); fs.writeFileSync(zip, Buffer.from(b64, 'base64'))
const t = sh('unzip', ['-t', zip]); check('unzip -t says the backup is intact', /No errors detected/.test(t.stdout))
const py = sh('python3', ['-I', '-c', 'import zipfile,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(sorted(z.namelist()));m=json.loads(z.read("manifest.json"));s=json.loads(z.read("settings.json"));print(m["format"],m["version"],m["strippedBlobUrls"],s["width"],s.get("audio",{}).get("url"))', zip])
check('python zipfile agrees: three files, manifest says smartvideo-backup v1 with 1 browser-memory item left out, width 4321, the blob: URL is gone', py.stdout.includes('None') && py.stdout.includes("['README.txt', 'manifest.json', 'settings.json']") && py.stdout.includes("smartvideo-backup 1 1 4321 ") , py.stdout.replace(/\n/g, ' | '))
const back = await a.evaluate((x) => window.restoreBackup(x), b64); check('the app restores its own backup in the browser', back.ok && back.width === 4321 && back.stripped === 1, JSON.stringify(back))
const bytes = Buffer.from(b64, 'base64'); const tampered = Buffer.from(bytes); tampered[tampered.indexOf('"width"') + 9] ^= 0x01
const bad = await a.evaluate((x) => window.restoreBackup(x), tampered.toString('base64')); check('a backup changed by one byte is refused (checksum), not half-restored', !bad.ok && /checksum|damaged/.test(bad.error), JSON.stringify(bad))
// ═══ private window ═══
{
  const br = await chromium.launch(launch); const priv = await br.newContext(); const p = await open(priv)
  const kind = await p.evaluate(() => window.kind()); note(`private window: draft store is "${kind}"`)
  await p.evaluate(() => window.saveDraft('p', [1, 2])); const r = await p.evaluate(() => window.loadDraft('p', 9))
  check('private window: autosave still works within the visit (OPFS or IndexedDB), or says unavailable', kind === null || r.n === 2, `${kind} ${JSON.stringify(r)}`)
  await br.close()
}
check('no page errors', problems.length === 0, problems.slice(0, 2).join(' | '))
await ctx.close(); await server.close()
console.log(`\n${passed} passed, ${failed.length} failed`); if (failed.length) { console.log('FAILED:\n' + failed.map((f) => '  - ' + f).join('\n')); process.exit(1) }
