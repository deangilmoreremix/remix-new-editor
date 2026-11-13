// Native HyperFrames reference snapshots (pinned CLI 0.9.28) for starter projects and for components mounted in a generated host project.
//   node scripts/hyperframes/native-refs.mjs --upstream <checkout> --out <dir> --spec <spec.json> [--conc 3]
// spec: [{ id, type: 'example'|'component', duration, times: [..] }]  ->  <out>/<id>/snap/frame-NN-at-<t>s.png
import { mkdirSync, cpSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
const a = process.argv.slice(2); const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const up = get('upstream'), out = get('out'), spec = JSON.parse(readFileSync(get('spec'), 'utf8')), conc = +get('conc', 3);
const CFG = '{"registry":"x","paths":{"blocks":"compositions","components":"compositions/components","assets":"assets"}}';
const hostFor = (id, d) => `<!doctype html><html><head><meta charset="UTF-8"><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#000}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${d}" data-width="1920" data-height="1080">
<div id="inst" class="clip" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="0" data-duration="${d}" data-track-index="0" data-width="1920" data-height="1080"></div></div>
<script>window.__timelines=window.__timelines||{};window.__timelines["main"]=gsap.timeline({paused:true});</script></body></html>`;
let idx = 0; const log = [];
const run = (cmd, args, cwd) => new Promise((res) => execFile(cmd, args, { cwd, timeout: 180000 }, (e, so, se) => res({ ok: !e, so, se })));
async function worker() {
  while (idx < spec.length) {
    const s = spec[idx++]; const dir = join(out, s.id); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    if (s.type === 'block-folder') { cpSync(join(up, 'registry/blocks', s.id), dir, { recursive: true }); cpSync(join(dir, s.id + '.html'), join(dir, 'index.html')); } // a block that ships its own folder
    else if (s.type === 'demo') { cpSync(join(up, 'registry/components', s.id), dir, { recursive: true }); cpSync(join(dir, 'demo.html'), join(dir, 'index.html')); } // the component's own demo composition plus the files it mounts (./<id>.html)
    else if (s.type === 'example') cpSync(join(up, 'registry/examples', s.id), dir, { recursive: true });
    else { mkdirSync(join(dir, 'compositions'), { recursive: true }); cpSync(join(up, 'registry/components', s.id, s.id + '.html'), join(dir, 'compositions', s.id + '.html')); writeFileSync(join(dir, 'index.html'), hostFor(s.id, s.duration)); }
    writeFileSync(join(dir, 'hyperframes.json'), CFG);
    const r = await run('npx', ['-y', 'hyperframes@0.9.28', 'snapshot', '.', '--at', s.times.join(','), '--no-end', '-o', 'snap'], dir);
    const ok = r.ok && existsSync(join(dir, 'snap')); log.push({ id: s.id, ok, err: ok ? undefined : String(r.se || r.so).slice(-200) }); console.log(ok ? 'OK  ' : 'FAIL', s.id);
  }
}
await Promise.all(Array.from({ length: conc }, worker));
writeFileSync(join(out, '_log.json'), JSON.stringify(log, null, 1));
