// Uploads the studio preview clips (the short loops shown when hovering a Studio Demos tile on
// the landing page) to the public `tour-videos` bucket, under clips/<slug>.mp4.
//
//   node scripts/guide-videos/upload-clips.mjs --dir <folder of <slug>.mp4 files> --dry-run
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/guide-videos/upload-clips.mjs --dir <folder>
//
// Which studios have a clip is listed in src/data/studioClips.json. The key is read from the
// environment and never printed. Re-running replaces existing files (upsert).
//
// Same upload with the Supabase CLI (signed in, project linked):
//   supabase storage cp <folder>/<slug>.mp4 ss:///tour-videos/clips/<slug>.mp4 --linked --experimental
/* global URL, fetch */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

const manifest = JSON.parse(fs.readFileSync(new URL('../../src/data/studioClips.json', import.meta.url), 'utf8'));
const dir = opt('--dir');
if (!dir) { console.error('Usage: upload-clips.mjs --dir <folder with <slug>.mp4 files> [--dry-run]'); process.exit(2); }

const files = manifest.slugs.map((slug) => ({ slug, file: path.join(dir, `${slug}.mp4`) }));
const missing = files.filter((f) => !fs.existsSync(f.file));
if (missing.length) {
  console.error(`Missing ${missing.length} of ${files.length} files in ${dir}:\n  ${missing.map((m) => `${m.slug}.mp4`).join('\n  ')}`);
  process.exit(1);
}
const bytes = files.reduce((n, f) => n + fs.statSync(f.file).size, 0);
console.log(`${files.length} clips, ${(bytes / 1e6).toFixed(1)} MB, all present.`);
if (flag('--dry-run')) { console.log(`Dry run: would upload to ${manifest.base}/<slug>.mp4`); process.exit(0); }

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error('Set SUPABASE_SERVICE_ROLE_KEY (or use the Supabase CLI command in this file).'); process.exit(2); }
const { origin, pathname } = new URL(manifest.base); // .../storage/v1/object/public/tour-videos/clips
const objectPath = pathname.split('/public/')[1]; // tour-videos/clips
let failed = 0;
for (const { slug, file } of files) {
  const res = await fetch(`${origin}/storage/v1/object/${objectPath}/${slug}.mp4`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'video/mp4', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
    body: fs.readFileSync(file),
  });
  if (!res.ok) { failed += 1; console.error(`FAIL ${slug}: ${res.status} ${(await res.text()).slice(0, 120)}`); } else console.log(`ok   ${slug}`);
}
console.log(failed ? `${failed} failed.` : 'All uploaded.');
process.exit(failed ? 1 : 0);
