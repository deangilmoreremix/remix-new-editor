// tests/e2e/guide-videos.spec.js
//
// Records one silent, captioned tour video per studio guide (/studios/<slug>).
// It reads the narration script (scripts/guide-videos/narration/<slug>.json) and
// the per-feature targets already used for the guide screenshots
// (tests/e2e/guide-targets/<slug>.json). For each narrated feature it:
//   1. opens the studio and gets it ready (not recorded),
//   2. starts a screencast clip (JPEG frames piped to ffmpeg, so it needs ffmpeg on the PATH), shows the caption, glides a cursor to the control,
//      rings it and, for safe tabs and dropdowns, opens it,
//   3. holds until the line has had time to be spoken, then stops the clip.
// scripts/guide-videos/assemble.mjs joins the clips (and, later, voiceover audio).
//
//   1. npm run dev                          (http://localhost:3100)
//   2. npm run capture:videos               (all studios)
//      GUIDES=image-studio npm run capture:videos
//      FORCE=1 ...                          re-record even when nothing changed
//   3. npm run assemble:videos
//
// Uses ?dev (auth bypass, placeholder key): nothing is generated or billed, and
// the DANGEROUS filter keeps the cursor off any control that would spend credits.
// Output: node_modules/.cache/guide-videos/<slug>/{clips/*.mp4,timeline.json}

import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { TARGETS, DANGEROUS, SKIP_STUDIOS } from './guide-screenshot-targets.js';
import { BASE, apiModalOpen, closeApiModal, open, findControl } from './guide-helpers.js';
import { loadGuides, loadNarration, wordCount } from '../../scripts/guide-videos/lib.mjs';

const ROOT = process.cwd();
const OUT = process.env.GUIDE_VIDEO_DIR || path.join(ROOT, 'node_modules/.cache/guide-videos');
const VIEW = { width: 1440, height: 900 };
const only = (process.env.GUIDES || '').split(',').filter(Boolean);

// Seconds a line needs on screen. With voiceover this is the measured clip length
// (scripts/guide-videos/audio/<slug>/durations.json), otherwise a reading-pace estimate.
function lineSeconds(slug, key, text) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/guide-videos/audio', slug, 'durations.json'), 'utf8'));
    if (d[key]) return d[key] + 0.9;
  } catch { /* no audio yet */ }
  return Math.max(4.5, wordCount(text) / 2.5 + 1.2);
}

// Studios whose page cannot run on the capture machine (an external service or a backend access gate). Their tour
// is caption-only: each narrated line is shown on a branded slide in the same overlay, timing and pipeline as the live tours.
const CAPTION_ONLY = new Set(['website-builder', 'smartviddownloader']);
const GUIDES = loadGuides().filter((g) => (only.length ? only.includes(g.slug) : (!SKIP_STUDIOS.includes(g.slug) || CAPTION_ONLY.has(g.slug))) && loadNarration(g.slug));

test.use({
  viewport: VIEW,
  deviceScaleFactor: 1,
  bypassCSP: true,
  ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] } } : {}),
});
test.setTimeout(25 * 60 * 1000);

// ---- on-screen guidance: caption, studio tag, cursor and focus ring --------------------------

