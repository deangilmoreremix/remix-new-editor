// A small 3D "camera" control for the Angles / Zooms apps in the Edit Studio.
//
// It shows the user's photo as a card in a CSS-3D scene and lets them move the camera around it:
//   - drag          -> rotation (-180..180) and tilt (-90..90)
//   - wheel / pinch -> zoom (-100..100)
//   - arrow keys    -> nudge (Shift = bigger steps), "+" / "-" zoom, Home or 0 resets
//   - "Reset all"   -> back to the slider defaults
//
// The sliders stay the single source of truth: this control reads and writes the existing range
// inputs (data-control-key="adj_rotation" | "adj_tilt" | "adj_zoom") and dispatches `input` events,
// so presets, the Custom switch, prompt building and the price estimate keep working unchanged.
//
// Conventions (same as the Angles presets): rotation > 0 moves the camera to the subject's right,
// tilt > 0 moves it above the subject, zoom > 0 moves it closer.

export const CAMERA_LIMITS = Object.freeze({
  rotation: [-180, 180],
  tilt: [-90, 90],
  zoom: [-100, 100],
});

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** The CSS transform that shows the card as seen from the given camera position. */
export function cameraTransform({ rotation = 0, tilt = 0, zoom = 0 } = {}) {
  const scale = 1 + clamp(zoom, CAMERA_LIMITS.zoom) / 200; // 0.5 .. 1.5
  // Camera to the right -> the card's right edge comes toward the viewer (rotateY negative);
  // camera above -> the top edge recedes (rotateX positive).
  return `scale(${scale.toFixed(3)}) rotateX(${clamp(tilt, CAMERA_LIMITS.tilt)}deg) rotateY(${-clamp(rotation, CAMERA_LIMITS.rotation)}deg)`;
}

