function hslToHex(h, s, l) {
  const sat = Math.max(0, Math.min(1, s));
  const lig = Math.max(0, Math.min(1, l));
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

/** Normalise #rgb, #rrggbb, rgb()/rgba() and hsl()/hsla() (comma or space syntax) to #rrggbb. */
export function toHex(c) {
  if (typeof c !== 'string') return null;
  c = c.trim();
  if (c.startsWith('#')) {
    const v = c.toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    if (/^#[0-9a-f]{3}$/.test(v)) return '#' + v.slice(1).split('').map((x) => x + x).join('');
    // #rrggbbaa / #rgba: drop the alpha channel
    if (/^#[0-9a-f]{8}$/.test(v)) return v.slice(0, 7);
    if (/^#[0-9a-f]{4}$/.test(v)) return '#' + v.slice(1, 4).split('').map((x) => x + x).join('');
    return null;
  }
  const hsl = c.match(/^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
  if (hsl) {
    const h = ((parseFloat(hsl[1]) % 360) + 360) % 360;
    return hslToHex(h, parseFloat(hsl[2]) / 100, parseFloat(hsl[3]) / 100);
  }
  const m = c.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (!m) return null;
  const r = +m[1];
  const g = +m[2];
  const b = +m[3];
  return '#' + [r, g, b].map((n) => Math.min(255, n).toString(16).padStart(2, '0')).join('');
}

function rgbToHex(c) {
  return toHex(c);
}

export function pickPalette(rawColors) {
  const counts = new Map();
  for (const raw of rawColors) {
    const hex = rgbToHex(raw);
    if (!hex) continue;
    if (hex === '#ffffff' || hex === '#000000') continue;
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  return { primary: sorted.slice(0, 3), secondary: sorted.slice(3, 8) };
}
