// Real @hyperframes/sdk test: one master template, two business profiles, overrides saved/restored, master untouched.
// Usage: node sdk-test.mjs [block=lt-clean-bar]  -> out/sdk/*.json + public/blocks/_sdk/*.html + out/sdk/results.json
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openComposition, createMemoryAdapter } from '@hyperframes/sdk';

const BLOCK = process.argv[2] || 'lt-clean-bar';
const masterPath = `public/blocks/${BLOCK}.html`;
const sha = (b) => createHash('sha256').update(b).digest('hex');
mkdirSync('out/sdk', { recursive: true }); 
const masterBytes = readFileSync(masterPath); const master = masterBytes.toString('utf8'); const masterHash = sha(masterBytes);
const R = { block: BLOCK, masterSha256: masterHash, checks: [] };
const check = (name, pass, detail) => { R.checks.push({ name, pass: !!pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail ?? ''); };

// Discover the editable ids by content, not by hard-coding.
const probe = await openComposition(master);
const els = probe.getElements();
const nameId = els.find((e) => (e.text ?? '').trim() === 'Dr. Maya Chen')?.id;
const roleId = els.find((e) => /Host/.test(e.text ?? '') && !/Maya/.test(e.text ?? ''))?.id;
const accent = els.find((e) => (e.classNames || []).includes('lt-tab'))?.id; // the visible accent tab of this block
R.elements = { nameId, roleId, accent, total: els.length };
probe.dispose();
check('found editable ids by content', nameId && roleId && accent, JSON.stringify(R.elements));

const profiles = {
  A: { name: "Maria's Bakery", role: 'Owner · Fresh bread daily', color: '#e11d48' },
  B: { name: 'Northside Dental', role: 'Dr. Lee · Family dentistry', color: '#0ea5e9' },
};

// 1) Personalize two businesses in embedded (override) mode and persist ONLY the sparse delta.
const saved = {};
for (const [k, p] of Object.entries(profiles)) {
  const comp = await openComposition(master, { overrides: {}, history: false });
  comp.batch(() => {
    comp.setText(nameId, p.name);
    comp.setText(roleId, p.role);
    if (accent) comp.setStyle(accent, { backgroundColor: p.color });
  });
  const o = comp.getOverrides();
  saved[k] = JSON.parse(JSON.stringify(o));
  writeFileSync(`out/sdk/overrides-${k}.json`, JSON.stringify(o, null, 1));
  comp.dispose();
  check(`override set ${k} is sparse`, Object.keys(o).length > 0 && Object.keys(o).length < 10, `${Object.keys(o).length} keys, ${JSON.stringify(o).length} bytes vs master ${master.length} bytes`);
}

// 2) Restore from the saved JSON (fresh read from disk = "reload"), without touching the master.
const html = {};
for (const k of Object.keys(profiles)) {
  const stored = JSON.parse(readFileSync(`out/sdk/overrides-${k}.json`, 'utf8'));
  const comp = await openComposition(master, { overrides: stored, history: false });
  html[k] = comp.serialize(); comp.dispose();
  writeFileSync(`public/blocks/sdk-${BLOCK}-${k}.html`, html[k]);
  check(`restored ${k} contains its business text`, html[k].includes(profiles[k].name) && html[k].includes(profiles[k].role));
}
check('A and B outputs differ', html.A !== html.B);
check('A output does not leak B text', !html.A.includes(profiles.B.name));
check('master file bytes unchanged', sha(readFileSync(masterPath)) === masterHash);
check('restored HTML differs from master only where edited', html.A.length > 0 && html.A !== master);

// 3) Undo / redo in a normal (history) session.
{
  const comp = await openComposition(master);
  const before = comp.serialize();
  comp.setText(nameId, 'Temp Name');
  const edited = comp.serialize();
  check('canUndo after edit', comp.canUndo());
  comp.undo(); const undone = comp.serialize();
  check('undo restores original serialization', undone === before, `edited!==before:${edited !== before}`);
  check('canRedo after undo', comp.canRedo());
  comp.redo(); check('redo restores edit', comp.serialize() === edited);
  comp.dispose();
}

// 4) PersistAdapter contract (memory adapter) incl. versions.
{
  const adapter = createMemoryAdapter();
  const comp = await openComposition(master, { persist: adapter, persistPath: 'master.html' });
  comp.setText(nameId, 'Saved Via Adapter'); await comp.flush();
  const stored = await adapter.read('master.html');
  const versions = await adapter.listVersions('master.html');
  check('persist adapter stored the edited html', !!stored && stored.includes('Saved Via Adapter'), `versions=${versions.length}`);
  check('master file still unchanged after adapter save', sha(readFileSync(masterPath)) === masterHash);
  comp.dispose();
}

// 5) What does the SDK do with hostile values? (We must sanitize ourselves if it does not.)
{
  const comp = await openComposition(master);
  const probes = [
    ['setText html payload', () => comp.setText(nameId, '<img src=x onerror=alert(1)>'), (h) => /<img[^>]*onerror/i.test(h)],
    ['setAttribute onclick', () => comp.setAttribute(nameId, 'onclick', 'alert(1)'), (h) => /onclick="alert/i.test(h)],
    ['setAttribute javascript: href', () => comp.setAttribute(nameId, 'href', 'javascript:alert(1)'), (h) => /href="javascript:/i.test(h)],
    ['setAttribute remote img src', () => comp.setAttribute(nameId, 'src', 'https://evil.example/x.png'), (h) => /src="https:\/\/evil\.example/i.test(h)],
    ['addElement with <script>', () => comp.addElement(null, 0, '<div><script>alert(1)</script></div>'), (h) => /<script>alert\(1\)/.test(h)],
    ['addElement with onerror img', () => comp.addElement(null, 0, '<img src=x onerror=alert(1)>'), (h) => /onerror=alert\(1\)/.test(h)],
  ];
  R.hostileInput = [];
  for (const [label, run, leaked] of probes) {
    let threw = null; try { run(); } catch (e) { threw = String(e.message || e).slice(0, 80); }
    const out = comp.serialize();
    R.hostileInput.push({ probe: label, threw, payloadReachesOutput: !threw && leaked(out) });
    console.log('PROBE', label, threw ? `rejected: ${threw}` : leaked(out) ? 'ACCEPTED into output (sanitize upstream)' : 'neutralised');
  }
  comp.dispose();
}

R.failed = R.checks.filter((c) => !c.pass).map((c) => c.name);
writeFileSync('out/sdk/results.json', JSON.stringify(R, null, 1));
console.log(`\n${R.checks.length - R.failed.length}/${R.checks.length} checks passed`, R.failed.length ? 'FAILED: ' + R.failed.join('; ') : '');
