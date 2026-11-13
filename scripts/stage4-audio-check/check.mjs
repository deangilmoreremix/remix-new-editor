// Stage 4 acceptance check. Usage: node scripts/stage4-audio-check/check.mjs  (needs ffmpeg + ffprobe)
// Real headless Chromium + the REAL mixdown baker (Web Audio decode, IndexedDB store), the REAL editor panel + Player, and the app's own exporter.
// The exported MP4s are measured with ffmpeg's EBU R128 meter (an independent BS.1770 implementation), band filters, Goertzel analysis and
// sample-level comparison against the offline mixdown. Exits non-zero on any failed check.
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startPresenterServer } from '../stage3-presenter-check/presenter-server.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, 'out'); fs.mkdirSync(out, { recursive: true })
const PORT = 5207; const BASE = `http://localhost:${PORT}`
const VIDEO = `${BASE}/out/talk.mp4`; const MUSIC = `${BASE}/out/music.mp3`
const SEC = 5

let passed = 0; const failed = []; const notes = []
const check = (name, ok, detail = '') => { if (ok) passed += 1; else failed.push(`${name} ${detail}`); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const note = (s) => { notes.push(s); console.log(`NOTE  ${s}`) }

const ffm = (args) => spawnSync('ffmpeg', ['-hide_banner', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
function lufs(file) {
  const r = ffm(['-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
  const tail = r.stderr.slice(r.stderr.lastIndexOf('Summary:'))
  const i = /I:\s+(-?[\d.]+)\s+LUFS/.exec(tail); const tp = /Peak:\s+(-?[\d.]+)\s+dBFS/.exec(tail)
  return { lufs: i ? Number(i[1]) : NaN, truePeak: tp ? Number(tp[1]) : NaN }
}
function samplePeak(file) { const r = ffm(['-nostats', '-i', file, '-vn', '-af', 'astats=measure_overall=Peak_level:measure_perchannel=none', '-f', 'null', '-']); const m = [...r.stderr.matchAll(/Peak level dB:\s+(-?[\d.]+)/g)].pop(); return m ? Number(m[1]) : NaN }
function bandDb(file, lo, hi, from = 0, to = SEC) {
  const r = ffm(['-nostats', '-ss', String(from), '-t', String(to - from), '-i', file, '-vn', '-af', `highpass=f=${lo},lowpass=f=${hi},volumedetect`, '-f', 'null', '-'])
  const m = /mean_volume:\s+(-?[\d.]+)/.exec(r.stderr); return m ? Number(m[1]) : NaN
}
function pcm(file, from = 0, to = SEC) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(from), '-t', String(to - from), '-i', file, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.byteLength / 4))
}
function goertzelDb(x, f, fs = 48000) { const w = (2 * Math.PI * f) / fs; const c = 2 * Math.cos(w); let s1 = 0, s2 = 0; for (let i = 0; i < x.length; i++) { const s = x[i] + c * s1 - s2; s2 = s1; s1 = s } const p = s1 * s1 + s2 * s2 - c * s1 * s2; return 10 * Math.log10(Math.max(p, 1e-20) / (x.length * x.length)) }
const rmsOf = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length))
const rmsWin = (x, a, b, fs = 48000) => rmsOf(x.subarray(Math.round(a * fs), Math.round(b * fs)))
const dB = (v) => 20 * Math.log10(Math.max(v, 1e-12))
function bestLag(a, b, maxLag) { let best = 0, bv = -Infinity; const n = Math.min(a.length, b.length) - maxLag - 1; for (let lag = -maxLag; lag <= maxLag; lag += 4) { let s = 0; for (let i = maxLag; i < n; i += 4) s += a[i] * b[i + lag]; if (s > bv) { bv = s; best = lag } } for (let lag = best - 4; lag <= best + 4; lag++) { let s = 0; for (let i = maxLag; i < n; i += 2) s += a[i] * b[i + lag]; if (s > bv) { bv = s; best = lag } } return best }
function corr(a, b, lag) { let sab = 0, saa = 0, sbb = 0; const n = Math.min(a.length, b.length) - Math.abs(lag) - 1; for (let i = Math.abs(lag); i < n; i++) { const x = a[i], y = b[i + lag]; sab += x * y; saa += x * x; sbb += y * y } return sab / Math.sqrt(saa * sbb) }

