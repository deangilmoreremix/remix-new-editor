// Browser certification of CineGen's edit tools on the real #/timeline editor (src/cinegen). Needs: vite on :5199, Playwright, a 5 s clip.
// Usage: node scripts/certify/edit-tools.cjs <clip.mp4> <outDir>
const { chromium } = require(process.env.PW_MODULE || 'playwright'); // PW_MODULE=/opt/node-tools/node_modules/playwright in this sandbox
const clip = process.argv[2]; const OUT = process.argv[3] || '.';
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1700, height: 950 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  const results = []; const rec = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', name, detail || ''); };
  await p.goto('http://localhost:5199/#/timeline', { timeout: 150000 });
  await p.waitForFunction(() => document.querySelector('#cinegen-editor-page'), { timeout: 180000 }); await p.waitForTimeout(5000);
  await p.evaluate(() => document.querySelectorAll('div.fixed.inset-0.z-\\[100\\]').forEach((e) => e.remove()));
  await p.getByRole('button', { name: /^New Project$/ }).click(); await p.waitForTimeout(800); await p.keyboard.type('Edit tools'); await p.keyboard.press('Enter'); await p.waitForTimeout(5000);
  await p.locator('.top-nav').getByRole('button', { name: /^Edit$/i }).click(); await p.waitForTimeout(25000);
  const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 60000 }), p.locator('button[title="Import media files"]').click()]);
  await fc.setFiles([clip]); await p.waitForTimeout(9000);
  const card = p.locator('text=' + require('path').basename(clip)).first(); const bb = await card.boundingBox();
  await p.mouse.move(bb.x + 20, bb.y - 30); await p.mouse.down(); await p.mouse.move(520, 740, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(2500);
  const videoCards = async () => p.evaluate(() => [...document.querySelectorAll('.clip-card')].map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), y: Math.round(r.y), name: (e.innerText || '').split('\n')[0] }; }).filter((c) => c.y > 690 && c.y < 780));
  const v0 = await videoCards(); rec('import + place clip on video track', v0.length === 1, JSON.stringify(v0));
  const key = async (k) => { await p.keyboard.press(k); await p.waitForTimeout(400); };
  // Blade: click playhead position inside the clip
  await key('b'); const c0 = v0[0]; await p.mouse.click(c0.x + Math.round(c0.w / 2), c0.y + 30); await p.waitForTimeout(1200);
  const v1 = await videoCards(); rec('Blade splits the clip', v1.length === 2, JSON.stringify(v1));
  await key('v'); await p.keyboard.press('Control+z'); await p.waitForTimeout(800);
  const v2 = await videoCards(); rec('Undo restores the split', v2.length === 1, JSON.stringify(v2));
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(800);
  const v3 = await videoCards(); rec('Redo re-applies the split', v3.length === 2, JSON.stringify(v3));
  // Select + move second clip right
  const s = v3[1]; await key('v'); await p.mouse.move(s.x + 40, s.y + 30); await p.mouse.down(); await p.mouse.move(s.x + 140, s.y + 30, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(1000);
  const v4 = await videoCards(); rec('Select tool moves a clip', v4.length === 2 && v4[1].x > s.x + 40, JSON.stringify(v4));
  // Trim right edge of first clip
  const f = v4[0]; await p.mouse.move(f.x + f.w - 2, f.y + 30); await p.mouse.down(); await p.mouse.move(f.x + f.w - 42, f.y + 30, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(1000);
  const v5 = await videoCards(); rec('Trim shortens a clip', v5[0].w < f.w - 20, JSON.stringify(v5[0]) + ' was ' + f.w);
  // Ripple trim: R + drag right edge of first clip left; following clip should move with it
  await key('r'); const g = v5[0]; const before = v5[1].x; await p.mouse.move(g.x + g.w - 2, g.y + 30); await p.mouse.down(); await p.mouse.move(g.x + g.w - 32, g.y + 30, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(1000);
  const v6 = await videoCards(); rec('Ripple trim moves the following clip', v6[0].w < g.w - 15 && v6[1].x < before - 15, JSON.stringify(v6));
  // Slip / Slide / Roll: record that the operation changes the timeline (clip geometry or filmstrip)
  for (const [k, name] of [['y', 'Slip'], ['u', 'Slide'], ['n', 'Roll']]) {
    await key(k); const cur = await videoCards(); const t = cur[Math.min(1, cur.length - 1)];
    const snap = await p.evaluate(() => document.querySelector('.timeline-editor')?.innerHTML.length || 0);
    await p.mouse.move(t.x + t.w / 2, t.y + 30); await p.mouse.down(); await p.mouse.move(t.x + t.w / 2 + 40, t.y + 30, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(900);
    const after = await videoCards(); const snap2 = await p.evaluate(() => document.querySelector('.timeline-editor')?.innerHTML.length || 0);
    const changed = JSON.stringify(after) !== JSON.stringify(cur) || snap !== snap2;
    rec(name + ' tool changes the timeline', changed, JSON.stringify(after.map((c) => [c.x, c.w])) + ' vs ' + JSON.stringify(cur.map((c) => [c.x, c.w])));
  }
  for (const [k, name] of [['g', 'Fill Gap'], ['e', 'Extend'], ['x', 'Mask']]) { await key(k); const on = await p.evaluate(() => document.querySelector('.tool-sidebar [aria-pressed="true"], .tool-sidebar .active, .tool-sidebar [class*=active]')?.getAttribute('title') || ''); rec(name + ' tool activates (needs provider/keys to run)', /./.test(on), on); }
  await key('v'); await p.screenshot({ path: OUT + '/edit-tools.png' });
  // Export
  await p.locator('.top-nav').getByRole('button', { name: /^Export$/i }).click(); await p.waitForTimeout(3000);
  await p.getByRole('button', { name: /^Draft/i }).click().catch(() => {});
  const dl = p.waitForEvent('download', { timeout: 420000 }).catch(() => null);
  await p.getByRole('button', { name: /render/i }).first().click();
  for (let i = 0; i < 80; i++) { await p.waitForTimeout(4000); const t = await p.evaluate(() => document.querySelector('.export-tab')?.innerText.replace(/\n+/g, ' | ').slice(0, 200)); if (/complete|failed|error/i.test(t || '')) break; }
  const d = await dl; if (d) { await d.saveAs(OUT + '/edit-tools-export.mp4'); rec('Export produces a file', true, 'edit-tools-export.mp4'); } else rec('Export produces a file', false, '');
  require('fs').writeFileSync(OUT + '/edit-tools-results.json', JSON.stringify({ results, errors: errs.filter((e) => !/Supabase|popcorn|ModalSystem/.test(e)) }, null, 1));
  await b.close();
})();
