// Security isolation + renderer capture, demonstrated together in a real browser.
// Needs: `npx vite build && npx vite preview --port 3200` and the dev server on :3199 (for the unsandboxed reference).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
mkdirSync('out/sandbox', { recursive: true });
const b = await chromium.launch(); const R = { checks: [] };
const check = (n, pass, d) => { R.checks.push({ name: n, pass: !!pass, detail: d }); console.log(pass ? 'PASS' : 'FAIL', n, d ?? ''); };

const page = await b.newPage(); const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 160)));
await page.goto('http://127.0.0.1:3200/sandbox-host.html');
const probe = await page.evaluate(() => window.__sandbox.call({ type: 'probe' }));
R.probe = probe;
check('frame runs in an opaque origin', probe.origin === 'null' && probe.sandboxed === true, `window.origin=${probe.origin}`);
const e = probe.escape || {};
const blocked = (k) => /^blocked/.test(e[k]) || /inert|empty|null/.test(e[k] || '');
check('cannot read parent document', /^blocked/.test(e['parent.document']), e['parent.document']);
check('cannot read parent location', /^blocked/.test(e['parent.location']), e['parent.location']);
check('cannot read host cookie', !/READ/.test(e['document.cookie'] || ''), e['document.cookie']);
check('cannot fetch external site', /^blocked/.test(e['fetch external']), e['fetch external']);
check('cannot load remote script', /^blocked/.test(e['inject remote script']), e['inject remote script']);
check('cannot open windows', /blocked/.test(e['window.open']), e['window.open']);
check('cannot navigate the top page', /^blocked/.test(e['top navigation']), e['top navigation']);
check('inline event handlers do not execute', /not executed/.test(e['inline handler injection']), e['inline handler injection']);
R.notes = { 'fetch same-origin app api': e['fetch same-origin app api'], localStorage: e.localStorage };

// Render inside the sandbox and compare with the unsandboxed render (same code, same machine).
const cases = [
  ['lt-clean-bar', 1920, 1080, 4.8, [2.4]], ['code-diff', 1920, 1080, 6, [3]], ['caption-highlight', 1920, 1080, 5, [2.5]],
  ['slack-notification-ad', 1080, 1920, 12, [6]], ['heygen-avatar-promo-card', 1080, 1920, 10, [5]],
];
const ref = await b.newPage(); await ref.goto('http://127.0.0.1:3199/');
for (const [name, w, h, d, times] of cases) {
  const sb = await page.evaluate((x) => window.__sandbox.call({ type: 'render', ...x }), { name, width: w, height: h, duration: d, times });
  const un = await ref.evaluate(([n, o]) => window.__poc.block(n, o), [name, { width: w, height: h, duration: d, times }]);
  const ok = sb.ok && sb.frames?.[0]?.png;
  if (ok) writeFileSync(`out/sandbox/${name}-sandboxed.png`, Buffer.from(sb.frames[0].png, 'base64'));
  if (un.frames?.[0]?.png) writeFileSync(`out/sandbox/${name}-unsandboxed.png`, Buffer.from(un.frames[0].png, 'base64'));
  check(`sandboxed render works: ${name}`, ok && !(sb.errors || []).some((x) => /refused|blocked-script/.test(x)), sb.ok ? `errors=${JSON.stringify(sb.errors)}` : sb.error);
}
// MP4 export inside the sandbox
const ex = await page.evaluate(() => window.__sandbox.call({ type: 'export', name: 'lt-clean-bar', width: 1920, height: 1080, duration: 2 }));
if (ex.ok) writeFileSync('out/sandbox/lt-clean-bar-sandboxed.mp4', Buffer.from(ex.b64, 'base64'));
check('MP4 export works inside the sandbox', ex.ok && ex.bytes > 10000, ex.ok ? `${ex.bytes}B in ${ex.ms}ms` : ex.error);

// Guard: outside a sandbox the adapter refuses to run block scripts (strict mode on the dev page).
const strict = await b.newPage(); await strict.goto('http://127.0.0.1:3199/?strict');
const sr = await strict.evaluate(() => window.__poc.block('lt-clean-bar', { width: 1920, height: 1080, duration: 4.8, times: [2.4] }));
check('adapter refuses scripts outside a sandbox', (sr.errors || []).some((x) => /refused/.test(x)), JSON.stringify(sr.errors));
R.pageErrors = pageErrors; R.failed = R.checks.filter((c) => !c.pass).map((c) => c.name);
writeFileSync('out/sandbox/results.json', JSON.stringify(R, null, 1));
console.log(`\n${R.checks.length - R.failed.length}/${R.checks.length} passed`, R.failed.length ? 'FAILED: ' + R.failed.join('; ') : '');
await Promise.race([b.close(), new Promise((r) => setTimeout(r, 5000))]); process.exit(0);
