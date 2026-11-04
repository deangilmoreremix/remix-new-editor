/**
 * Move / resize handles for a selected overlay, replacing upstream's
 * interact.js-based draggableResizable (lib/popcorn/helpers.js): four round
 * corner handles, drag anywhere on the element, a delete handle, clamped to
 * the stage, geometry kept in % of the stage.
 */

export function clampGeometry(g, { minSize = 3 } = {}) {
  const width = Math.max(minSize, Math.min(100, g.width));
  const height = Math.max(minSize, Math.min(100, g.height));
  return {
    width,
    height,
    left: Math.max(0, Math.min(100 - width, g.left)),
    top: Math.max(0, Math.min(100 - height, g.top)),
  };
}

/**
 * New geometry for a drag of (dxPct, dyPct) on `handle`:
 * 'move' | 'nw' | 'ne' | 'sw' | 'se'. With preserveRatio the box keeps its
 * width/height ratio (in stage %, scaled by stageAspect = stageW / stageH).
 */
export function dragGeometry(start, handle, dxPct, dyPct, { preserveRatio = false, stageAspect = 16 / 9 } = {}) {
  const { width, height } = start;
  let { left, top } = start;
  if (handle === 'move') return clampGeometry({ left: left + dxPct, top: top + dyPct, width, height });
  const east = handle.includes('e');
  const south = handle.includes('s');
  let w = width + (east ? dxPct : -dxPct);
  let h = height + (south ? dyPct : -dyPct);
  if (preserveRatio) {
    const ratio = (width * stageAspect) / (height || 1); // pixel aspect of the box
    const byWidth = Math.abs(w - width) >= Math.abs(h - height);
    if (byWidth) h = (w * stageAspect) / ratio;
    else w = (h * ratio) / stageAspect;
  }
  w = Math.max(3, w);
  h = Math.max(3, h);
  if (!east) left = left + (width - w);
  if (!south) top = top + (height - h);
  return clampGeometry({ left, top, width: w, height: h });
}

/**
 * Attach handles to `el` (absolutely positioned in `stage`).
 * opts: { geometry, preserveRatio, onChange(g), onCommit(g), onDelete() }
 * Returns detach().
 */
export function attachDragResize(el, stage, opts = {}) {
  el.classList.add('overlay-selected');
  const handles = ['nw', 'ne', 'sw', 'se'].map((pos) => {
    const h = document.createElement('span');
    h.className = `overlay-handle overlay-handle--${pos}`;
    h.dataset.handle = pos;
    h.setAttribute('aria-hidden', 'true');
    el.appendChild(h);
    return h;
  });
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'overlay-delete-handle';
  del.title = 'Remove from timeline';
  del.setAttribute('aria-label', 'Remove overlay');
  del.textContent = '✕';
  if (opts.onDelete) el.appendChild(del);

  let geometry = { left: 0, top: 0, width: 100, height: 100, ...(opts.geometry || {}) };

  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target === del) return;
    const handle = e.target.dataset?.handle || 'move';
    e.preventDefault();
    e.stopPropagation();
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const start = { ...geometry };
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moved = false;
    const onMove = (ev) => {
      const dx = ((ev.clientX - x0) / rect.width) * 100;
      const dy = ((ev.clientY - y0) / rect.height) * 100;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 0.3) return;
      moved = true;
      geometry = dragGeometry(start, handle, dx, dy, { preserveRatio: !!opts.preserveRatio, stageAspect: rect.width / rect.height });
      Object.assign(el.style, { left: `${geometry.left}%`, top: `${geometry.top}%`, width: `${geometry.width}%`, height: `${geometry.height}%` });
      opts.onChange?.(geometry);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (moved) opts.onCommit?.(geometry);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const onDelete = (e) => {
    e.stopPropagation();
    opts.onDelete?.();
  };
  el.addEventListener('pointerdown', onPointerDown);
  del.addEventListener('click', onDelete);

  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    del.removeEventListener('click', onDelete);
    handles.forEach((h) => h.remove());
    del.remove();
    el.classList.remove('overlay-selected');
  };
}