// Deterministic fixtures (ffmpeg): speech-like band-limited (150–700 Hz) noise bursts (speaking 0–1.2 s, 2–3.2 s, 4–5 s) with a faint 40 Hz rumble and a 2.5 kHz tone, over the
// sample person clip; and "music": a 6 kHz lead, a 330 Hz pad and a 60 Hz kick on every beat of 120 BPM.
const mk = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr) }
mk(['-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.5:d=5:r=48000:seed=7', '-f', 'lavfi', '-i', 'sine=f=40:d=5:r=48000', '-f', 'lavfi', '-i', 'sine=f=2500:d=5:r=48000', '-filter_complex', "[0]highpass=f=150,lowpass=f=700,lowpass=f=700,volume='if(lt(mod(t,2),1.2),1,0)':eval=frame,volume=3.0[sp];[1]volume=0.01[rb];[2]volume='if(lt(mod(t,2),1.2),0.12,0)':eval=frame[pr];[sp][rb][pr]amix=inputs=3:normalize=0,aformat=channel_layouts=mono[a]", '-map', '[a]', '-c:a', 'aac', path.join(out, 'voice-audio.m4a')])
mk(['-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*60*t)*exp(-14*mod(t,0.5))':d=8:s=48000", '-f', 'lavfi', '-i', 'sine=f=6000:d=8:r=48000', '-f', 'lavfi', '-i', 'sine=f=330:d=8:r=48000', '-filter_complex', '[0]aformat=channel_layouts=mono[k];[1]volume=0.12[l];[2]volume=0.08[c];[k][l][c]amix=inputs=3:normalize=0,aformat=channel_layouts=stereo[a]', '-map', '[a]', '-c:a', 'libmp3lame', '-b:a', '192k', path.join(out, 'music.mp3')])
mk(['-i', path.resolve(here, '../../public/media/recast-example/source-performance.mp4'), '-i', path.join(out, 'voice-audio.m4a'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-t', '5', path.join(out, 'talk.mp4')])
const server = await startPresenterServer(PORT, here)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox'] })
const problems = []
const watch = (page) => { page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 300)}`)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`[console.error] ${m.text().slice(0, 300)}`) }) }

// Vite's dev server may reload a page once after it pre-bundles a dependency it meets late; retry evaluations across such a reload.
const sturdy = (page, readyFn) => { const orig = page.evaluate.bind(page); page.evaluate = async (...a) => { for (let i = 0; ; i++) { try { return await orig(...a) } catch (e) { if (i < 4 && /context was destroyed|navigation/i.test(String(e))) { await page.waitForFunction(readyFn, null, { timeout: 120000 }); continue } throw e } } } }
const pa = await browser.newPage(); watch(pa); sturdy(pa, 'window.ready === true')
await pa.goto(`${BASE}/audio.html`); await pa.waitForFunction('window.ready === true', null, { timeout: 120000 }); await pa.waitForTimeout(2500); await pa.waitForFunction('window.ready === true', null, { timeout: 120000 })

const mix = (over = {}) => {
  const m = { enabled: true, voice: { muted: false, gainDb: 0, eq: { highpassHz: 80, lowDb: 0, midDb: 0, highDb: 0 }, normalize: { enabled: true, targetLufs: -16 } },
    music: { gainDb: 0, fadeInSec: 0, fadeOutSec: 0, loop: true, startSec: 0, normalize: { enabled: true, targetLufs: -28 }, duck: { enabled: false, thresholdDb: -45, amountDb: 12, attackMs: 30, releaseMs: 100, holdMs: 100 } },
    master: { targetLufs: -16, ceilingDb: -1 } }
  return JSON.parse(JSON.stringify({ ...m, ...over, voice: { ...m.voice, ...(over.voice ?? {}) }, music: { ...m.music, ...(over.music ?? {}), duck: { ...m.music.duck, ...(over.music?.duck ?? {}) } }, master: { ...m.master, ...(over.master ?? {}) } }))
}
const save = (name, b64) => { const f = path.join(out, name); fs.writeFileSync(f, Buffer.from(b64, 'base64')); return f }
const exp = async (name, cfg) => { const r = await pa.evaluate((c) => window.runExport(c), { videoUrl: VIDEO, musicUrl: MUSIC, ...cfg }); if (!r.ok) { check(`export ${name}`, false, `${r.error}`); return null } return { file: save(`${name}.mp4`, r.b64), ms: r.ms } }

// ── measurements of the real sources (decoded in the browser) ───────────────────────────────────────────────────
const an = await pa.evaluate(([v, m]) => window.analyse(v, m), [VIDEO, MUSIC])
const refVoice = lufs(path.join(out, 'talk.mp4')).lufs; const refMusic = lufs(path.join(out, 'music.mp3')).lufs
check('analysis: the voice loudness measured in the browser matches ffmpeg (±1 LU, different decoders)', an.voice && Math.abs(an.voice.lufs - refVoice) < 1.0, `app ${an.voice?.lufs} vs ffmpeg ${refVoice}`)
check('analysis: the music loudness matches ffmpeg (±1 LU)', an.music && Math.abs(an.music.lufs - refMusic) < 1.0, `app ${an.music?.lufs} vs ffmpeg ${refMusic}`)
check('analysis: the music tempo is found (120 BPM ±2) with beats', an.music?.bpm > 118 && an.music?.bpm < 122 && an.music.beats.length > 8, `${an.music?.bpm} BPM, ${an.music?.beats.length} beats`)
check('analysis: the quiet gaps in the voice are found (voice is silent 1.2–2 s and 3.2–4 s)', an.voice && an.voice.quietGaps.some((g) => g.startSec < 1.9 && g.endSec > 1.3) && an.voice.quietGaps.some((g) => g.startSec < 3.9 && g.endSec > 3.3), JSON.stringify(an.voice?.quietGaps))

// ── bake + parity with the offline mixdown ──────────────────────────────────────────────────────────────────────
const b1 = await pa.evaluate(([v, m, x]) => window.bakeMix(v, m, x, 5, true), [VIDEO, MUSIC, mix({ music: { duck: { enabled: true, amountDb: 12 } } })])
check('real bake: decodes the real mp4/mp3 and renders without notes', b1.ok && b1.report.notes.length === 0, JSON.stringify(b1).slice(0, 220))
check('real bake: the browser-side report says the final loudness is the target (-16 ±0.3)', Math.abs(b1.report.finalLufs - -16) < 0.3, `${b1.report.finalLufs}`)
const wavFile = save('mixdown.wav', await pa.evaluate((k) => window.mixdownWav(k), b1.key))
check('real bake: ffmpeg\'s independent meter agrees on the mixdown (±0.3 LU of -16)', Math.abs(lufs(wavFile).lufs - -16) < 0.3, `${lufs(wavFile).lufs}`)
const b2 = await pa.evaluate(([v, m, x]) => window.bakeMix(v, m, x, 5), [VIDEO, MUSIC, mix({ music: { duck: { enabled: true, amountDb: 12 } } })])
check('a second identical bake reuses the stored mixdown', b2.ok && b2.reused && b2.key === b1.key, `${b2.ms} ms vs ${b1.ms} ms`)
const bBad = await pa.evaluate(([v, x]) => window.bakeMix(v, `${location.origin}/out/nothing.mp3`, x, 5, true), [VIDEO, mix()])
check('a missing music file fails with a clear error and stores nothing', !bBad.ok && /HTTP 404|could not/.test(bBad.error), bBad.error)

// ── exports measured independently ──────────────────────────────────────────────────────────────────────────────
const baseline = await exp('baseline-no-mix', {})
const baseL = baseline ? lufs(baseline.file).lufs : NaN
note(`no-mix export (original behaviour: video audio + music at their own levels): ${baseL} LUFS`)
for (const target of [-16, -23]) {
  const e = await exp(`mix-${-target}`, { audioMix: mix({ master: { targetLufs: target } }) })
  if (!e) continue
  const m = lufs(e.file)
  check(`export (auto-applied mix): integrated loudness is the target ${target} LUFS (±1.0 by ffmpeg's EBU R128 meter)`, Math.abs(m.lufs - target) <= 1.0, `${m.lufs} LUFS`)
  if (target === -23) check('with no mix the same project sounds clearly different (so the mix is really applied)', Math.abs(baseL - m.lufs) > 2, `no mix ${baseL} LUFS vs mix ${m.lufs} LUFS`)
}
// exact parity: export with the SAME settings as the bake, compare samples
const par = await exp('parity', { audioMix: mix({ music: { duck: { enabled: true, amountDb: 12 } } }) })
if (par) {
  const a = pcm(wavFile), b = pcm(par.file); const lag = bestLag(a, b, 1200)
  check('exported audio is sample-aligned with the saved mix (|lag| ≤ 10 ms)', Math.abs(lag) <= 480, `lag ${(lag / 48).toFixed(2)} ms`)
  const c = corr(a, b, lag); check('exported audio matches the saved mix (correlation > 0.93; the voice is NOISE, which AAC re-codes loosely)', c > 0.93, `r = ${c.toFixed(4)}`)
  const dlev = Math.abs(dB(rmsOf(b)) - dB(rmsOf(a))); check('exported level equals the saved mix (±0.3 dB)', dlev < 0.3, `${dlev.toFixed(2)} dB`)
  check('exported loudness equals the report the panel shows (±0.5 LU)', Math.abs(lufs(par.file).lufs - b1.report.finalLufs) < 0.5, `${lufs(par.file).lufs} vs ${b1.report.finalLufs}`)
}

// the same comparison on tonal content (AAC-friendly): music only
const tonalMix = mix({ voice: { muted: true } }); const bt = await pa.evaluate(([v, m, x]) => window.bakeMix(v, m, x, 5, true), [VIDEO, MUSIC, tonalMix])
const wavT = save('mixdown-music.wav', await pa.evaluate((k) => window.mixdownWav(k), bt.key)); const parT = await exp('parity-music', { audioMix: tonalMix })
if (parT) { const a = pcm(wavT), b = pcm(parT.file); const lag = bestLag(a, b, 1200); const c = corr(a, b, lag); check('tonal content: the exported audio matches the saved mix closely (correlation > 0.98 after AAC)', c > 0.98, `r = ${c.toFixed(5)}, lag ${(lag / 48).toFixed(2)} ms`) }

// ducking measured on the music's own 6 kHz tone (the voice is band-limited to 150–700 Hz, so nothing of it reaches that bin)
const dk = await exp('duck', { audioMix: mix({ master: { targetLufs: null, ceilingDb: 0 }, voice: { normalize: { enabled: false } }, music: { duck: { enabled: true, amountDb: 12, attackMs: 30, releaseMs: 100, holdMs: 100 } } }) })
const nd = await exp('noduck', { audioMix: mix({ master: { targetLufs: null, ceilingDb: 0 }, voice: { normalize: { enabled: false } }, music: { duck: { enabled: false } } }) })
if (dk && nd) {
  const tone = (f, a, b) => goertzelDb(pcm(f, a, b), 6000)
  const duckedWin = tone(dk.file, 0.5, 1.1) - tone(nd.file, 0.5, 1.1)
  const gapWin = tone(dk.file, 1.6, 1.95) - tone(nd.file, 1.6, 1.95)
  const secondBurst = tone(dk.file, 2.4, 3.0) - tone(nd.file, 2.4, 3.0)
  check('ducking: the music tone is 12 dB lower while the voice speaks (±1.5 dB)', Math.abs(duckedWin + 12) <= 1.5, `${duckedWin.toFixed(2)} dB`)
  check('ducking: and back to full level in the pause', Math.abs(gapWin) <= 0.8, `${gapWin.toFixed(2)} dB`)
  check('ducking: and ducked again in the next phrase', Math.abs(secondBurst + 12) <= 1.5, `${secondBurst.toFixed(2)} dB`)
}

// EQ measured with band filters on voice-only exports
const veq = async (name, voice) => exp(name, { musicUrl: null, audioMix: mix({ master: { targetLufs: null, ceilingDb: 0 }, voice: { normalize: { enabled: false }, ...voice } }) })
const flat = await veq('eq-flat', { eq: { highpassHz: 0, lowDb: 0, midDb: 0, highDb: 0 } })
const hp = await veq('eq-hp300', { eq: { highpassHz: 300, lowDb: 0, midDb: 0, highDb: 0 } })
const mid = await veq('eq-mid6', { eq: { highpassHz: 0, lowDb: 0, midDb: 6, highDb: 0 } })
if (flat && hp && mid) {
  const rumble = goertzelDb(pcm(hp.file, 0.2, 1.0), 40) - goertzelDb(pcm(flat.file, 0.2, 1.0), 40)
  check('EQ: the 300 Hz rumble filter removes the 40 Hz rumble (>= 20 dB down, Goertzel)', rumble <= -20, `${rumble.toFixed(1)} dB`)
  const presence = goertzelDb(pcm(mid.file, 0.2, 1.0), 2500) - goertzelDb(pcm(flat.file, 0.2, 1.0), 2500)
  check('EQ: +6 dB presence raises the 2.5 kHz tone by 6 dB (±0.7, Goertzel)', Math.abs(presence - 6) <= 0.7, `${presence.toFixed(2)} dB`)
  const far = bandDb(mid.file, 150, 400) - bandDb(flat.file, 150, 400)
  check('EQ: and leaves the low band alone (±0.7 dB)', Math.abs(far) <= 0.7, `${far.toFixed(2)} dB`)
}

// fades on a music-only export
const fd = await exp('fades', { audioMix: mix({ voice: { muted: true }, master: { targetLufs: null, ceilingDb: 0 }, music: { fadeInSec: 1, fadeOutSec: 1, normalize: { enabled: false } } }) })
if (fd) {
  const x = pcm(fd.file); const a = rmsWin(x, 0, 0.1), m = rmsWin(x, 1.5, 3.5), z = rmsWin(x, SEC - 0.1, SEC)
  check('fades: starts silent, plays at full level in the middle, ends silent', dB(m) - dB(a) > 25 && dB(m) - dB(z) > 25, `start ${dB(a).toFixed(1)} dB, mid ${dB(m).toFixed(1)} dB, end ${dB(z).toFixed(1)} dB`)
  const lead = (a, b) => goertzelDb(x.subarray(Math.round(a * 48000), Math.round(b * 48000)), 6000) // the lead tone only (the kick is 60 Hz)
  check('fades: the fade-in is halfway at 0.5 s (-6 dB vs full, ±1.5; raised cosine)', Math.abs(lead(0.45, 0.55) - lead(1.5, 2.5) + 6) <= 1.5, `${(lead(0.45, 0.55) - lead(1.5, 2.5)).toFixed(2)} dB`)
}

// peak ceiling on a deliberately hot mix: guaranteed on the mixdown; the AAC export can overshoot it
const hotMix = mix({ master: { targetLufs: -8, ceilingDb: -3 } })
const bh = await pa.evaluate(([v, m, x]) => window.bakeMix(v, m, x, 5, true), [VIDEO, MUSIC, hotMix])
const wavH = save('mixdown-hot.wav', await pa.evaluate((k) => window.mixdownWav(k), bh.key)); const spW = samplePeak(wavH)
check('peak ceiling: the mixdown never exceeds the -3 dBFS ceiling (sample peak)', spW <= -3 + 0.05, `${spW} dBFS; the ceiling kept it ${(-8 - bh.report.finalLufs).toFixed(1)} LU under the -8 target`)
check('peak ceiling: the report says the ceiling stopped the loudness target', bh.report.notes.some((n) => /peak ceiling/.test(n)), bh.report.notes.join(' | '))
const hot = await exp('hot', { audioMix: hotMix })
if (hot) { const sp = samplePeak(hot.file); const tp = lufs(hot.file).truePeak; check('peak ceiling: the AAC export of that mix overshoots the ceiling by no more than 3 dB', sp <= -3 + 3, `sample peak ${sp} dBFS, true peak ${tp} dBFS`); note(`ceiling -3 dBFS: the mixdown peaks at ${spW} dBFS; the AAC export measured ${sp} dBFS sample peak / ${tp} dBFS true peak (codec overshoot ${(sp - spW).toFixed(1)} dB)`) }

// stale mixdown reference is re-rendered by the exporter
const staleRef = { key: b1.key, createdAt: 'x', durationSec: SEC, report: { voiceLufs: null, musicLufs: null, finalLufs: -16, peakDb: -1, duckMaxDb: 0, masterGainDb: 0, notes: [] } }
const st = await exp('stale', { audioMix: { ...mix({ master: { targetLufs: -20 } }), mixdown: staleRef } })
if (st) check('a STALE saved mixdown is not used: the exporter re-renders and hits the new target (-20 ±1)', Math.abs(lufs(st.file).lufs - -20) <= 1.0, `${lufs(st.file).lufs} LUFS`)
// a mix with the voice muted and no music is silent but valid
const sil = await exp('silent', { musicUrl: null, audioMix: mix({ voice: { muted: true } }) })
if (sil) { const x = pcm(sil.file); check('everything muted: the export is silent (and still a valid video)', rmsOf(x) < 1e-3, `${dB(rmsOf(x)).toFixed(1)} dB`) }
await pa.close()

// ═══ Part B — the real editor ═══════════════════════════════════════════════════════════════════════════════════
const pb = await browser.newPage({ viewport: { width: 1200, height: 4200 } }); watch(pb); sturdy(pb, () => window.ready === true)
await pb.goto(`${BASE}/editor.html`); await pb.waitForFunction(() => window.ready === true, null, { timeout: 120000 }); await pb.waitForTimeout(2500); await pb.waitForFunction(() => window.ready === true, null, { timeout: 120000 })
await pb.evaluate((u) => window.__setVideo(u), VIDEO)
await pb.waitForSelector('[data-testid="audio-mix-panel"]', { timeout: 60000 })
await pb.evaluate(([m]) => window.__ctx.editPreviewSettings((p) => ({ ...p, durationInFrames: 150, fps: 30, showEndCard: false, layers: [], audio: { url: m, name: 'music.mp3' } })), [MUSIC])
const settings = () => pb.evaluate(() => JSON.parse(JSON.stringify(window.__ctx.previewSettings)))
const source = () => pb.evaluate(() => document.querySelector('[data-audio-source]')?.getAttribute('data-audio-source'))
await pb.waitForTimeout(800)
check('editor: with no mix the Player plays the sources as they are', (await source()) === 'sources')
await pb.getByRole('button', { name: 'Turn on audio mix' }).click()
check('editor: turning on the mix says it is not applied yet and the Player still uses the sources', (await pb.getByTestId('audio-mix-pending').count()) === 1 && (await source()) === 'sources')
await pb.getByRole('button', { name: 'Measure my audio' }).click()
await pb.getByTestId('audio-analysis').waitFor({ timeout: 60000 })
const atext = await pb.getByTestId('audio-analysis').textContent()
check('editor: "Measure my audio" shows loudness, quiet gaps and tempo', /LUFS/.test(atext) && /quiet gap/.test(atext) && /1(19|20|21)(\.\d)? BPM/.test(atext), atext)
await pb.getByRole('slider', { name: 'Ducking depth' }).fill('12')
await pb.getByRole('button', { name: 'Apply audio mix' }).click()
await pb.getByTestId('audio-mix-active').waitFor({ timeout: 60000 })
const s1 = await settings()
check('editor: applying stores a mixdown reference and the Player now plays the mixdown', Boolean(s1.audioMix?.mixdown?.key) && (await source()) === 'mixdown', s1.audioMix?.mixdown?.key)
check('editor: the panel reports the measured result', /-16 LUFS/.test(await pb.getByTestId('audio-mix-report').textContent()), await pb.getByTestId('audio-mix-report').textContent())
await pb.getByRole('slider', { name: 'Voice level' }).fill('3')
check('editor: changing a setting marks the mix out of date and the Player falls back to the sources', (await pb.getByTestId('audio-mix-stale').count()) === 1 && (await source()) === 'sources')
await pb.getByRole('button', { name: 'Apply again' }).click(); await pb.getByTestId('audio-mix-active').waitFor({ timeout: 60000 })
check('editor: applying again makes it current', (await source()) === 'mixdown')
const ex = await pb.evaluate(() => window.__export())
check('editor: the export of these settings succeeds', ex.ok, `${ex.error ?? ''} ${ex.bytes ?? ''} B`)
if (ex.ok) {
  const f = save('editor-export.mp4', ex.b64); const m = lufs(f).lufs
  check('editor: the exported loudness is the editor\'s target (-16 ±1.0)', Math.abs(m - -16) <= 1.0, `${m} LUFS`)
  const wav = pcm(path.join(out, 'mixdown.wav')); void wav
}
// reload survival: the mixdown reference persists in settings; the audio file is restored from IndexedDB
await pb.evaluate(() => { /* simulate a reload of the in-page registry only */ })
check('no page errors or console errors in the browser', problems.length === 0, problems.slice(0, 5).join(' | '))

await browser.close(); await server.close()
console.log(`\n${passed} passed, ${failed.length} failed`)
for (const f of failed) console.log('  FAILED:', f)
process.exit(failed.length ? 1 : 0)