export function createCameraAngleControl({ label = '3D camera' } = {}) {
  const KEYS = ['rotation', 'tilt', 'zoom'];
  let inputs = {};

  const element = document.createElement('div');
  element.dataset.cameraWidget = 'true';
  element.className = 'flex flex-col gap-2';

  const head = document.createElement('div');
  head.className = 'flex items-center justify-between gap-2';
  const title = document.createElement('div');
  title.className = 'text-[11px] font-bold text-secondary uppercase tracking-wider';
  title.textContent = label;
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.dataset.cameraReset = 'true';
  reset.className = 'text-[11px] font-bold text-white/70 hover:text-white underline-offset-2 hover:underline';
  reset.textContent = 'Reset all';
  head.append(title, reset);

  const stage = document.createElement('div');
  stage.dataset.cameraStage = 'true';
  stage.tabIndex = 0;
  stage.setAttribute('role', 'group');
  stage.setAttribute('aria-label', '3D camera angle. Drag to rotate and tilt, scroll to zoom, or use the arrow keys.');
  stage.className = 'relative h-52 select-none overflow-hidden rounded-xl border border-white/10 bg-black/40 cursor-grab focus:outline-none focus-visible:border-primary/60';
  stage.style.perspective = '640px';
  stage.style.touchAction = 'none';

  // Orbit ring + camera marker (rotation shown as the marker's position around the ring).
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('viewBox', '0 0 100 100');
  ring.setAttribute('preserveAspectRatio', 'none');
  ring.setAttribute('aria-hidden', 'true');
  ring.setAttribute('class', 'pointer-events-none absolute inset-0 h-full w-full');
  ring.innerHTML = '<ellipse cx="50" cy="84" rx="42" ry="9" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.6" stroke-dasharray="2 2"/>';
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  marker.setAttribute('r', '2.6');
  marker.setAttribute('fill', '#22d3ee');
  ring.appendChild(marker);

  const scene = document.createElement('div');
  scene.className = 'absolute inset-0 flex items-center justify-center';
  scene.style.transformStyle = 'preserve-3d';
  const card = document.createElement('div');
  card.dataset.cameraCard = 'true';
  card.className = 'relative h-32 w-32 overflow-hidden rounded-lg border border-white/20 bg-gradient-to-br from-white/15 to-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5)]';
  card.style.transformStyle = 'preserve-3d';
  card.style.transition = 'transform 60ms linear';
  const img = document.createElement('img');
  img.alt = '';
  img.className = 'hidden h-full w-full object-cover';
  const placeholder = document.createElement('div');
  placeholder.className = 'flex h-full w-full items-center justify-center text-[11px] font-bold text-white/50';
  placeholder.textContent = 'Your photo';
  card.append(img, placeholder);
  scene.appendChild(card);

  const readout = document.createElement('div');
  readout.dataset.cameraReadout = 'true';
  readout.className = 'absolute top-1.5 left-0 right-0 text-center text-[10px] font-bold text-white/60 pointer-events-none';
  stage.append(scene, ring, readout);
  element.append(head, stage);

  const read = () => ({
    rotation: num(inputs.rotation?.value),
    tilt: num(inputs.tilt?.value),
    zoom: num(inputs.zoom?.value),
  });

  function render() {
    const v = read();
    card.style.transform = cameraTransform(v);
    const a = (clamp(v.rotation, CAMERA_LIMITS.rotation) * Math.PI) / 180;
    marker.setAttribute('cx', String(50 + Math.sin(a) * 42));
    // Camera straight in front (rotation 0) = nearest the viewer = bottom of the ring.
    marker.setAttribute('cy', String(84 + Math.cos(a) * 9));
    readout.textContent = `Rotation ${v.rotation}° · Tilt ${v.tilt}° · Zoom ${v.zoom}`;
  }

  /** Write a value to the matching slider and let everything else react through its input event. */
  function set(key, value) {
    const input = inputs[key];
    if (!input) return;
    const lo = num(input.min, CAMERA_LIMITS[key][0]);
    const hi = num(input.max, CAMERA_LIMITS[key][1]);
    input.value = String(Math.round(Math.min(hi, Math.max(lo, value))));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function resetAll() {
    KEYS.forEach((key) => set(key, num(inputs[key]?.dataset.default, 0)));
  }
  reset.onclick = resetAll;

  // ── Pointer: drag = rotation + tilt, two fingers = zoom ────────────────
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  const size = () => {
    const r = stage.getBoundingClientRect();
    return { w: r.width || 240, h: r.height || 208 };
  };

  stage.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId ?? 0, { x: e.clientX, y: e.clientY });
    try { stage.setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
    stage.style.cursor = 'grabbing';
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, ...read() };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: read().zoom };
      drag = null;
    }
  });

  stage.addEventListener('pointermove', (e) => {
    const id = e.pointerId ?? 0;
    if (!pointers.has(id)) return;
    pointers.set(id, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const ratio = (Math.hypot(a.x - b.x, a.y - b.y) || 1) / pinch.d;
      set('zoom', pinch.zoom + (ratio - 1) * 100);
      return;
    }
    if (!drag) return;
    const { w, h } = size();
    // A drag across the whole stage is about 270 degrees of rotation / 135 of tilt.
    set('rotation', drag.rotation + ((e.clientX - drag.x) / w) * 270);
    set('tilt', drag.tilt - ((e.clientY - drag.y) / h) * 135);
  });

  const end = (e) => {
    pointers.delete(e.pointerId ?? 0);
    if (pointers.size === 0) { drag = null; pinch = null; stage.style.cursor = ''; }
    else if (pointers.size === 1) { pinch = null; const [p] = [...pointers.values()]; drag = { x: p.x, y: p.y, ...read() }; }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    set('zoom', read().zoom + (e.deltaY < 0 ? 10 : -10));
  }, { passive: false });

  stage.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 15 : 5;
    const v = read();
    let handled = true;
    if (e.key === 'ArrowLeft') set('rotation', v.rotation - step);
    else if (e.key === 'ArrowRight') set('rotation', v.rotation + step);
    else if (e.key === 'ArrowUp') set('tilt', v.tilt + step);
    else if (e.key === 'ArrowDown') set('tilt', v.tilt - step);
    else if (e.key === '+' || e.key === '=') set('zoom', v.zoom + step * 2);
    else if (e.key === '-' || e.key === '_') set('zoom', v.zoom - step * 2);
    else if (e.key === 'Home' || e.key === '0') resetAll();
    else handled = false;
    if (handled) e.preventDefault();
  });

  return {
    element,
    /** Connect to the slider inputs inside `container` (call after the sliders are rendered). */
    bind(container) {
      inputs = {};
      KEYS.forEach((key) => {
        const input = container.querySelector(`input[data-control-key="adj_${key}"]`);
        if (!input) return;
        inputs[key] = input;
        input.addEventListener('input', render);
      });
      render();
    },
    /** Show the user's photo on the card (null shows the placeholder). */
    setImage(url) {
      if (url) { img.src = url; img.classList.remove('hidden'); placeholder.classList.add('hidden'); }
      else { img.removeAttribute('src'); img.classList.add('hidden'); placeholder.classList.remove('hidden'); }
    },
    render,
    reset: resetAll,
  };
}
