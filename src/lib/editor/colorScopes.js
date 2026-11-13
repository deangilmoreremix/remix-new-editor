/**
 * Colour scopes computed from pixels, with no server: a histogram (R, G, B and
 * luma), a luma waveform and a vectorscope. `computeScopes` is pure (RGBA
 * bytes in, counts out); `mountColorScopes` draws them into a panel.
 * [Stage 3] Also an RGB parade (R, G, B waveforms side by side) — `parade` in the result, `drawParade` in the panel.
 */
const LUMA = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * @param {Uint8ClampedArray|number[]} data RGBA bytes
 * @param {number} width
 * @param {number} height
 * @param {{ waveformColumns?: number, step?: number }} [o]
 */
export function computeScopes(data, width, height, { waveformColumns = 160, step = 1 } = {}) {
  const hist = { r: new Uint32Array(256), g: new Uint32Array(256), b: new Uint32Array(256), luma: new Uint32Array(256) };
  const cols = Math.max(1, Math.min(waveformColumns, width));
  const waveform = new Uint32Array(cols * 256); // column-major: [col * 256 + level]
  const pcols = Math.max(1, Math.min(Math.floor(cols / 3) || 1, width));
  const parade = new Uint32Array(3 * pcols * 256); // [channel * pcols * 256 + col * 256 + level]
  const VEC = 128;
  const vector = new Uint32Array(VEC * VEC);
  let pixels = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      hist.r[r] += 1; hist.g[g] += 1; hist.b[b] += 1;
      const l = Math.min(255, Math.round(LUMA(r, g, b)));
      hist.luma[l] += 1;
      waveform[Math.min(cols - 1, Math.floor((x / width) * cols)) * 256 + l] += 1;
      const pc = Math.min(pcols - 1, Math.floor((x / width) * pcols)) * 256;
      parade[pc + r] += 1; parade[pcols * 256 + pc + g] += 1; parade[2 * pcols * 256 + pc + b] += 1;
      // BT.709 chroma (Cb, Cr), centred on 0 and scaled into the scope square.
      const cb = (b - l) / 1.8556;
      const cr = (r - l) / 1.5748;
      const vx = Math.max(0, Math.min(VEC - 1, Math.round(((cb + 128) / 256) * (VEC - 1))));
      const vy = Math.max(0, Math.min(VEC - 1, Math.round(((128 - cr) / 256) * (VEC - 1))));
      vector[vy * VEC + vx] += 1;
      pixels += 1;
    }
  }
  const mean = (arr) => { let n = 0; let sum = 0; arr.forEach((c, v) => { n += c; sum += c * v; }); return n ? sum / n : 0; };
  return { histogram: hist, waveform: { columns: cols, levels: 256, data: waveform }, parade: { columns: pcols, levels: 256, data: parade }, vectorscope: { size: VEC, data: vector }, pixels, stats: { meanLuma: mean(hist.luma), meanR: mean(hist.r), meanG: mean(hist.g), meanB: mean(hist.b) } };
}


function drawHistogram(canvas, hist) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(1, ...hist.luma, ...hist.r, ...hist.g, ...hist.b);
  ctx.globalCompositeOperation = 'lighter';
  [['r', '#ef4444'], ['g', '#22c55e'], ['b', '#3b82f6']].forEach(([k, color]) => {
    ctx.fillStyle = color; ctx.globalAlpha = 0.55;
    for (let v = 0; v < 256; v += 1) { const bar = (hist[k][v] / max) * h; ctx.fillRect((v / 256) * w, h - bar, Math.ceil(w / 256), bar); }
  });
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawWaveform(canvas, wf) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  let max = 1; wf.data.forEach((c) => { if (c > max) max = c; });
  const cw = w / wf.columns;
  for (let c = 0; c < wf.columns; c += 1) {
    for (let l = 0; l < 256; l += 1) {
      const n = wf.data[c * 256 + l]; if (!n) continue;
      ctx.fillStyle = `rgba(34,211,238,${Math.min(1, 0.2 + (n / max) * 1.4)})`;
      ctx.fillRect(c * cw, h - (l / 255) * h, Math.ceil(cw), 2);
    }
  }
}

