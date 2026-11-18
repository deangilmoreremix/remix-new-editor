// Deterministic seek: same timestamp must give identical pixels regardless of visit order (forward/backward/repeat).
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const cases = JSON.parse(process.env.CASES);
const b = await chromium.launch(); const out = [];
for (const c of cases) {
  const p = await b.newPage(); await p.goto('http://127.0.0.1:3199/');
  const seq = c.times; // e.g. forward, then backward, then repeats
  const r = await p.evaluate(([n, o]) => window.__poc.block(n, o), [c.name, { width: c.w, height: c.h, duration: c.d, times: seq }]);
  const byTime = {}; let ok = true;
  r.frames.forEach((f) => { const h = createHash('sha1').update(f.png || f.error || '').digest('hex').slice(0, 10); (byTime[f.t] ||= new Set()).add(h); });
  for (const [t, set] of Object.entries(byTime)) if (set.size !== 1) ok = false;
  out.push({ name: c.name, order: seq, deterministic: ok, distinctTimes: Object.keys(byTime).length, hashes: Object.fromEntries(Object.entries(byTime).map(([t, s]) => [t, [...s][0]])) });
  console.log(ok ? 'PASS' : 'FAIL', c.name, 'order', seq.join(','), JSON.stringify(Object.fromEntries(Object.entries(byTime).map(([t, s]) => [t, s.size]))));
  await p.close();
}
await b.close();
