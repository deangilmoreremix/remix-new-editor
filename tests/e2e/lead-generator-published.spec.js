// The PUBLISHED video page (/watch): the real WatchPage + interactive player in a real browser, with a Lead Generator clip that has a
// design (saved the way the editor panel saves it). Desktop and phone widths: the form is drawn, it fits, nothing is cut off, it holds
// the video until it is sent, and the answers reach the lead handler.
import { test, expect } from '@playwright/test';

test.setTimeout(600_000);

const SIZES = [
  { name: 'desktop', width: 1280, height: 800, minFont: 8 },
  { name: 'phone', width: 390, height: 844, minFont: 6.5 },
];

async function runAll(page) {
  return page.evaluate(async () => {
    const { mountWatchPage } = await import('/src/pages/WatchPage.jsx');
    const lb = await import('/src/lib/editor/addons/listBuilder.js');
    const od = await import('/src/lib/editor/addons/optinDesigns.js');
    const ids = od.OPTIN_DESIGNS.map((d) => d.id);
    const results = [];
    for (const id of ids) {
      document.body.innerHTML = '';
      const clip = { id: 'lf', type: 'lead-form', heading: 'Please enter your details to find out more', ctaText: 'Play', fields: [{ id: 'email', type: 'email', label: 'Email' }], style: {} };
      const base = lb.leadFormToOptin(clip);
      lb.applyOptinToLeadForm(clip, { ...base, ...od.applyOptinDesign(base, od.getOptinDesign(id)) });
      const T = 20;
      const project = {
        version: 1, title: 'Demo', timelineSeconds: T, listBuilder: null,
        tracks: [
          { id: 'v', type: 'video', items: [{ left: 0, width: 100, id: 'vid', type: 'video', src: 'https://cdn/x.mp4' }] },
          { id: 't', type: 'text', items: [{ left: 25, width: 5, ...JSON.parse(JSON.stringify(clip)) }] },
        ],
      };
      const e = { frame: 0, playing: false, onFrame: null };
      const createEngine = (host, o) => {
        e.onFrame = o.onFrame;
        return { play: () => { e.playing = true; }, pause: () => { e.playing = false; }, seekToFrame: (f) => { e.frame = f; }, update() {}, destroy() {} };
      };
      const leads = [];
      const box = document.createElement('div');
      document.body.appendChild(box);
      window.history.replaceState({}, '', '/watch/abcdefgh12');
      await mountWatchPage(box, 'abcdefgh12', {
        fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project, privacy: 'public' }),
        createEngine,
        analytics: { track() {}, trackWatch() {}, onPlayerChange() {}, flush() {}, destroy() {}, sessionId: 'x' },
        heatmap: { destroy() {}, onPlayerChange() {} },
        onLead: async (x) => { leads.push(x); return { stored: true }; },
      });
      const big = box.querySelector('[data-bigplay]');
      if (big) big.click();
      await new Promise((r) => setTimeout(r, 120));
      e.frame = Math.round(5.5 * 30); e.onFrame(e.frame);
      await new Promise((r) => setTimeout(r, 400));
      const form = box.querySelector('.addon-overlay--optin form');
      if (!form) { results.push({ id, shown: false }); continue; }
      const rect = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
      const frameBox = rect(box.querySelector('[data-frame]'));
      const card = rect(form.querySelector('.form-inner'));
      const btn = rect(form.querySelector('button[type="submit"]'));
      const ctx = document.createElement('canvas').getContext('2d');
      const cut = []; let minFont = 99;
      form.querySelectorAll('.input-wrapper input:not([type="radio"]):not([type="checkbox"])').forEach((el) => {
        if (!el.offsetParent) return;
        const cs = getComputedStyle(el); minFont = Math.min(minFont, parseFloat(cs.fontSize));
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (ctx.measureText(el.placeholder.trim()).width > room + 0.5) cut.push(el.placeholder.trim());
      });
      const held = !e.playing;
      // fill and send (a stepped design is walked through)
      const steps = Number(form.dataset.steps || 1);
      for (let s = 0; s < steps; s += 1) {
        form.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([data-trap])').forEach((el) => { if (!el.closest('[hidden]')) el.value = el.type === 'email' ? 'ann@example.com' : 'Ann'; });
        const radio = form.querySelector('.optin-choice input[type="radio"]'); if (radio) radio.checked = true;
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise((r) => setTimeout(r, 30));
      }
      await new Promise((r) => setTimeout(r, 150));
      results.push({
        id, shown: true, design: form.dataset.design, held, fit: Number(form.dataset.fit), minFont, cut,
        cardInside: card.r <= frameBox.r + 2 && card.b <= frameBox.b + 2 && card.x >= frameBox.x - 2 && card.y >= frameBox.y - 2,
        btnInside: btn.b <= card.b + 2 && btn.r <= card.r + 2, frameW: Math.round(frameBox.w),
        sent: leads.length, email: leads[0]?.data?.EMAIL, released: e.playing,
      });
    }
    return results;
  });
}

for (const size of SIZES) {
  test(`published page, ${size.name} (${size.width}px): every design is drawn, fits, holds the video and sends the lead`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const results = await runAll(page);
    expect(results).toHaveLength(30);
    console.log(`${size.name}: frame ${results[0]?.frameW}px; text scale / box font px: ${results.map((r) => `${r.id}=${r.fit}/${Math.round(r.minFont * 10) / 10}`).join(' ')}`);
    for (const r of results) {
      expect.soft(r.shown, `${r.id}: form is shown`).toBe(true);
      if (!r.shown) continue;
      expect.soft(r.design, `${r.id}: design is drawn`).toBe(r.id);
      expect.soft(r.held, `${r.id}: holds the video`).toBe(true);
      expect.soft(r.cardInside, `${r.id}: card inside the video frame`).toBe(true);
      expect.soft(r.btnInside, `${r.id}: Play button inside the card`).toBe(true);
      expect.soft(r.cut, `${r.id}: box hints cut off`).toEqual([]);
      expect.soft(r.minFont, `${r.id}: box text ${r.minFont}px`).toBeGreaterThanOrEqual(size.minFont);
      expect.soft(r.sent, `${r.id}: lead sent once`).toBe(1);
      expect.soft(r.email, `${r.id}: answer reaches the lead handler`).toBe('ann@example.com');
      expect.soft(r.released, `${r.id}: video continues after sending`).toBe(true);
    }
  });
}
