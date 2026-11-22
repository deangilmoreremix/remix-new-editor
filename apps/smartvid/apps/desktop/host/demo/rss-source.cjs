// Demo helper (host tool): three local RSS feeds + images so the RSS screen has content. All names/titles are invented placeholders.
const http = require('http');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rss-demo-'));
const img = (name, c0, c1, w = 640, h = 360) => execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `gradients=s=${w}x${h}:c0=${c0}:c1=${c1}:d=1:speed=0.01`, '-frames:v', '1', '-q:v', '4', path.join(dir, name)]);
const feeds = {
  northwind: { title: 'Northwind Studio', avatar: ['0x7a5a4a', '0xd8b69a'], items: [
    ['How We Cut Onboarding Time by 40%', '2026-08-21T23:00:00Z', ['0x6b3a2a', '0xe0a267']],
    ['Design Review: Spring Product Launch', '2026-08-22T16:30:00Z', ['0x2a4a6b', '0xe0b8a0']],
    ['Making 12 Upgrades to a Tiny Studio Desk', '2026-08-19T22:10:00Z', ['0x3b2f26', '0xa6894a']],
    ['We Built a $20 Smart Speaker by Accident', '2026-08-17T01:45:00Z', ['0x3a3f4a', '0xc9c2b0']],
    ['AMA: Building Local-First Tools', '2026-08-21T02:00:00Z', ['0x14213d', '0x7aa2c9']],
    ['3D Printing the Workshop Lamp, Take Two', '2026-08-12T21:20:00Z', ['0x4a3a2a', '0xc77a3a']] ] },
  localfirst: { title: 'Local-First Weekly', avatar: ['0x2a3a4a', '0x8aa0b0'], items: [['Offline sync, explained', '2026-08-20T10:00:00Z', ['0x22303d', '0x6d8fa8']]] },
  fieldnotes: { title: 'Field Notes', avatar: ['0x3a4a2f', '0x9bb07a'], items: [['A morning with the recorder', '2026-08-18T07:30:00Z', ['0x2f4f3a', '0x8aa37b']]] },
};
for (const [k, f] of Object.entries(feeds)) { img(`${k}-avatar.jpg`, ...f.avatar, 120, 120); f.items.forEach((it, i) => img(`${k}-${i}.jpg`, ...it[2])); }
const tiny = path.join(dir, 'clip.mp4');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=320x180:rate=10', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', tiny]);
const PORT = 8114, BASE = `http://127.0.0.1:${PORT}`;
const rss = (k) => { const f = feeds[k]; return `<?xml version="1.0"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${f.title}</title><link>${BASE}/${k}</link><description>${f.title}</description><image><url>${BASE}/img/${k}-avatar.jpg</url><title>${f.title}</title><link>${BASE}/${k}</link></image>${f.items.map((it, i) => `<item><title>${it[0]}</title><link>${BASE}/v/${k}-${i}.mp4</link><guid>${k}-${i}</guid><pubDate>${new Date(it[1]).toUTCString()}</pubDate><itunes:image href="${BASE}/img/${k}-${i}.jpg"/></item>`).join('')}</channel></rss>`; };
http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  const feed = /^\/feed\/(\w+)\.xml$/.exec(u); if (feed && feeds[feed[1]]) { r.setHeader('content-type', 'application/rss+xml'); return r.end(rss(feed[1])); }
  const im = /^\/img\/([\w-]+\.jpg)$/.exec(u); if (im && fs.existsSync(path.join(dir, im[1]))) { r.setHeader('content-type', 'image/jpeg'); return fs.createReadStream(path.join(dir, im[1])).pipe(r); }
  if (u.startsWith('/v/')) { r.setHeader('content-type', 'video/mp4'); return fs.createReadStream(tiny).pipe(r); }
  r.writeHead(404); r.end();
}).listen(PORT);
