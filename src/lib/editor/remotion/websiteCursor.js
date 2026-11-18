// A pointer moving over a scrolling website background (Video Outreach): it glides between
// spots on the page as if someone were pointing things out, with a soft click ring when it
// stops. Deterministic (seeded by the clip id), so preview, export and every viewer match.
// It keeps clear of the bottom-left corner, where the camera bubble sits.

const HOLD = 2.4; // seconds per move (glide + pause)

const rand = (seed) => {
  let x = 0;
  for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
};

/** The spots the pointer visits, in 0..1 frame coordinates. */
export function cursorStops(seed, count = 24) {
  const r = rand(seed || 'cursor');
  return Array.from({ length: count }, () => [0.38 + r() * 0.52, 0.14 + r() * 0.58]);
}

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2);

/** Where the pointer is at `sec` seconds into the clip: { x, y, click } (click 0..1 just after arriving). */
export function cursorAt(sec, stops) {
  const t = Math.max(0, sec);
  const i = Math.floor(t / HOLD);
  const p = (t - i * HOLD) / HOLD;
  const a = stops[i % stops.length];
  const b = stops[(i + 1) % stops.length];
  const glide = Math.min(1, p / 0.55);
  const k = ease(glide);
  const click = p > 0.55 && p < 0.8 ? 1 - (p - 0.55) / 0.25 : 0;
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, click };
}
