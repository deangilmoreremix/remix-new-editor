// Paint-to-select mask for Edit Studio's Remove Object tool.
//
// The user paints over the source image; the strokes are exported as a mask
// PNG at the image's real size: white = area to remove, black = keep.
// MASK_SELECTED / MASK_KEPT are the only place that convention lives, so it
// can be flipped in one spot if a model expects the inverse.

export const MASK_SELECTED = 255; // painted pixels (remove)
export const MASK_KEPT = 0;       // untouched pixels (keep)

/**
 * Converts RGBA stroke pixels into an opaque black/white mask, in place on a
 * copy. Any painted (alpha > 0) pixel becomes MASK_SELECTED.
 * @param {Uint8ClampedArray} rgba
 * @returns {Uint8ClampedArray}
 */
export function strokesToMaskPixels(rgba) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const value = rgba[i + 3] > 0 ? MASK_SELECTED : MASK_KEPT;
    out[i] = value;
    out[i + 1] = value;
    out[i + 2] = value;
    out[i + 3] = 255;
  }
  return out;
}

export function createMaskPainter({ onChange = () => {} } = {}) {
  let mode = 'brush';
  let brushSize = 48;
  let painted = false;
  let drawing = false;
  let last = null;

  const root = document.createElement('div');
  root.className = 'flex flex-col gap-2';
  root.dataset.maskPainter = 'true';

  const toolbar = document.createElement('div');
  toolbar.className = 'flex flex-wrap items-center gap-2';

  const modeButton = (id, label) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.dataset.maskMode = id;
    btn.className = 'text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors';
    btn.onclick = () => { mode = id; syncButtons(); };
    return btn;
  };
  const brushBtn = modeButton('brush', 'Brush');
  const eraseBtn = modeButton('erase', 'Erase');

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear';
  clearBtn.className = 'text-[11px] font-bold px-3 py-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white';
  clearBtn.onclick = () => clear();

  const sizeLabel = document.createElement('label');
  sizeLabel.className = 'ml-auto flex items-center gap-2 text-[11px] text-muted';
  sizeLabel.innerHTML = '<span>Brush size</span>';
  const sizeInput = document.createElement('input');
  sizeInput.type = 'range';
  sizeInput.min = '8';
  sizeInput.max = '160';
  sizeInput.value = String(brushSize);
  sizeInput.setAttribute('aria-label', 'Brush size');
  sizeInput.oninput = () => { brushSize = Number(sizeInput.value); };
  sizeLabel.appendChild(sizeInput);

  toolbar.append(brushBtn, eraseBtn, clearBtn, sizeLabel);

  const stage = document.createElement('div');
  stage.className = 'relative w-full overflow-hidden rounded-xl border border-white/10 bg-black select-none';
  const image = document.createElement('img');
  image.alt = 'Image to mask';
  image.className = 'block w-full h-auto pointer-events-none';
  image.crossOrigin = 'anonymous';
  const canvas = document.createElement('canvas');
  canvas.className = 'absolute inset-0 w-full h-full cursor-crosshair';
  canvas.style.opacity = '0.55';
  canvas.style.touchAction = 'none';
  stage.append(image, canvas);

  const hint = document.createElement('p');
  hint.className = 'text-[11px] text-muted';
  hint.textContent = 'Paint over everything you want removed.';

  root.append(toolbar, stage, hint);

  const ctx = () => canvas.getContext && canvas.getContext('2d');

  function syncButtons() {
    for (const btn of [brushBtn, eraseBtn]) {
      const active = btn.dataset.maskMode === mode;
      btn.setAttribute('aria-pressed', String(active));
      btn.className = `text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${
        active ? 'border-primary bg-primary/15 text-primary' : 'border-white/10 text-white/70 hover:text-white'
      }`;
    }
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / Math.max(rect.width, 1)),
      y: (event.clientY - rect.top) * (canvas.height / Math.max(rect.height, 1)),
      scale: canvas.width / Math.max(rect.width, 1),
    };
  }

  function stroke(from, to) {
    const c = ctx();
    if (!c) return;
    c.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
    c.strokeStyle = '#22d3ee';
    c.fillStyle = '#22d3ee';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = brushSize * to.scale;
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!canvas.width) return;
    drawing = true;
    canvas.setPointerCapture?.(event.pointerId);
    last = point(event);
    stroke(last, last);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const next = point(event);
    stroke(last, next);
    last = next;
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    last = null;
    painted = hasPaint();
    onChange(painted);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);

  function hasPaint() {
    const c = ctx();
    if (!c || !canvas.width) return false;
    const { data } = c.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
    return false;
  }

  function clear() {
    const c = ctx();
    if (c) c.clearRect(0, 0, canvas.width, canvas.height);
    const changed = painted;
    painted = false;
    if (changed) onChange(false);
  }

  function setImage(url) {
    clear();
    canvas.width = 0;
    canvas.height = 0;
    if (!url) { image.removeAttribute('src'); return; }
    image.onload = () => {
      canvas.width = image.naturalWidth || 1024;
      canvas.height = image.naturalHeight || 1024;
    };
    image.src = url;
  }

  /** Mask PNG at the image's real size, or null when nothing is painted. */
  function toBlob() {
    const c = ctx();
    if (!c || !painted || !canvas.width) return Promise.resolve(null);
    const strokes = c.getImageData(0, 0, canvas.width, canvas.height);
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const outCtx = out.getContext('2d');
    const mask = outCtx.createImageData(canvas.width, canvas.height);
    mask.data.set(strokesToMaskPixels(strokes.data));
    outCtx.putImageData(mask, 0, 0);
    return new Promise((resolve) => out.toBlob((blob) => resolve(blob), 'image/png'));
  }

  syncButtons();
  return {
    element: root,
    setImage,
    clear,
    hasMask: () => painted,
    toBlob,
  };
}
