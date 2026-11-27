// Host script (not upstream): upstream's desktop app ships yt-dlp, ffmpeg/ffprobe and node under apps/desktop/resources
// (fetched by its Electron setup scripts). For the self-hosted web port, link the binaries already installed on the server.
//   YTDLP_PATH / FFMPEG_PATH / FFPROBE_PATH / NODE_PATH_BIN override the lookup; otherwise PATH is searched.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';

const resources = path.resolve(import.meta.dirname, '../resources');
const which = (name) => {
  try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch { return ''; }
};
const platformSuffix = process.platform === 'win32' ? 'win.exe' : process.platform === 'darwin' ? 'macos' : 'linux';
const targets = [
  { name: 'yt-dlp', env: 'YTDLP_PATH', dest: `yt-dlp_${platformSuffix}` },
  { name: 'ffmpeg', env: 'FFMPEG_PATH', dest: 'ffmpeg/ffmpeg' },
  { name: 'ffprobe', env: 'FFPROBE_PATH', dest: 'ffmpeg/ffprobe' },
  { name: 'node', env: 'NODE_PATH_BIN', dest: 'node/node' },
];
let missing = 0;
for (const t of targets) {
  const source = process.env[t.env] || which(t.name);
  if (!source || !existsSync(source)) { console.error(`✗ ${t.name} not found — install it or set ${t.env}`); missing += 1; continue; }
  const dest = path.join(resources, t.dest);
  mkdirSync(path.dirname(dest), { recursive: true });
  rmSync(dest, { force: true });
  symlinkSync(source, dest);
  console.log(`✓ ${t.name} → ${source}`);
}
process.exit(missing ? 1 : 0);
