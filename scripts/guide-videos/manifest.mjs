// Writes src/data/guideVideos.json: which studios have an uploaded tour video, and how long it is.
// Run after uploading <slug>/tour.mp4, captions.vtt and poster.webp to the tour-videos bucket (studios/<slug>/).
//   node scripts/guide-videos/manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.env.GUIDE_VIDEO_DIR || 'node_modules/.cache/guide-videos';
const BASE = process.env.TOUR_VIDEO_BASE || 'https://bzxohkrxcwodllketcpz.supabase.co/storage/v1/object/public/tour-videos/studios';
const SKIP = new Set([]); // every studio with a tour.mp4 is listed (website-builder and smartviddownloader are caption-only tours)
const studios = {};
for (const slug of fs.readdirSync(ROOT).sort()) {
  const mp4 = path.join(ROOT, slug, 'tour.mp4');
  if (slug.startsWith('_') || SKIP.has(slug) || !fs.existsSync(mp4)) continue;
  const seconds = Math.round(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString()));
  studios[slug] = { seconds };
}
fs.writeFileSync('src/data/guideVideos.json', JSON.stringify({ base: BASE, studios }, null, 2) + '\n');
console.log(`${Object.keys(studios).length} studios → src/data/guideVideos.json`);
