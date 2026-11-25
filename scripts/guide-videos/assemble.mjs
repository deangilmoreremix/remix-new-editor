#!/usr/bin/env node
// Joins the recorded clips of each studio tour into the final files:
//   tour.mp4 (H.264, plus the voiceover when audio exists), poster.webp, captions.vtt
//
//   node scripts/guide-videos/assemble.mjs [slug ...] [--publish]
//
// Reads  node_modules/.cache/guide-videos/<slug>/timeline.json  (from capture:videos)
// Voice: scripts/guide-videos/audio/<slug>/<intro|feature-id|outro>.mp3 (optional, one clip per line,
//        placed at the start of its segment; durations.json in the same folder drives the pacing).
// --publish copies tour.mp4, poster.webp and captions.vtt to public/guides/<slug>/.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const OUT = process.env.GUIDE_VIDEO_DIR || path.join(ROOT, 'node_modules/.cache/guide-videos');
const args = process.argv.slice(2);
const publish = args.includes('--publish');
const only = args.filter((a) => !a.startsWith('--'));
const slugs = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((s) => fs.existsSync(path.join(OUT, s, 'timeline.json')) && (!only.length || only.includes(s))) : [];
if (!slugs.length) { console.error('No recorded studios found. Run npm run capture:videos first.'); process.exit(1); }

const ff = (a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: ['ignore', 'inherit', 'inherit'] });
const duration = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const ts = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = (s % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x}`; };

let failed = 0;
for (const slug of slugs) {
  try {
    const dir = path.join(OUT, slug);
    const tl = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
    const clips = tl.clips.map((c) => ({ ...c, file: path.join(dir, 'clips', c.file), len: 0 }));
    for (const c of clips) c.len = duration(c.file);

    // Segment start times in the joined video (a segment can own more than one clip).
    const segStart = new Map(); let t = 0;
    for (const c of clips) { if (!segStart.has(c.key)) segStart.set(c.key, t); t += c.len; }
    const total = t;

    const inputs = clips.flatMap((c) => ['-i', c.file]);
    const norm = clips.map((_, i) => `[${i}:v]fps=30,scale=${tl.viewport.width}:${tl.viewport.height},setsar=1,format=yuv420p[v${i}]`);
    const join = `${clips.map((_, i) => `[v${i}]`).join('')}concat=n=${clips.length}:v=1:a=0[vout]`;

    // Optional voiceover: each line's mp3 starts shortly after its segment starts.
    const audioDir = path.join(ROOT, 'scripts/guide-videos/audio', slug);
    const voices = [...segStart].map(([key, start]) => ({ key, start, file: path.join(audioDir, `${key}.mp3`) })).filter((v) => fs.existsSync(v.file));
    const aInputs = voices.flatMap((v) => ['-i', v.file]);
    const aFilters = voices.map((v, i) => `[${clips.length + i}:a]adelay=${Math.round((v.start + 0.35) * 1000)}|${Math.round((v.start + 0.35) * 1000)}[a${i}]`);
    const aMix = voices.length ? `${voices.map((_, i) => `[a${i}]`).join('')}amix=inputs=${voices.length}:normalize=0[aout]` : '';

    const graph = [...norm, join, ...aFilters, ...(aMix ? [aMix] : [])].join(';');
    const mp4 = path.join(dir, 'tour.mp4');
    ff([...inputs, ...aInputs, '-filter_complex', graph, '-map', '[vout]', ...(voices.length ? ['-map', '[aout]', '-c:a', 'aac', '-b:a', '160k'] : []),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', String(total), mp4]);

    // Poster: a frame 2s into the first feature (the studio with its first control ringed).
    const first = tl.segments[1] ? segStart.get(tl.segments[1].key) : 0;
    ff(['-ss', String(Math.min(total - 0.1, (first || 0) + 2.5)), '-i', mp4, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', path.join(dir, 'poster.webp')]);

    // Captions (WebVTT), one cue per line of narration. Tour videos are also captioned on screen.
    const cues = tl.segments.map((s) => {
      const a = segStart.get(s.key); const b = a + s.seconds;
      return `${ts(a + 0.2)} --> ${ts(Math.max(a + 0.5, b - 0.3))}\n${s.text}`;
    });
    fs.writeFileSync(path.join(dir, 'captions.vtt'), `WEBVTT\n\n${cues.join('\n\n')}\n`);

    const mb = (fs.statSync(mp4).size / 1048576).toFixed(1);
    console.log(`✓ ${slug}: ${total.toFixed(0)}s, ${mb} MB${voices.length ? `, ${voices.length} voice clips` : ', silent'}`);
    if (publish) {
      const pub = path.join(ROOT, 'public/guides', slug);
      fs.mkdirSync(pub, { recursive: true });
      for (const f of ['tour.mp4', 'poster.webp', 'captions.vtt']) fs.copyFileSync(path.join(dir, f), path.join(pub, f));
    }
  } catch (e) {
    failed++;
    console.error(`✗ ${slug}: ${String(e.message).split('\n')[0]}`);
  }
}
process.exit(failed ? 1 : 0);
