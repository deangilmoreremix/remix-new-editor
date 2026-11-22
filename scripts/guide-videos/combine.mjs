// Joins the per-studio tours into a few topic videos, each with a title card before every studio,
// chapters, and one merged caption file.
//   node scripts/guide-videos/combine.mjs            all groups
//   node scripts/guide-videos/combine.mjs image      one group (by id)
// Output: <GUIDE_VIDEO_DIR>/_combined/<group>.mp4, <group>.vtt, <group>.chapters.txt
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.env.GUIDE_VIDEO_DIR || 'node_modules/.cache/guide-videos';
const OUT = path.join(ROOT, '_combined');
const FONT = process.env.GUIDE_FONT || '/usr/share/fonts/opentype/inter/Inter-Bold.otf';
const CARD_SECONDS = 3;

// website-builder is left out until it can be recorded properly (its page is an external service).
export const GROUPS = [
  { id: '1-getting-started', title: 'Getting started', studios: ['apps', 'explore', 'templates', 'smart-video-academy'] },
  { id: '2-images', title: 'Images', studios: ['image-studio', 'text-to-image', 'image-to-image', 'edit-studio', 'photo-studio', 'upscale-suite', 'character-studio', 'product-shot-studio', 'asset-editor', 'ai-influencer'] },
  { id: '3-video-creation', title: 'Video creation', studios: ['video-studio', 'text-to-video', 'image-to-video', 'video-to-video', 'cinema-studio', 'cinema-templates', 'storyboard-studio', 'effects-studio', 'ai-vfx-studio', 'animate-studio', 'avatar-studio', 'lip-sync-studio', 'audio-studio'] },
  { id: '4-editing-and-agents', title: 'Editing and agents', studios: ['video-tools', 'video-watermark-remover', 'timeline-editor', 'video-render', 'recorder', 'workbench', 'director', 'motion-director', 'video-agent', 'zack-d-studio'] },
  { id: '5-brand-and-marketing', title: 'Brand and marketing', studios: ['brand-studio', 'brand-dna-editor', 'find-my-brand', 'campaign-studio', 'lead-finder', 'video-outreach', 'video-pages', 'smart-video-viral', 'smart-video-scheduler', 'personalizer'] },
  { id: '6-your-work', title: 'Your work', studios: ['library', 'content-library'] },
];

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019').replace(/%/g, '\\%');
const stamp = (s) => { const ms = Math.round(s * 1000); const p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`; };
const parse = (t) => { const [h, m, s] = t.split(':'); return Number(h) * 3600 + Number(m) * 60 + Number(s); };

function card(file, big, small) {
  const text = (t, size, color, y) => `drawtext=fontfile=${FONT}:text='${esc(t)}':fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}`;
  const vf = [text(small, 34, '0xd9ff00', 'h/2-110'), text(big, 84, 'white', 'h/2-40')].join(',');
  ff(['-f', 'lavfi', '-i', `color=c=0x0a0a0c:s=1440x900:r=30:d=${CARD_SECONDS}`, '-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', '30', '-video_track_timescale', '15360', file]);
}

const only = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const tmp = path.join(OUT, '_tmp');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

for (const g of GROUPS) {
  if (only && g.id !== only && !g.id.includes(only)) continue;
  const studios = g.studios.filter((s) => fs.existsSync(path.join(ROOT, s, 'tour.mp4')));
  const parts = [];
  const chapters = [];
  const cues = [];
  let t = 0;
  const add = (file) => { parts.push(file); const d = dur(file); t += d; return d; };

  const opening = path.join(tmp, `${g.id}-open.mp4`);
  card(opening, g.title, 'SMARTVIDEO STUDIO TOURS');
  add(opening);

  studios.forEach((slug, i) => {
    const tl = JSON.parse(fs.readFileSync(path.join(ROOT, slug, 'timeline.json'), 'utf8'));
    const c = path.join(tmp, `${g.id}-${slug}.mp4`);
    card(c, tl.name, `${g.title.toUpperCase()}  ·  ${i + 1} OF ${studios.length}`);
    const start = t;
    add(c);
    chapters.push({ start, title: tl.name });
    const base = t;
    const vtt = fs.readFileSync(path.join(ROOT, slug, 'captions.vtt'), 'utf8');
    for (const m of vtt.matchAll(/(\d\d:\d\d:\d\d\.\d+) --> (\d\d:\d\d:\d\d\.\d+)\n([^\n]+(?:\n[^\n]+)*?)(?:\n\n|\n?$)/g)) cues.push([base + parse(m[1]), base + parse(m[2]), m[3]]);
    add(path.join(ROOT, slug, 'tour.mp4'));
  });

  const list = path.join(tmp, `${g.id}.txt`);
  fs.writeFileSync(list, parts.map((p) => `file '${path.resolve(p)}'`).join('\n') + '\n');
  const meta = path.join(tmp, `${g.id}.meta`);
  fs.writeFileSync(meta, ';FFMETADATA1\n' + chapters.map((c, i) => `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(c.start * 1000)}\nEND=${Math.round((chapters[i + 1]?.start ?? t) * 1000)}\ntitle=${c.title}\n`).join(''));
  const out = path.join(OUT, `${g.id}.mp4`);
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-i', meta, '-map_metadata', '1', '-map_chapters', '1', '-c', 'copy', '-movflags', '+faststart', out]);
  fs.writeFileSync(path.join(OUT, `${g.id}.vtt`), 'WEBVTT\n\n' + cues.map(([a, b, x]) => `${stamp(a)} --> ${stamp(b)}\n${x}\n`).join('\n'));
  fs.writeFileSync(path.join(OUT, `${g.id}.chapters.txt`), chapters.map((c) => `${stamp(c.start).slice(0, 8)} ${c.title}`).join('\n') + '\n');
  console.log(`✓ ${g.id}: ${studios.length} studios, ${(t / 60).toFixed(1)} min, ${(fs.statSync(out).size / 1048576).toFixed(0)} MB${studios.length < g.studios.length ? ' (some skipped: no tour.mp4)' : ''}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
