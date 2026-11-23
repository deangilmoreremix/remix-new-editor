/**
 * The 16 caption fonts of Capite plus the 6 other picker fonts, embedded (Latin subset, woff2) so a caption renders and exports with no font request: the data lives in
 * lazily imported modules (./data/*.js, one per family) and is registered through a data-URI @font-face under the alias "Capite <name>",
 * which can never clash with a same-named font on the host page. IBM Plex Sans is the fallback behind each of them.
 */
export const EMBEDDED_FONTS = Object.freeze([
  { name: 'Anton', load: () => import('./data/anton.js') },
  { name: 'Bangers', load: () => import('./data/bangers.js') },
  { name: 'Bebas Neue', load: () => import('./data/bebas-neue.js') },
  { name: 'Cinzel', load: () => import('./data/cinzel.js') },
  { name: 'Inter', load: () => import('./data/inter.js') },
  { name: 'JetBrains Mono', load: () => import('./data/jetbrains-mono.js') },
  { name: 'Montserrat', load: () => import('./data/montserrat.js') },
  { name: 'Orbitron', load: () => import('./data/orbitron.js') },
  { name: 'Outfit', load: () => import('./data/outfit.js') },
  { name: 'Permanent Marker', load: () => import('./data/permanent-marker.js') },
  { name: 'Playfair Display', load: () => import('./data/playfair-display.js') },
  { name: 'Plus Jakarta Sans', load: () => import('./data/plus-jakarta-sans.js') },
  { name: 'Poppins', load: () => import('./data/poppins.js') },
  { name: 'Rubik', load: () => import('./data/rubik.js') },
  { name: 'Space Grotesk', load: () => import('./data/space-grotesk.js') },
  { name: 'Syne', load: () => import('./data/syne.js') },
  { name: 'Roboto', load: () => import('./data/roboto.js') },
  { name: 'Open Sans', load: () => import('./data/open-sans.js') },
  { name: 'Lato', load: () => import('./data/lato.js') },
  { name: 'Oswald', load: () => import('./data/oswald.js') },
  { name: 'Archivo Black', load: () => import('./data/archivo-black.js') },
  { name: 'Sora', load: () => import('./data/sora.js') },
].map((f) => Object.freeze(f)));
export const FALLBACK_FONT = Object.freeze({ name: 'IBM Plex Sans', load: () => import('./data/ibm-plex-sans.js') });

/** Weight names the Studio offers → CSS weight. */
export const WEIGHTS = Object.freeze({ light: 300, regular: 400, medium: 500, bold: 700, 'extra-bold': 800 });

/** The weight to draw: the chosen one, else the look's own (bold → 800, otherwise 500). */
export const resolveWeight = (style = {}) => (Object.prototype.hasOwnProperty.call(WEIGHTS, style.weight) ? WEIGHTS[style.weight] : style.bold ? 800 : 500);

const byName = new Map([...EMBEDDED_FONTS, FALLBACK_FONT].map((f) => [f.name.toLowerCase(), f]));
/** The embedded font of a family name (any letter case), or undefined. */
export const embeddedFont = (name) => (typeof name === 'string' ? byName.get(name.trim().toLowerCase()) : undefined);

/** The family name a font is drawn with: "Capite <name>" for an embedded font, its own name otherwise. */
export const fontAlias = (name) => { const f = embeddedFont(name); return f ? `Capite ${f.name}` : String(name); };
/** A CSS family list: the font, then (for an embedded one) IBM Plex Sans, then `tail`. */
export const fontStack = (name, tail) => {
  const f = embeddedFont(name);
  if (!f) return `"${name}", ${tail}`;
  const alias = `"Capite ${f.name}"`;
  return f === FALLBACK_FONT ? `${alias}, ${tail}` : `${alias}, "Capite ${FALLBACK_FONT.name}", ${tail}`;
};

const ready = new Map(); // font name → Promise<boolean>: its @font-face is in the page
function register(font) {
  if (ready.has(font.name) && !document.head.querySelector(`style[data-caption-font="${font.name}"]`)) ready.delete(font.name); // removed from the page (route change, tests): register it again
  if (!ready.has(font.name)) {
    ready.set(font.name, font.load().then(({ faces }) => {
      const css = faces.map((f) => `@font-face{font-family:"Capite ${font.name}";font-style:${f.style};font-weight:${f.weight};font-display:block;src:url(data:font/woff2;base64,${f.data}) format("woff2")}`).join('');
      const el = document.createElement('style');
      el.setAttribute('data-caption-font', font.name);
      el.textContent = css;
      document.head.appendChild(el);
      return true;
    }).catch(() => { ready.delete(font.name); return false; }));
  }
  return ready.get(font.name);
}

/**
 * Make an embedded font drawable on a canvas. Resolves true when the browser has it, false for a font that is not embedded or fails to load.
 * @param {string} name
 * @param {{ weight?: number|string, italic?: boolean, text?: string }} [opts]
 */
export async function loadEmbeddedFont(name, { weight = 500, italic = false, text = '' } = {}) {
  const font = embeddedFont(name);
  if (!font || typeof document === 'undefined' || !document.fonts) return false;
  try {
    if (font !== FALLBACK_FONT) {
      await register(FALLBACK_FONT);
      await document.fonts.load(`${weight} 16px "Capite ${FALLBACK_FONT.name}"`, text);
    }
    if (!(await register(font))) return false;
    await document.fonts.load(`${italic ? 'italic ' : ''}${weight} 16px "Capite ${font.name}"`, text);
    return true;
  } catch { return false; }
}
