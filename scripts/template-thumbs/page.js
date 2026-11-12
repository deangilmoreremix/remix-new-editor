// Renders ONE animation / motion graphic / end screen at a representative frame into #host (called by
// scripts/generate-template-generator-thumbs.mjs, which screenshots the host). Uses the editor's own renderers.
import { createCodePreview } from '/src/lib/editor/remotion/codePreviewClient.js';
import { createPreviewEngine } from '/src/lib/editor/remotion/previewEngine.jsx';
import { timelineToComposition } from '/src/lib/editor/remotion/timelineToComposition.js';
import '/src/lib/editor/addons/index.js';
import { END_SCREENS, LEAD_FORMS, templatePreviewProject } from '/src/lib/editor/addons/templateLibrary.js';
import { presetToClips } from '/src/lib/editor/addons/overlayPresets.js';
import { hyperframesItems, createHyperframesOverlay, hyperframesOverlayLayer } from '/src/cinegen/lib/hyperframes/overlay.ts';
import { loadMgTemplates, createMgOverlay, mgOverlayLayer } from '/src/cinegen/lib/occ/mg-templates.ts';
import { hfThumb, mgThumb, tplThumb } from '/src/cinegen/lib/occ/template-thumbs.ts';

const FPS = 30;
const BOX = [480, 270];
const BG = '#0b0f16';
const host = document.getElementById('host');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fit = (w, h) => { const k = Math.min(BOX[0] / w, BOX[1] / h); return [Math.round(w * k), Math.round(h * k)]; };
let current = null;
const errors = [];

function mount(w, h) {
  current?.destroy?.();
  host.replaceChildren();
  const [fw, fh] = fit(w, h);
  host.style.width = `${fw}px`; host.style.height = `${fh}px`;
}

async function list() {
  const out = [];
  for (const i of hyperframesItems()) out.push({ kind: 'hf', id: i.id, url: hfThumb(i.id) });
  for (const t of (await loadMgTemplates()).filter((x) => x.usable)) out.push({ kind: 'mg', id: t.id, url: mgThumb(t.id) });
  for (const t of [...END_SCREENS, ...LEAD_FORMS]) out.push({ kind: 'tpl', id: t.id, url: tplThumb(t.id) });
  return out;
}

async function renderLayer(layer, w, h, frame, wait = 1400) {
  mount(w, h);
  const handle = createCodePreview(host, { onError: (_layer, message) => errors.push(String(message).slice(0, 200)) });
  current = handle;
  await handle.update({ version: 1, fps: FPS, width: w, height: h, durationInFrames: layer.durationInFrames, background: 'transparent', layers: [layer], audio: [], transitions: [], fonts: [] });
  handle.frame(frame);
  await sleep(wait);
  handle.frame(frame);
  await sleep(300);
}

async function render({ kind, id, frac, wait }) {
  errors.length = 0;
  if (kind === 'hf') {
    const item = hyperframesItems().find((i) => i.id === id);
    const layer = hyperframesOverlayLayer(createHyperframesOverlay(item, 0), FPS);
    return renderLayer(layer, item.dimensions.width, item.dimensions.height, Math.round(layer.durationInFrames * (frac ?? 0.5)), wait);
  }
  if (kind === 'mg') {
    const t = (await loadMgTemplates()).find((x) => x.id === id);
    const layer = mgOverlayLayer(createMgOverlay(t, 0), FPS);
    return renderLayer(layer, t.width, t.height, Math.round(layer.durationInFrames * (frac ?? 0.55)), wait);
  }
  const tpl = [...END_SCREENS, ...LEAD_FORMS].find((x) => x.id === id);
  const model = timelineToComposition(templatePreviewProject(tpl, presetToClips), { quality: '720p' });
  mount(model.width || 1280, model.height || 720);
  const frame = Math.round((model.durationInFrames || 90) * (frac ?? 0.6));
  let ready;
  const readyP = new Promise((r) => { ready = r; });
  const engine = createPreviewEngine(host, { model, onReady: () => ready(), onError: () => ready() });
  current = { destroy: () => { try { engine.destroy?.(); } catch { /* ignore */ } } };
  await Promise.race([readyP, sleep(6000)]);
  engine.seekToFrame?.(frame);
  await sleep(wait ?? 1200);
}

window.__thumbs = { list, render, errors: () => [...errors] };
window.__ready = true;