async function installOverlay(page) {
  await page.evaluate(({ w, h }) => {
    document.getElementById('__tour')?.remove();
    const root = document.createElement('div');
    root.id = '__tour';
    root.innerHTML = `<style>
      #__tour{position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
      #__tour .ring{position:absolute;border:3px solid #d9ff00;border-radius:12px;opacity:0;box-shadow:0 0 0 9999px rgba(0,0,0,.38),0 0 24px rgba(217,255,0,.75),inset 0 0 0 1px rgba(0,0,0,.6);transition:opacity .4s}
      #__tour .cursor{position:absolute;left:0;top:0;width:28px;height:28px;opacity:0;transition:transform .85s cubic-bezier(.4,0,.2,1),opacity .3s;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
      #__tour .ripple{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:3px solid #d9ff00;opacity:0}
      #__tour .ripple.go{animation:__rip .7s ease-out}
      @keyframes __rip{0%{opacity:.95;transform:scale(.4)}100%{opacity:0;transform:scale(3.2)}}
      #__tour .cap{position:absolute;left:50%;max-width:1040px;padding:15px 28px;border-radius:16px;background:rgba(10,10,12,.9);color:#fff;font-size:25px;font-weight:500;line-height:1.38;text-align:center;border:1px solid rgba(217,255,0,.4);box-shadow:0 10px 40px rgba(0,0,0,.5);opacity:0;transform:translate(-50%,10px);transition:opacity .45s,transform .45s}
      #__tour .cap.on{opacity:1;transform:translate(-50%,0)}
      #__tour .tag{position:absolute;left:28px;top:22px;padding:8px 16px;border-radius:999px;background:#d9ff00;color:#0a0a0c;font-size:17px;font-weight:700;letter-spacing:.02em;opacity:0;transition:opacity .45s}
      #__tour .tag.on{opacity:1}
    </style>
    <div class="ring"></div><div class="ripple"></div>
    <svg class="cursor" viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.5L9 19z" fill="#fff" stroke="#0a0a0c" stroke-width="1.5" stroke-linejoin="round"/></svg>
    <div class="tag"></div><div class="cap"></div>`;
    document.body.appendChild(root);
    const c = root.querySelector('.cursor');
    c.style.transition = 'none';
    c.style.transform = `translate(${w * 0.55}px,${h * 0.55}px)`;
    void c.offsetWidth;
    c.style.transition = '';
  }, { w: VIEW.width, h: VIEW.height });
}

// patch: { caption, capTop, tag, ring: {x,y,width,height}|null, cursor: {x,y}|null, click: {x,y} }
async function ui(page, patch) {
  await page.evaluate((p) => {
    const root = document.getElementById('__tour');
    if (!root) return;
    const $ = (s) => root.querySelector(s);
    if ('caption' in p) {
      const cap = $('.cap');
      if (p.caption) {
        cap.textContent = p.caption;
        cap.style.top = p.capTop ? '24px' : 'auto';
        cap.style.bottom = p.capTop ? 'auto' : '34px';
        cap.classList.add('on');
      } else cap.classList.remove('on');
    }
    if ('tag' in p) { const t = $('.tag'); t.textContent = p.tag || ''; t.classList.toggle('on', !!p.tag); }
    if ('ring' in p) {
      const r = $('.ring');
      if (p.ring) {
        Object.assign(r.style, { left: `${p.ring.x - 6}px`, top: `${p.ring.y - 6}px`, width: `${p.ring.width + 12}px`, height: `${p.ring.height + 12}px`, opacity: 1 });
        // Once the control is clicked its menu/panel is open: no dark backdrop, or the panel itself would be dimmed.
        r.style.boxShadow = p.lit ? '0 0 24px rgba(217,255,0,.75), inset 0 0 0 1px rgba(0,0,0,.6)' : '';
      } else r.style.opacity = 0;
    }
    if ('cursor' in p) {
      const c = $('.cursor');
      if (p.cursor) { c.style.opacity = 1; c.style.transform = `translate(${p.cursor.x}px,${p.cursor.y}px)`; } else c.style.opacity = 0;
    }
    if (p.click) {
      const rip = $('.ripple');
      rip.style.left = `${p.click.x}px`; rip.style.top = `${p.click.y}px`;
      rip.classList.remove('go'); void rip.offsetWidth; rip.classList.add('go');
    }
  }, patch);
}

