// Stage 10 acceptance check. Usage: node scripts/stage10-bulk-check/check.mjs   (needs ffmpeg, ffprobe, unzip, python3)
// Real headless Chromium + real IndexedDB + the real composition: a CSV becomes a batch; each recipient gets a thumbnail, GIF and MP4
// from their own copy of the design; the batch is interrupted in the middle of a recipient, the PAGE IS RELOADED, and it resumes without
// redoing finished work; the downloaded ZIP is verified by independent tools (unzip, python zipfile, ffprobe, ffmpeg).
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startPresenterServer } from '../stage3-presenter-check/presenter-server.mjs'

const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.join(here, 'out'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true })
const PORT = 5216; const BASE = `http://localhost:${PORT}`
let passed = 0; const failed = []
const check = (name, ok, detail = '') => { if (ok) passed += 1; else failed.push(`${name} ${detail}`); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const note = (s) => console.log(`NOTE  ${s}`)
const sh = (cmd, args, o = {}) => { const r = spawnSync(cmd, args, { maxBuffer: 1 << 28, ...o }); if (r.status !== 0 && !o.allowFail) throw new Error(`${cmd} ${args.slice(0, 3).join(' ')}: ${String(r.stderr).slice(0, 400)}`); return r }
const probe = (f, entries) => JSON.parse(sh('ffprobe', ['-v', 'error', '-count_frames', ...entries, '-of', 'json', f], { encoding: 'utf8' }).stdout)
const raw = (f, w, h, n = 0) => sh('ffmpeg', ['-v', 'error', '-i', f, '-vf', `select=eq(n\\,${n}),scale=${w}:${h}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']).stdout
const regionDiff = (a, b, w, x0, y0, x1, y1) => { let m = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) { m += Math.abs(a[(y * w + x) * 3 + c] - b[(y * w + x) * 3 + c]); n++ } return m / n }

sh('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=3', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', path.join(out, 'clip.mp4')])
const server = await startPresenterServer(PORT, here)
const launchOpts = { executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'] }
// The main run uses a PERSISTENT profile (like a normal browser window); section 9 repeats the interruption in a private-window profile.
const ctx = await chromium.launchPersistentContext(path.join(out, 'profile'), launchOpts)
const problems = []
const watch = (page) => { page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 300)}`)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`[console] ${m.text().slice(0, 300)}`) }) }
const open = async (c = ctx) => { const p = await c.newPage(); watch(p); await p.goto(`${BASE}/bulk.html`); await p.waitForFunction('window.ready === true', null, { timeout: 120000 }); return p }
let page = await open()

const CSV = [
  'Company,Email,Website,First name',
  'Acme Roofing,ann@acme.com,acme.com,Ann',
  '"=HYPERLINK(""http://evil.test"",""x"")",bo@bright.com,bright.com,Bo',
  'Cedar {{x}} Dental,cy@cedar.com,https://cedar.com,Cy',
  'Acme Again,ANN@ACME.COM,,Ann',           // duplicate email
  'Delta,not-an-email,,Dee',                // invalid email
  ',,,',                                    // blank
].join('\n')
const cfg = { videoUrl: `${BASE}/out/clip.mp4`, frames: 60, csv: CSV, steps: ['thumbnail', 'gif', 'video'] }

// ═══ 1. The list ══════════════════════════════════════════════════════════════
const parsed = await page.evaluate((c) => window.parse(c), CSV)
check('CSV: 3 recipients accepted; the repeat and the bad email are skipped with their row numbers', parsed.counts.accepted === 3 && parsed.counts.skipped === 2 && parsed.issues.some((i) => i.row === 5 && i.code === 'duplicate') && parsed.issues.some((i) => i.row === 6 && i.code === 'bad-email'), JSON.stringify(parsed.counts))
const parsed2 = await page.evaluate((c) => window.parse(c), CSV)
check('recipient ids are identical when the same list is read again (needed to resume)', JSON.stringify(parsed.ids) === JSON.stringify(parsed2.ids))
const ids = parsed.ids

// ═══ 2. Start, interrupt in the middle of recipient 2, reload the page ═════════
// calls: r1 thumbnail(1) gif(2) video(3); r2 thumbnail(4) gif(5 ← interrupted at its start)
const first = await page.evaluate((c) => window.start({ ...c, pauseAtCall: 5 }), cfg)
note(`first run: ${first.state}, ${first.summary.done}/${first.summary.total} done in ${first.ms} ms`)
check('the run stops promptly in the middle of recipient 2 and is paused (not failed)', first.ok && first.state === 'paused' && first.summary.failed === 0 && first.summary.done === 1, JSON.stringify(first.summary))
check('recipient 1 is fully done; recipient 2 has its thumbnail only; recipient 3 has not started', first.items[0].status === 'done' && first.items[1].steps.thumbnail.status === 'done' && first.items[1].steps.gif.status === 'pending' && first.items[2].status === 'pending')
const saved = await page.evaluate(() => window.idb())
check('the job is saved in IndexedDB', saved?.state === 'paused' && saved.items.length === 3, JSON.stringify(saved))
await page.close(); page = await open() // a real reload: a fresh JS context, same browser profile
const reloaded = await page.evaluate(() => window.idb())
check('after the reload the saved job is still there', reloaded?.state === 'paused', JSON.stringify(reloaded))