function drawParade(canvas, pd) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  let max = 1; pd.data.forEach((c) => { if (c > max) max = c; });
  const third = w / 3; const cw = third / pd.columns;
  [['239,68,68', 0], ['34,197,94', 1], ['59,130,246', 2]].forEach(([rgb, ch]) => {
    for (let c = 0; c < pd.columns; c += 1) {
      for (let l = 0; l < 256; l += 1) {
        const n = pd.data[ch * pd.columns * 256 + c * 256 + l]; if (!n) continue;
        ctx.fillStyle = `rgba(${rgb},${Math.min(1, 0.2 + (n / max) * 1.4)})`;
        ctx.fillRect(ch * third + c * cw, h - (l / 255) * h, Math.ceil(cw), 2);
      }
    }
  });
}

function drawVectorscope(canvas, vs) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.45, 0, Math.PI * 2); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  let max = 1; vs.data.forEach((c) => { if (c > max) max = c; });
  const cell = w / vs.size;
  for (let y = 0; y < vs.size; y += 1) for (let x = 0; x < vs.size; x += 1) {
    const n = vs.data[y * vs.size + x]; if (!n) continue;
    ctx.fillStyle = `rgba(34,211,238,${Math.min(1, 0.25 + (n / max) * 1.5)})`;
    ctx.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
  }
}

/**
 * @param {HTMLElement} container
 * @param {{ getFrame: () => Promise<{data, width, height}|null>, onError?: (msg) => void }} s
 */
export function mountColorScopes(container, s) {
  container.innerHTML = `<div class="scopes">
    <p class="pz-hint">Reads the frame at the playhead. Move the playhead and press Refresh, or turn on Live.</p>
    <div class="scopes-actions"><button type="button" class="mini-btn" data-scope="refresh">↻ Refresh</button>
      <label class="scopes-live"><input type="checkbox" data-scope="live"/> Live</label><span class="scopes-stats" data-scope="stats"></span></div>
    <p class="scopes-msg" data-scope="msg" role="status"></p>
    <div class="scopes-grid">
      <figure><canvas width="256" height="120" data-scope="hist"></canvas><figcaption>Histogram</figcaption></figure>
      <figure><canvas width="256" height="120" data-scope="wave"></canvas><figcaption>Waveform</figcaption></figure>
      <figure><canvas width="256" height="120" data-scope="parade"></canvas><figcaption>RGB parade</figcaption></figure>
      <figure><canvas width="160" height="160" data-scope="vec"></canvas><figcaption>Vectorscope</figcaption></figure>
    </div></div>`;
  const q = (k) => container.querySelector(`[data-scope="${k}"]`);
  let timer = null; let busy = false;
  async function refresh() {
    if (busy) return; busy = true;
    q('msg').textContent = 'Reading the frame…';
    try {
      const frame = await s.getFrame();
      if (!frame) { q('msg').textContent = 'Add a clip to the timeline to see its scopes.'; return; }
      const sc = computeScopes(frame.data, frame.width, frame.height, { step: Math.max(1, Math.floor(frame.width / 320)) });
      drawHistogram(q('hist'), sc.histogram); drawWaveform(q('wave'), sc.waveform); drawParade(q('parade'), sc.parade); drawVectorscope(q('vec'), sc.vectorscope);
      q('stats').textContent = `Avg brightness ${Math.round((sc.stats.meanLuma / 255) * 100)}%`;
      q('msg').textContent = '';
    } catch (err) {
      q('msg').textContent = err?.message || 'Could not read this frame.';
      s.onError?.(q('msg').textContent);
    } finally { busy = false; }
  }
  container.addEventListener('click', (e) => { if (e.target.closest('[data-scope="refresh"]')) refresh(); });
  container.addEventListener('change', (e) => {
    if (e.target.dataset?.scope !== 'live') return;
    clearInterval(timer);
    if (e.target.checked) timer = setInterval(refresh, 1500);
  });
  refresh();
  return { refresh, destroy: () => clearInterval(timer) };
}
