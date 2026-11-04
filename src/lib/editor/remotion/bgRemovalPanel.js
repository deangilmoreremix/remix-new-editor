/**
 * "Remove background" section for a video/image clip. The work itself is
 * done by the page through `onRun` (bgRemoval.js + upload + clip swap).
 */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtEta = (s) => (s == null ? '' : s >= 90 ? ` · about ${Math.round(s / 60)} min left` : ` · about ${Math.max(1, Math.round(s))} s left`);

/**
 * @param {HTMLElement} container
 * @param {object} opts { kind: 'video'|'image', removed, gpu (bool|null), job (a running job for this clip, if any),
 *                        start({ maskEvery, edge, maxSize }) → job, onRestore() }
 *   job = { last (progress), cancel(), subscribe(fn) → unsubscribe, done: Promise }
 * A job keeps running if the panel is closed (another clip selected).
 */
export function renderBgRemovalPanel(container, opts = {}) {
  const ui = { busy: null, job: null, unsub: null, fast: opts.gpu === false, edge: 0, maxSize: 1280 };

  const draw = () => {
    const isVideo = opts.kind === 'video';
    container.innerHTML = `
      <div class="bg-panel">
        <h4 class="addon-panel__heading">Remove background</h4>
        ${opts.removed ? `
          <p class="addon-field__hint">✓ Background removed. The original is kept.</p>
          <button type="button" class="mini-btn" data-bg-restore>Restore original</button>`
        : ui.busy ? `
          <div class="cap-progress" role="status"><span data-bg-status>${esc(ui.busy)}</span> <button type="button" class="mini-btn" data-bg-cancel>Cancel</button></div>
          <div class="bg-bar" aria-hidden="true"><span data-bg-bar style="width:0%"></span></div>`
        : `
          <p class="addon-field__hint">Cuts out the people in this ${isVideo ? 'video' : 'image'} in your browser — nothing is uploaded until it's done. Works best on people; for green-screen footage use <strong>Green screen</strong> under Color.</p>
          ${isVideo ? `
            <label class="cap-row"><span>Speed</span><select data-bg-fast>
              <option value="0" ${ui.fast ? '' : 'selected'}>Best quality (every frame)</option>
              <option value="1" ${ui.fast ? 'selected' : ''}>Faster (every 2nd frame)</option></select></label>
            <label class="cap-row"><span>Resolution</span><select data-bg-size>
              <option value="1280" ${ui.maxSize === 1280 ? 'selected' : ''}>Up to 720p</option>
              <option value="1920" ${ui.maxSize === 1920 ? 'selected' : ''}>Up to 1080p (slower)</option></select></label>` : ''}
          <label class="cap-row"><span>Edges</span><input type="range" min="0" max="0.8" step="0.05" value="${ui.edge}" data-bg-edge aria-label="Edge hardness"/></label>
          <button type="button" class="mini-btn cap-primary" data-bg-run>Remove background</button>
          ${opts.gpu === false && isVideo ? '<p class="addon-field__hint">No WebGPU in this browser, so this runs on the CPU and can take several minutes for long clips.</p>' : ''}`}
      </div>`;
  };

  const setProgress = (p) => {
    const label = p.stage === 'download'
      ? `Downloading model… ${Math.round((p.progress || 0) * 100)}%`
      : p.frames ? `Processing frame ${p.frame || 0} of ${p.frames}${fmtEta(p.etaSec)}` : 'Processing…';
    ui.busy = label;
    const st = container.querySelector('[data-bg-status]');
    if (st) st.textContent = label; else draw();
    const bar = container.querySelector('[data-bg-bar]');
    if (bar) bar.style.width = `${Math.round((p.stage === 'download' ? 0 : p.progress || 0) * 100)}%`;
  };

  const follow = (job) => {
    ui.job = job;
    ui.busy = 'Starting…';
    draw();
    if (job.last) setProgress(job.last);
    ui.unsub = job.subscribe(setProgress);
    // The page reports success/failure (it outlives this panel).
    job.done.then(() => { ui.busy = null; }, () => {
      ui.busy = null;
      if (container.isConnected) draw();
    }).finally(() => { ui.unsub?.(); ui.unsub = null; ui.job = null; });
  };

  const run = () => {
    const job = opts.start?.({ maskEvery: ui.fast ? 2 : 1, edge: ui.edge, maxSize: ui.maxSize });
    if (job) follow(job);
  };

  const onClick = (e) => {
    const b = e.target.closest('button');
    if (!b || !container.contains(b)) return;
    if (b.dataset.bgRun !== undefined) run();
    else if (b.dataset.bgCancel !== undefined) ui.job?.cancel();
    else if (b.dataset.bgRestore !== undefined) opts.onRestore?.();
  };
  const onChangeEvt = (e) => {
    const el = e.target;
    if (el.dataset.bgFast !== undefined) ui.fast = el.value === '1';
    else if (el.dataset.bgSize !== undefined) ui.maxSize = Number(el.value);
  };
  const onInput = (e) => { if (e.target.dataset.bgEdge !== undefined) ui.edge = Number(e.target.value); };

  container.addEventListener('click', onClick);
  container.addEventListener('change', onChangeEvt);
  container.addEventListener('input', onInput);
  draw();
  if (opts.job) follow(opts.job);
  return {
    destroy() {
      ui.unsub?.();
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChangeEvt);
      container.removeEventListener('input', onInput);
    },
  };
}