// ═══ 3. Resume ════════════════════════════════════════════════════════════════
const second = await page.evaluate((c) => window.resume(c), cfg)
note(`resumed run: ${second.state}, ${second.summary.done}/${second.summary.total} done in ${second.ms} ms`)
check('the batch resumes and finishes: 3 of 3 done, none failed', second.ok && second.state === 'completed' && second.summary.done === 3 && second.summary.failed === 0, JSON.stringify(second.summary))
check('the design is recognised as unchanged on resume', second.sameDesign === true)
const calls = second.calls; const starts = (k) => calls.filter((c) => c === `start:${k}`).length; const ends = (k) => calls.filter((c) => c === `end:${k}`).length
const pairs = ids.flatMap((id) => cfg.steps.map((s) => `${id}:${s}`))
check('every recipient/step was COMPLETED exactly once across both sessions (nothing finished was redone)', pairs.every((k) => ends(k) === 1), pairs.map((k) => `${k.slice(-12)}=${ends(k)}`).join(' '))
check('the only repeat is the step that was interrupted at its start', pairs.filter((k) => starts(k) > 1).join() === `${ids[1]}:gif`, pairs.filter((k) => starts(k) > 1).join())

// ═══ 4. The package ═══════════════════════════════════════════════════════════
const links = { [ids[0]]: 'https://app.example.com/watch/abcdefgh12?r=tokenAAAA' }
const pk = await page.evaluate((l) => window.pack(l), links)
const zipFile = path.join(out, 'package.zip'); fs.writeFileSync(zipFile, Buffer.from(pk.b64, 'base64'))
note(`package: ${pk.included} files, ${(fs.statSync(zipFile).size / 1024).toFixed(0)} KB`)
const t = sh('unzip', ['-t', zipFile], { encoding: 'utf8' })
check('unzip -t (independent reader) says the archive is intact', /No errors detected/.test(t.stdout), t.stdout.split('\n').slice(-2)[0])
const py = sh('python3', ['-I', '-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print("\\n".join(sorted(z.namelist())));z.extractall(sys.argv[2])', zipFile, path.join(out, 'x')], { encoding: 'utf8' })
const names = py.stdout.trim().split('\n').slice(1)
check('python zipfile agrees: CRCs fine, one folder per recipient with thumbnail, GIF and video, plus manifest and README', py.stdout.startsWith('None') && names.length === 11 && ['manifest.csv', 'README.txt'].every((n) => names.includes(n)) && names.filter((n) => n.endsWith('/thumbnail.jpg')).length === 3 && names.filter((n) => n.endsWith('/personalized.gif')).length === 3 && names.filter((n) => n.endsWith('/video.mp4')).length === 3, names.join(' '))
const folders = names.filter((n) => n.endsWith('/thumbnail.jpg')).map((n) => n.split('/')[0]).sort()
check('folder names are file-safe (no formula characters, braces or path tricks)', folders.every((f) => /^\d{3}-[a-z0-9-]+$/.test(f)), folders.join(' '))
const X = (...p) => path.join(out, 'x', ...p)

