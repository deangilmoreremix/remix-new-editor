// Finds customer-editable fields of catalog blocks: leaf text, <img> sources and solid accent fills, addressed by data-hf-id.
// Loads each block in a normal page (trusted catalog code, evaluation harness only), serving CDN scripts from the vendored copies.
// Only elements whose LIVE value still equals the master HTML are kept, so a block's own script cannot overwrite an override.
//   IDS=a,b,c node analyse-editables.mjs   -> out/editables.json
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { stampHfIds } from '../../src/lib/editor/remotion/hyperframes/overrides.js';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const ids = (process.env.IDS || '').split(',').filter(Boolean);
const meta = JSON.parse(readFileSync(process.env.META, 'utf8'));
const cdn = JSON.parse(readFileSync('public/blocks/_cdn/map.json', 'utf8'));
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH }); const out = {};
const hex = (rgb) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(rgb); if (!m) return null; if (m[4] !== undefined && +m[4] < 0.9) return null; return '#' + [m[1], m[2], m[3]].map((x) => Math.round(+x).toString(16).padStart(2, '0')).join(''); };
for (const id of ids) {
  const m = meta[id]; const ctx = await b.newContext({ viewport: { width: m.dims.width, height: m.dims.height } }); const p = await ctx.newPage();
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const local = cdn[r.request().url()]; if (local) return r.fulfill({ path: 'public/blocks/' + local, contentType: 'text/javascript' }); return r.abort(); });
  try {
    const staticHtml = readFileSync(`public/blocks/${id}.html`, 'utf8');
    const stamper = await ctx.newPage(); await stamper.goto('about:blank');
    const stamped = await stamper.evaluate(([html, fn]) => { const d = new DOMParser().parseFromString(html, 'text/html'); (0, eval)('(' + fn + ')')(d.body); return '<!doctype html>' + d.documentElement.outerHTML; }, [staticHtml, stampHfIds.toString()]); await stamper.close();
    await p.route(`**/blocks/${id}.html`, (r) => r.fulfill({ body: stamped, contentType: 'text/html' }));
    await p.goto(`http://127.0.0.1:3199/blocks/${id}.html`, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    const res = await p.evaluate(([html, W, H]) => {
      const doc = new DOMParser().parseFromString(html, 'text/html'); const out = { text: [], img: [], color: [] };
      const frameArea = W * H;
      for (const s of doc.querySelectorAll('[data-hf-id]')) {
        const hfId = s.getAttribute('data-hf-id'); const live = document.querySelector(`[data-hf-id="${hfId}"]`); if (!live) continue;
        if (!s.children.length) {
          const t = s.textContent.trim();
          if (t && t.length <= 60 && live.textContent.trim() === t && !['SCRIPT', 'STYLE'].includes(s.tagName)) out.text.push({ hfId, text: t });
        }
        if (s.tagName === 'IMG' && s.getAttribute('src')) out.img.push({ hfId, src: s.getAttribute('src') });
        if (!s.children.length && !s.textContent.trim() && s.tagName !== 'IMG') {
          const cs = getComputedStyle(live); const r = live.getBoundingClientRect(); const area = r.width * r.height;
          if (area > 400 && area < frameArea * 0.25 && cs.backgroundColor && !/gradient/.test(cs.backgroundImage)) out.color.push({ hfId, bg: cs.backgroundColor });
        }
      }
      out.visibleText = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n; (n = walker.nextNode());) { const t = n.textContent.trim(); if (t.length >= 2 && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(n.parentElement.tagName)) out.visibleText.push(t.slice(0, 60)); }
      return out;
    }, [stamped, m.dims.width, m.dims.height]);
    const editables = [];
    res.text.slice(0, 6).forEach((t, i) => editables.push({ key: `t${i + 1}`, label: `Text ${i + 1}: ${t.text.length > 28 ? t.text.slice(0, 27) + '…' : t.text}`, type: 'text', defaultValue: t.text, target: { hfId: t.hfId, kind: 'text' } }));
    res.color.map((c) => ({ ...c, hex: hex(c.bg) })).filter((c) => c.hex).slice(0, 2).forEach((c, i) => editables.push({ key: `c${i + 1}`, label: `Color ${i + 1}`, type: 'color', defaultValue: c.hex, target: { hfId: c.hfId, kind: 'style', prop: 'backgroundColor' } }));
    res.img.slice(0, 2).forEach((im, i) => editables.push({ key: `i${i + 1}`, label: `Image ${i + 1} URL`, type: 'text', defaultValue: im.src, target: { hfId: im.hfId, kind: 'attr', prop: 'src' } }));
    out[id] = { editables, visibleText: res.visibleText.slice(0, 20) };
  } catch (e) { out[id] = { editables: [], error: String(e).slice(0, 120) }; }
  await ctx.close();
}
writeFileSync('out/editables.json', JSON.stringify(out, null, 1));
console.log('analysed', ids.length, 'blocks;', Object.values(out).filter((v) => v.editables.length).length, 'with editable fields');
await Promise.race([b.close(), new Promise((r) => setTimeout(r, 5000))]); process.exit(0);