// A branded backdrop for caption-only tours (the studio's page cannot run on the capture machine).
async function showSlide(page, { kicker, title, sub }) {
  const esc = (x) => String(x || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  await page.goto('about:blank');
  await page.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;height:100%;background:#0a0a0c;color:#fff;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
    .bg{position:fixed;inset:0;background:radial-gradient(900px 520px at 78% 18%,rgba(217,255,0,.10),transparent 70%),radial-gradient(700px 480px at 12% 90%,rgba(217,255,0,.06),transparent 70%)}
    .grid{position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse at 50% 40%,#000 25%,transparent 75%)}
    .box{position:fixed;left:0;right:0;top:30%;padding:0 140px}
    .k{font-size:22px;font-weight:700;letter-spacing:.16em;color:#d9ff00;text-transform:uppercase}
    h1{margin:18px 0 0;font-size:84px;line-height:1.05;font-weight:800;letter-spacing:-.02em;max-width:1100px}
    p{margin:22px 0 0;font-size:30px;line-height:1.4;color:#a1a1aa;max-width:980px}
  </style></head><body><div class="bg"></div><div class="grid"></div><div class="box"><div class="k">${esc(kicker)}</div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></body></html>`);
}

// ---- recording -------------------------------------------------------------------------------

// Records clips from Playwright's screencast frames (JPEG) by piping them to the system ffmpeg, so
// the clips are H.264 at a steady 30 fps and don't depend on Playwright's bundled video encoder.
class Recorder {
  constructor(page, dir) { this.page = page; this.dir = dir; this.n = 0; this.clips = []; this.live = null; }
  async begin(key, text) {
    const file = path.join(this.dir, `${String(++this.n).padStart(3, '0')}-${key.slice(0, 40)}.mp4`);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-use_wallclock_as_timestamps', '1', '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', 'pipe:0',
      '-vf', `fps=30,scale=${VIEW.width}:${VIEW.height},format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-movflags', '+faststart', file],
    { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (d) => { err += d; });
    ff.stdin.on('error', () => {});
    const done = new Promise((resolve) => ff.on('close', (code) => resolve({ code, err })));
    const live = { file, ff, done, last: null, t0: Date.now() };
    // Frames arrive only when the page changes; ffmpeg's fps filter holds the last one in between.
    await this.page.screencast.start({ size: VIEW, quality: 92, onFrame: ({ data }) => { live.last = data; if (ff.stdin.writable) ff.stdin.write(data); } });
    this.live = live;
    this.clips.push({ key, text, file: path.relative(this.dir, file) });
  }
  async end() {
    const live = this.live;
    if (!live) return 0;
    this.live = null;
    await this.page.screencast.stop();
    if (live.last && live.ff.stdin.writable) live.ff.stdin.write(live.last); // closes the final hold at the stop time
    live.ff.stdin.end();
    const r = await live.done;
    if (r.code !== 0) throw new Error(`ffmpeg failed on ${path.basename(live.file)}: ${r.err.split('\n')[0]}`);
    return (Date.now() - live.t0) / 1000;
  }
}

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);


// ---- doing the thing, the way a person would ----
const MEDIA = {
  image: path.join(process.cwd(), 'scripts/guide-videos/media/sample-image.jpg'),
  video: path.join(process.cwd(), 'scripts/guide-videos/media/sample-video.mp4'),
  audio: path.join(process.cwd(), 'scripts/guide-videos/media/sample-audio.mp3'),
};
const DEFAULT_PROMPT = 'A golden-hour product shot of a perfume bottle on a marble table, soft window light, shallow depth of field';
const UPLOADISH = /upload|attach|browse|choose file|drop|paperclip|reference|source (image|video)|add (image|video|media|photo)/i;

function mediaFor(accept, hint) {
  const a = `${accept || ''} ${hint || ''}`.toLowerCase();
  if (/audio|mp3|wav|voice|music|sound/.test(a)) return MEDIA.audio;
  if (/video|mp4|mov|webm/.test(a) && !/image/.test(a)) return MEDIA.video;
  return MEDIA.image;
}

async function act(el, target, feature, label) {
  const info = await el.evaluate((n) => {
    const tag = n.tagName.toLowerCase();
    const fileIn = n.matches('input[type=file]') ? n : n.querySelector('input[type=file]');
    return {
      tag, type: (n.getAttribute('type') || '').toLowerCase(), editable: n.isContentEditable,
      accept: fileIn ? fileIn.getAttribute('accept') || '' : null, hasFile: !!fileIn,
      placeholder: n.getAttribute('placeholder') || '',
    };
  }).catch(() => null);
  if (!info) return;
  const textual = info.tag === 'textarea' || info.editable || (info.tag === 'input' && !['file', 'checkbox', 'radio', 'range', 'color', 'button', 'submit'].includes(info.type));
  if (target?.upload || info.hasFile || (!textual && UPLOADISH.test(label))) {
    const file = MEDIA[target?.file] || mediaFor(info.accept, `${label} ${feature.name}`);
    try {
      const [fc] = await Promise.all([page_().waitForEvent('filechooser', { timeout: 2500 }), el.click({ timeout: 3000 })]);
      await fc.setFiles(file);
    } catch {
      // No chooser: some studios keep a hidden input next to the button.
      const input = page_().locator('input[type=file]').first();
      if (await input.count()) await input.setInputFiles(file).catch(() => {});
    }
    await page_().waitForTimeout(2500);
    return;
  }
  if (textual) {
    await el.click({ timeout: 3000 }).catch(() => {});
    await el.type(target?.type || DEFAULT_PROMPT, { delay: 38 }).catch(() => {});
    await page_().waitForTimeout(600);
    return;
  }
  if (info.tag === 'select') {
    await el.selectOption({ index: 1 }).catch(() => {});
    return;
  }
  await el.click({ timeout: 3000 }).catch(() => {});
}

// The ring should cover the whole feature, not just the matched element: a prompt box is the whole prompt bar.
// `ring` in a demo/target (a selector) wins; otherwise a lone text field grows to its rounded card (if that is a sensible size).
async function ringBox(el, target) {
  const pg = page_();
  try {
    if (target?.ring) {
      const r = await pg.locator(target.ring).filter({ visible: true }).first().boundingBox();
      if (r) return r;
    }
    // boundingBox() is relative to the page even inside an iframe; measure the grown box as an offset from the element.
    const own = await el.boundingBox();
    if (!own) return null;
    const d = await el.evaluate((n) => {
      const r0 = n.getBoundingClientRect();
      const fieldish = ['TEXTAREA', 'INPUT'].includes(n.tagName) || n.isContentEditable;
      let best = r0;
      if (fieldish) {
        let p = n.parentElement;
        for (let i = 0; i < 4 && p && p !== document.body; i++, p = p.parentElement) {
          const r = p.getBoundingClientRect();
          const rounded = parseFloat(getComputedStyle(p).borderTopLeftRadius) >= 8;
          if (r.height > 420 || r.width > innerWidth - 40) break;
          if (rounded && r.width >= r0.width && r.height >= r0.height) best = r;
        }
      }
      return { dx: best.x - r0.x, dy: best.y - r0.y, width: best.width, height: best.height };
    });
    return { x: own.x + d.dx, y: own.y + d.dy, width: d.width, height: d.height };
  } catch { return null; }
}

// A follow-up step in a demo: glide to a control, ring it, and use it. Never generates, publishes, sends, pays or deletes.
const NEVER = /\b(generate|publish|send|pay|buy|purchase|subscribe|deploy|delete|remove all|log ?out|sign ?out)\b/i;
async function followUp(a, c, id) {
  const pg = page_();
  if (a.wait) { await pg.waitForTimeout(a.wait); if (!a.selector && !a.text) return; }
  const loc = a.selector ? pg.locator(a.selector).filter({ visible: true }).first() : pg.getByText(a.text, { exact: Boolean(a.exact) }).filter({ visible: true }).first();
  const el = await loc.elementHandle({ timeout: 4000 }).catch(() => null);
  if (!el) { console.log(`    ! ${id}: follow-up not found: ${a.selector || a.text}`); return; }
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const label = (await el.evaluate((n) => [n.innerText, n.getAttribute('aria-label'), n.getAttribute('title')].filter(Boolean).join(' ').trim()).catch(() => '')) || '';
  const box = await el.boundingBox().catch(() => null);
  if (box) {
    await c.ui({ cursor: { x: box.x + Math.min(box.width / 2, 120), y: box.y + box.height / 2 } });
    await pg.waitForTimeout(700);
    await c.ui({ ring: (await ringBox(el, a)) || box });
    await pg.waitForTimeout(700);
  }
  if (NEVER.test(label) && !a.type) { console.log(`    - ${id}: not clicking "${label.slice(0, 30)}"`); return; }
  if (box) await c.ui({ click: { x: box.x + Math.min(box.width / 2, 120), y: box.y + box.height / 2 } });
  await act(el, a, { name: id }, label);
  const rn = await ringBox(el, a);
  await c.ui({ ring: rn, lit: true });
  await pg.waitForTimeout(a.hold || 1200);
}

let CURRENT_PAGE;
const page_ = () => CURRENT_PAGE;

for (const guide of GUIDES) {
  test(`guide video: ${guide.slug}`, async ({ page }) => {
    const narr = loadNarration(guide.slug);
    CURRENT_PAGE = page;
    let demos = {};
    try { demos = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests/e2e/guide-demos', `${guide.slug}.json`), 'utf8')); } catch {}

    // Uploads normally go to MuAPI, which rejects the placeholder key. Answer them locally with the sample file,
    // so the studio shows the uploaded media exactly as it would after a real upload. Nothing leaves the machine.
    const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const KINDS = { image: ['sample-image.jpg', 'image/jpeg'], video: ['sample-video.mp4', 'video/mp4'], audio: ['sample-audio.mp3', 'audio/mpeg'] };
    await page.context().route(/__tour_media\//, (route) => {
      const kind = /sample-(image|video|audio)/.exec(route.request().url())?.[1] || 'image';
      return route.fulfill({ status: 200, contentType: KINDS[kind][1], headers: CORS, body: fs.readFileSync(path.join(process.cwd(), 'scripts/guide-videos/media', KINDS[kind][0])) });
    });
    await page.context().route(/upload_file|\/functions\/v1\//, (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      const isUpload = /upload_file/.test(req.url()) || req.headers()['x-endpoint'] === 'upload_file';
      if (req.method() !== 'POST' || !isUpload) return route.fallback();
      const head = (req.postDataBuffer() || Buffer.alloc(0)).subarray(0, 600).toString('latin1');
      const kind = /filename="[^"]*(video|audio)/i.exec(head)?.[1]?.toLowerCase() || (/filename="[^"]*\.(mp4|mov|webm)/i.test(head) ? 'video' : 'image');
      const file = KINDS[kind][0];
      const url = `${BASE}/__tour_media/${file}`;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ url, file_url: url, data: { url }, result: { url } }) });
    });
    // Video Pages needs Supabase and a signed-in user. Run it against a dev server started with a fake
    //   VITE_SUPABASE_URL=http://127.0.0.1:54399 (see the README), and answer its data calls with one sample page here.
    //   Nothing real is read or written.
    if (guide.slug === 'video-pages') {
      await page.addInitScript(() => { window.Clerk = { user: { id: 'user_tour_demo' }, session: { getToken: async () => 'tour.fake.token' } }; });
      await page.context().route('http://127.0.0.1:54399/**', (route) => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
        const now = new Date().toISOString();
        const sample = { id: 'tour-page-1', title: 'Spring launch demo', video_url: `${BASE}/__tour_media/sample-video.mp4`, poster_url: `${BASE}/__tour_media/sample-image.jpg`, duration: 12, source: 'upload', config: {}, published: false, view_count: 0, created_at: now, updated_at: now };
        return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(/\/landing_pages/.test(route.request().url()) ? [sample] : []) });
      });
    }
    // A placeholder key keeps the "set up your API keys" modal from interrupting the tour. It is never valid, so nothing can be billed.
    await page.addInitScript(() => { try { const v = btoa('muapi_2024_tour-placeholder-key'); for (const k of ['muapi_key', 'openai_key', 'pexels_key', 'pixabay_key', 'videodb_key']) if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch {} }); // the app stores keys obfuscated (apiKeyManager.js), so a raw value reads as no key
    // Second layer: if the API-key modal is ever mounted (page or studio iframe), remove it the moment it appears,
    // so it can never be on screen in a recorded frame. The seeded keys above are the real fix; this is the net.
    await page.addInitScript(() => {
      const kill = () => {
        for (const h of document.querySelectorAll('h2')) {
          if (/set up your API keys/i.test(h.textContent || '')) { (h.closest('.fixed') || h.closest('[data-auth-modal]') || h.parentElement?.parentElement)?.remove(); console.log('[tour] removed API key modal'); }
        }
      };
      new MutationObserver(kill).observe(document, { childList: true, subtree: true });
    });
    page.on('console', (m) => { if (m.text().includes('[tour] removed API key modal')) console.log('    ! API key modal appeared and was removed'); });
    const targets = TARGETS[guide.slug] || {};
    const dir = path.join(OUT, guide.slug);
    const timelineFile = path.join(dir, 'timeline.json');
    const hash = sha(JSON.stringify([narr, targets, demos, guide.route, CAPTION_ONLY.has(guide.slug) ? 'slides-1' : '', process.env.GUIDE_VIDEO_VERSION || '4']));
    if (!process.env.FORCE && fs.existsSync(timelineFile) && JSON.parse(fs.readFileSync(timelineFile, 'utf8')).hash === hash) {
      console.log(`  = ${guide.slug}: up to date (FORCE=1 to re-record)`);
      return;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(dir, 'clips'), { recursive: true });
    const rec = new Recorder(page, path.join(dir, 'clips'));
    const segments = [];
    const warnings = [];

    // One narrated segment: ready the page (unrecorded), then record `body` with the caption up.
    // `body(extend)` returns once the visuals are done; the rest of the line's time is held.
    async function segment(key, text, { route = guide.route, prepare, body, tag, slide } = {}) {
      if (CAPTION_ONLY.has(guide.slug)) await showSlide(page, slide || { kicker: guide.name, title: guide.name });
      else await open(page, route);
      if (prepare) await prepare();
      await installOverlay(page);
      const need = lineSeconds(guide.slug, key, text);
      await rec.begin(key, text);
      let kept = 0; // seconds of clips already stopped (the clip can be split around a modal)
      const ctx = { split: async () => { kept += await rec.end(); }, resume: async () => { await rec.begin(key, text); }, ui: (p) => ui(page, p) };
      try {
        if (tag) await ui(page, { tag });
        await body?.(ctx);
      } catch (e) {
        warnings.push(`${key}: ${e.message.split('\n')[0]}`);
        console.log(`    ! ${guide.slug}/${key}: ${e.message.split('\n')[0]}`);
      }
      const wait = Math.max(0, need - (kept + (rec.live ? (Date.now() - rec.live.t0) / 1000 : 0)));
      await page.waitForTimeout(wait * 1000);
      await ui(page, { caption: null, ring: null, cursor: null, tag: null });
      await page.waitForTimeout(450);
      kept += await rec.end();
      segments.push({ key, text, seconds: Number(kept.toFixed(2)) });
    }

    // Caption helper that picks the top or bottom of the screen away from the control.
    const place = async (box) => (box ? box.y + box.height / 2 > VIEW.height * 0.5 : false);

    // Seed demo state (e.g. a sample brand) once, unrecorded; it lives in localStorage, so every segment sees it.
    const ov = targets.__overview;
    if (ov?.setup) {
      await open(page, guide.route);
      await page.evaluate(ov.setup).catch((e) => console.log(`    overview setup error: ${e.message.split('\n')[0]}`));
    }

    // ---- intro: the studio as it opens ----
    await segment('intro', narr.intro, {
      tag: guide.name,
      slide: { kicker: 'SmartVideo studio tour', title: guide.name, sub: guide.shortDescription },
      body: async (c) => { await c.ui({ caption: narr.intro, capTop: false }); },
    });

    // ---- one segment per narrated feature ----
    for (const [id, text] of Object.entries(narr.features)) {
      if (process.env.FEATURES && !process.env.FEATURES.split(',').includes(id)) continue; // quick trials only
      const feature = guide.features.find((f) => f.id === id);
      if (!feature) { warnings.push(`${id}: not in guide`); continue; }
      if (CAPTION_ONLY.has(guide.slug)) {
        const n = Object.keys(narr.features).indexOf(id) + 1;
        await segment(id, text, {
          tag: guide.name,
          slide: { kicker: `Feature ${n} of ${Object.keys(narr.features).length}`, title: feature.name },
          body: async (c) => { await c.ui({ caption: text, capTop: false }); },
        });
        continue;
      }
      const target = { ...targets[id], ...demos[id] };
      if (target?.skip) { warnings.push(`${id}: target is skip`); }
      const route = target?.route || guide.route;
      const fresh = Boolean(target?.setup || target?.steps);
      const showsResultOnly = (fresh || target?.route) && !target?.text && !target?.selector;

      await segment(id, text, {
        route,
        prepare: async () => {
          // A heavy studio can still be mounting after the page load: wait until this element exists.
          if (target?.waitFor) await page.waitForSelector(target.waitFor, { timeout: 90000 }).catch(() => console.log(`    waitFor timed out: ${target.waitFor}`));
          if (target?.setup) {
            await page.evaluate(target.setup).catch(() => {});
            if (target.reload !== false) await open(page, route);
          }
          for (const step of target?.steps || []) {
            // Look in the page and in any embedded studio frame (the dashboard studios live in iframes).
            let loc = null;
            for (const fr of page.frames()) {
              const cand = step.selector
                ? fr.locator(step.selector).filter({ visible: true }).first()
                : fr.getByText(step.text, { exact: Boolean(step.exact) }).filter({ visible: true }).first();
              if (await cand.count().catch(() => 0)) { loc = cand; break; }
            }
            if (loc) await loc.click({ timeout: 4000 }).catch(() => console.log(`    step not clickable: ${step.text || step.selector}`));
            else console.log(`    step not found: ${step.text || step.selector}`);
            await page.waitForTimeout(step.wait || 1200);
            await closeApiModal(page);
          }
        },
        body: async (c) => {
          if (showsResultOnly) { await c.ui({ caption: text }); return; }
          const el = await findControl(page, feature, target);
          if (!el) { warnings.push(`${id}: no matching control`); await c.ui({ caption: text }); return; }
          const label = (await el.evaluate((n) => [n.innerText, n.getAttribute('aria-label'), n.getAttribute('title')].filter(Boolean).join(' ').trim()).catch(() => '')) || '';
          const isOpener = await el.evaluate((n) => n.getAttribute('role') === 'tab' || n.hasAttribute('aria-haspopup') || n.tagName === 'SUMMARY' || !!n.querySelector('svg polyline, svg path[d*="M6 9"]')).catch(() => false);
          const willOpen = target?.click === true || (target?.click !== false && (!DANGEROUS.test(label) || UPLOADISH.test(label) || target?.upload));
          const box = await el.boundingBox().catch(() => null);
          const capTop = await place(box);
          await c.ui({ caption: text, capTop });
          if (!box) return;
          await page.waitForTimeout(900);
          const cx = box.x + Math.min(box.width * 0.5, 120);
          const cy = box.y + box.height / 2;
          await c.ui({ cursor: { x: cx, y: cy } });
          await page.waitForTimeout(1000);
          const rbox = (await ringBox(el, target)) || box;
          await c.ui({ ring: rbox });
          await page.waitForTimeout(1200);
          if (!willOpen) return;
          const urlBefore = page.url();
          await c.ui({ click: { x: cx, y: cy } });
          await act(el, target, feature, label);
          const rnow = await ringBox(el, target); // the page may have scrolled or the field grown
          if (rnow) { await c.ui({ ring: rnow, lit: true }); }
          for (const a of target.then || []) await followUp(a, c, id);
          // An API-key prompt can pop up after a click: cut it out of the clip.
          let modal = false;
          for (let i = 0; i < 10 && !modal; i++) { await page.waitForTimeout(150); modal = await apiModalOpen(page); }
          if (modal) {
            await c.split();
            await closeApiModal(page);
            await installOverlay(page);
            await page.waitForTimeout(350);
            await c.resume();
            await c.ui({ caption: text, capTop, ring: (await ringBox(el, target)) || box, lit: true });
          }
          if (page.url() !== urlBefore) warnings.push(`${id}: control navigated away`);
          await page.waitForTimeout(1500);
        },
      });
    }

    // ---- outro: back on the studio's first view ----
    await segment('outro', narr.outro, {
      tag: guide.name,
      slide: { kicker: 'SmartVideo studio tour', title: `That's ${guide.name}` },
      body: async (c) => { await c.ui({ caption: narr.outro, capTop: false }); },
    });

    fs.writeFileSync(timelineFile, JSON.stringify({ slug: guide.slug, name: guide.name, hash, viewport: VIEW, warnings, clips: rec.clips, segments }, null, 2) + '\n');
    const total = segments.reduce((a, s) => a + s.seconds, 0);
    console.log(`  ✓ ${guide.slug}: ${segments.length} segments, ${total.toFixed(0)}s${warnings.length ? `, ${warnings.length} warnings` : ''}`);
  });
}
