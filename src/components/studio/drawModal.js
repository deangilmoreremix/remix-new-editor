// Sketch pad for Image Studio (upstream's Draw-to-edit): draw on a blank or
// uploaded canvas with pencil / eraser / rectangle / arrow / text, undo/redo,
// then hand the PNG back as a reference image.

const TOOLS = [
  { id: 'pencil', label: 'Pencil' },
  { id: 'eraser', label: 'Eraser' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'text', label: 'Text' },
];
const COLORS = ['#d9ff00', '#ffffff', '#ff4d4d', '#4da3ff', '#000000'];

/**
 * @param {object} opts
 * @param {(file: File, info: { destination: 'image' | 'video' }) => void | Promise<void>} opts.onDone — receives the PNG
 * @param {string} [opts.backgroundUrl] — optional image to draw over
 * @param {number} [opts.width] @param {number} [opts.height]
 */
export function openDrawModal({ onDone, backgroundUrl, width = 1024, height = 1024 }) {
  const state = { tool: 'pencil', color: COLORS[0], size: 6, undo: [], redo: [], drawing: false, start: null, snapshot: null };

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[150] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Draw a reference');
  overlay.dataset.drawModal = '';
  overlay.innerHTML = `
    <div class="w-full max-w-[860px] max-h-full flex flex-col gap-3 rounded-3xl bg-[#111] border border-white/10 p-4">
      <div class="flex items-center gap-2 flex-wrap" data-toolbar></div>
      <div class="flex-1 min-h-0 overflow-auto flex justify-center"><canvas data-canvas class="max-w-full max-h-[62vh] rounded-xl bg-white touch-none cursor-crosshair"></canvas></div>
      <div class="flex justify-end gap-2">
        <button type="button" data-cancel class="px-4 py-2 rounded-full bg-white/10 text-white text-sm font-semibold">Cancel</button>
        <button type="button" data-done-video class="px-4 py-2 rounded-full bg-white/10 text-white text-sm font-semibold">Animate as video</button>
        <button type="button" data-done class="px-5 py-2 rounded-full bg-primary text-black text-sm font-bold">Use as reference</button>
      </div>
    </div>`;
  const canvas = overlay.querySelector('[data-canvas]');
  const toolbar = overlay.querySelector('[data-toolbar]');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (backgroundUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(width / img.width, height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
      pushUndo();
    };
    img.src = backgroundUrl;
  }

  const snap = () => ctx.getImageData(0, 0, width, height);
  function pushUndo() { state.undo.push(snap()); if (state.undo.length > 40) state.undo.shift(); state.redo = []; syncButtons(); }
  function restore(data) { ctx.putImageData(data, 0, 0); }
  function undo() { if (state.undo.length < 2) return; state.redo.push(state.undo.pop()); restore(state.undo[state.undo.length - 1]); syncButtons(); }
  function redo() { const next = state.redo.pop(); if (!next) return; state.undo.push(next); restore(next); syncButtons(); }

  const mkBtn = (label, attrs = {}) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = 'h-[34px] px-3 rounded-lg text-xs font-semibold border border-white/10 text-white/70 hover:text-white hover:bg-white/10';
    Object.entries(attrs).forEach(([k, v]) => { b.dataset[k] = v; });
    return b;
  };
  const toolButtons = TOOLS.map((t) => {
    const b = mkBtn(t.label, { tool: t.id });
    b.addEventListener('click', () => { state.tool = t.id; syncButtons(); });
    return b;
  });
  const colorButtons = COLORS.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `Color ${c}`);
    b.dataset.color = c;
    b.className = 'w-6 h-6 rounded-full border border-white/30';
    b.style.background = c;
    b.addEventListener('click', () => { state.color = c; syncButtons(); });
    return b;
  });
  const size = document.createElement('input');
  size.type = 'range'; size.min = '2'; size.max = '40'; size.value = String(state.size);
  size.setAttribute('aria-label', 'Brush size');
  size.addEventListener('input', () => { state.size = Number(size.value); });
  const undoBtn = mkBtn('Undo', { action: 'undo' });
  const redoBtn = mkBtn('Redo', { action: 'redo' });
  const clearBtn = mkBtn('Clear', { action: 'clear' });
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  clearBtn.addEventListener('click', () => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); pushUndo(); });
  toolbar.append(...toolButtons, ...colorButtons, size, undoBtn, redoBtn, clearBtn);

  function syncButtons() {
    toolButtons.forEach((b) => b.classList.toggle('!text-primary', b.dataset.tool === state.tool));
    colorButtons.forEach((b) => b.classList.toggle('ring-2', b.dataset.color === state.color) || b.classList.toggle('ring-primary', b.dataset.color === state.color));
    undoBtn.disabled = state.undo.length < 2;
    redoBtn.disabled = state.redo.length === 0;
    undoBtn.classList.toggle('opacity-40', undoBtn.disabled);
    redoBtn.classList.toggle('opacity-40', redoBtn.disabled);
  }

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height };
  };
  function drawShape(from, to, preview) {
    if (preview) restore(state.snapshot);
    ctx.strokeStyle = state.color;
    ctx.fillStyle = state.color;
    ctx.lineWidth = state.size;
    ctx.globalCompositeOperation = 'source-over';
    if (state.tool === 'rect') {
      ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
    } else if (state.tool === 'arrow') {
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const head = Math.max(16, state.size * 3);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 6), to.y - head * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 6), to.y - head * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    if (state.tool === 'text') {
      const text = window.prompt('Text to add');
      if (text) {
        ctx.fillStyle = state.color;
        ctx.font = `${Math.max(24, state.size * 6)}px sans-serif`;
        ctx.fillText(text, p.x, p.y);
        pushUndo();
      }
      return;
    }
    canvas.setPointerCapture?.(e.pointerId);
    state.drawing = true;
    state.start = p;
    state.snapshot = snap();
    if (state.tool === 'pencil' || state.tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.drawing) return;
    const p = pos(e);
    if (state.tool === 'pencil' || state.tool === 'eraser') {
      ctx.strokeStyle = state.tool === 'eraser' ? '#ffffff' : state.color;
      ctx.lineWidth = state.tool === 'eraser' ? state.size * 2 : state.size;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      drawShape(state.start, p, true);
    }
  });
  const end = (e) => {
    if (!state.drawing) return;
    state.drawing = false;
    if (state.tool === 'rect' || state.tool === 'arrow') drawShape(state.start, pos(e), true);
    pushUndo();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('[data-cancel]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const finish = (destination) => canvas.toBlob(async (blob) => {
    if (!blob) return;
    close();
    await onDone(new File([blob], `sketch-${Date.now()}.png`, { type: 'image/png' }), { destination });
  }, 'image/png');
  overlay.querySelector('[data-done]').addEventListener('click', () => finish('image'));
  overlay.querySelector('[data-done-video]').addEventListener('click', () => finish('video'));

  pushUndo();
  document.body.appendChild(overlay);
  return { close, overlay };
}