// ═══ 5. The files are real media ═════════════════════════════════════════════
for (const [i, f] of folders.entries()) {
  const th = probe(X(f, 'thumbnail.jpg'), ['-show_entries', 'stream=codec_name,width,height']).streams[0]
  const gf = probe(X(f, 'personalized.gif'), ['-show_entries', 'stream=codec_name,width,height,nb_read_frames']).streams[0]
  const mv = probe(X(f, 'video.mp4'), ['-show_entries', 'stream=codec_name,width,height,nb_read_frames:format=duration']); const v = mv.streams.find((s) => s.codec_name === 'h264')
  check(`${f}: JPEG 320×180, GIF 240×135 with several frames, H.264 320×180 for about 2 s`, th.codec_name === 'mjpeg' && th.width === 320 && th.height === 180 && gf.codec_name === 'gif' && gf.width === 240 && Number(gf.nb_read_frames) >= 6 && Boolean(v) && v.width === 320 && v.height === 180 && Math.abs(Number(mv.format.duration) - 2) < 0.4, `${th.codec_name} ${gf.width}x${gf.height}x${gf.nb_read_frames} ${v?.codec_name} ${Number(mv.format.duration).toFixed(2)}s`)
}
// ═══ 6. Each recipient got THEIR OWN design ═════════════════════════════════
const order = ids.map((id) => id) // recipients are numbered 001.. in import order
const th = (i) => raw(X(folders[i], 'thumbnail.jpg'), 320, 180)
const [a, b, c] = [th(0), th(1), th(2)]
const headline = [20, 20, 300, 70]; const lowerHalf = [0, 150, 320, 180] // (a long name wraps onto 3 lines and may reach y≈130, so the shared-video check uses the bottom strip)
check('different recipients get different headlines (the headline area differs a lot)', regionDiff(a, b, 320, ...headline) > 6 && regionDiff(a, c, 320, ...headline) > 6 && regionDiff(b, c, 320, ...headline) > 6, `a-b ${regionDiff(a, b, 320, ...headline).toFixed(1)} a-c ${regionDiff(a, c, 320, ...headline).toFixed(1)}`)
check('…but the rest of the picture (the shared video, bottom strip) is the same', regionDiff(a, b, 320, ...lowerHalf) < 3 && regionDiff(a, c, 320, ...lowerHalf) < 3, `${regionDiff(a, b, 320, ...lowerHalf).toFixed(2)}`)
const lit = await page.evaluate((c) => window.literalThumb(c, 'Hi Acme Roofing'), cfg); fs.writeFileSync(path.join(out, 'literal.jpg'), Buffer.from(lit, 'base64'))
check('recipient 1\'s thumbnail equals the ordinary single-video thumbnail with "Hi Acme Roofing" typed in (the {{company}} fill-in is exact)', regionDiff(a, raw(path.join(out, 'literal.jpg'), 320, 180), 320, 0, 0, 320, 180) < 1.5, regionDiff(a, raw(path.join(out, 'literal.jpg'), 320, 180), 320, 0, 0, 320, 180).toFixed(2))
const litC = await page.evaluate((c) => window.literalThumb(c, 'Hi Cedar {{x}} Dental'), cfg); fs.writeFileSync(path.join(out, 'literalC.jpg'), Buffer.from(litC, 'base64'))
check('a value that looks like a {{field}} is drawn as written, not expanded', regionDiff(c, raw(path.join(out, 'literalC.jpg'), 320, 180), 320, 0, 0, 320, 180) < 1.5)
const va = raw(X(folders[0], 'video.mp4'), 320, 180, 10), vb = raw(X(folders[1], 'video.mp4'), 320, 180, 10)
check('the MP4s differ in the headline area too (each video is that recipient\'s own)', regionDiff(va, vb, 320, ...headline) > 6, regionDiff(va, vb, 320, ...headline).toFixed(1))

// ═══ 7. The manifest ═════════════════════════════════════════════════════════
const man = sh('python3', ['-I', '-c', 'import csv,json,sys;print(json.dumps(list(csv.reader(open(sys.argv[1],encoding="utf-8-sig")))))', X('manifest.csv')], { encoding: 'utf8' }).stdout
const rows = JSON.parse(man)
check('manifest: header + 3 recipients, statuses done, the personal link is on recipient 1', rows.length === 4 && rows.slice(1).every((r) => r[5] === 'done') && rows[1].includes(links[ids[0]]) && !rows[2].includes('tokenAAAA'), JSON.stringify(rows[0]))
check('manifest: the formula-looking company is neutralised with an apostrophe (safe in Excel/Sheets)', rows[2][2].startsWith("'=HYPERLINK"), rows[2][2].slice(0, 20))
check('manifest: the {{x}} company is kept literally', rows[3][2] === 'Cedar {{x}} Dental', rows[3][2])

// ═══ 8. Cleanup ═════════════════════════════════════════════════════════════
const gone = await page.evaluate(() => window.discard())
check('discarding removes the saved job', gone === null)
check('no page errors or console errors during the whole run', problems.length === 0, problems.slice(0, 3).join(' | '))

// ═══ 9. A private-window profile: stored files can disappear when the page closes ═══════════════
{
  const browser = await chromium.launch(launchOpts); const priv = await browser.newContext()
  let pg = await open(priv)
  const a = await pg.evaluate((c) => window.start({ ...c, pauseAtCall: 5 }), cfg); await pg.close(); pg = await open(priv)
  const b = await pg.evaluate((c) => window.resume(c), cfg)
  const redone = ids.flatMap((id) => cfg.steps.map((s) => `${id}:${s}`)).filter((k) => b.calls.filter((c) => c === `end:${k}`).length > 1)
  note(`private window: ${a.summary.done} done before the reload; after it ${redone.length} finished step(s) had to be redone because their files were gone`)
  check('private window: the batch completes 3 of 3 after the reload', b.ok && b.state === 'completed' && b.summary.done === 3 && b.summary.failed === 0, JSON.stringify(b.summary))
  const rep = await pg.evaluate((c) => window.packRepair(c), cfg)
  note(`private window: first package had ${rep.first.included} of 9 files (${rep.first.missing} lost from storage); after the repair loop it has ${rep.included}`)
  check('private window: whatever was lost is remade, and the final package has all 9 readable files (never a short or corrupt download)', rep.included === 9 && rep.missing === 0, `included ${rep.included}, missing ${rep.missing}`)
  fs.writeFileSync(path.join(out, 'private.zip'), Buffer.from(rep.b64, 'base64')); check('private window: unzip -t is clean', /No errors detected/.test(sh('unzip', ['-t', path.join(out, 'private.zip')], { encoding: 'utf8' }).stdout))
  await browser.close()
}
await ctx.close(); await server.close()
console.log(`\n${passed} passed, ${failed.length} failed`)
if (failed.length) { console.log('FAILED:\n' + failed.map((f) => '  - ' + f).join('\n')); process.exit(1) }
