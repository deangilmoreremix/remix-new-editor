// What the page looks like right now (accent, background, text colour, dark or light), read from its root settings.
// The AI buttons use it so words and pictures suit the design they are going into.
const HEX6 = /^#[0-9a-f]{6}$/i;
const channel = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (h) => { const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(h.slice(i, i + 2), 16))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ok = (v, d) => (HEX6.test(String(v || '')) ? String(v).toLowerCase() : d);

/** @param {object} root the page data's root, either { props } or the props themselves */
export function pageStyleHint(root = {}) {
  const p = root && typeof root === 'object' && root.props && typeof root.props === 'object' ? root.props : root || {};
  const background = ok(p.background, '#ffffff');
  const text = ok(p.text, '#0f172a');
  const accent = ok(p.accent, '#2563eb');
  return { accent, background, text, dark: luminance(background) < 0.3, design: String(p.design || 'clean').replace(/[^a-z0-9-]/gi, '') };
}

/** A short plain-English description for a prompt. */
export function describeStyle(h) {
  if (!h) return '';
  return `${h.dark ? 'dark' : 'light'} page (background ${h.background}, text ${h.text}) with accent colour ${h.accent}`;
}
