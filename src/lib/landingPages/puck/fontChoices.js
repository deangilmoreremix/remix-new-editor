/**
 * Fonts offered in the page editor (Page panel → Heading font / Body font). All are free open-licence families
 * served from this app (see styles/puck/00-fonts.css), never from a third-party host. The page stores only the
 * `value` key; the CSS family strings live here, so a saved page can never inject CSS.
 */
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const ENTRIES = [
  ['inter', 'Inter', '"Inter Variable"', SANS],
  ['plus-jakarta', 'Plus Jakarta Sans', '"Plus Jakarta Sans Variable"', SANS],
  ['manrope', 'Manrope', '"Manrope Variable"', SANS],
  ['dm-sans', 'DM Sans', '"DM Sans Variable"', SANS],
  ['montserrat', 'Montserrat', '"Montserrat Variable"', SANS],
  ['poppins', 'Poppins', '"Poppins"', SANS],
  ['sora', 'Sora', '"Sora"', SANS],
  ['outfit', 'Outfit', '"Outfit Variable"', SANS],
  ['lexend', 'Lexend', '"Lexend Variable"', SANS],
  ['figtree', 'Figtree', '"Figtree Variable"', SANS],
  ['onest', 'Onest', '"Onest Variable"', SANS],
  ['work-sans', 'Work Sans', '"Work Sans Variable"', SANS],
  ['be-vietnam', 'Be Vietnam Pro', '"Be Vietnam Pro"', SANS],
  ['space-grotesk', 'Space Grotesk', '"Space Grotesk Variable"', SANS],
  ['nunito', 'Nunito', '"Nunito Variable"', SANS],
  ['fredoka', 'Fredoka (rounded)', '"Fredoka Variable"', SANS],
  ['baloo', 'Baloo 2 (rounded)', '"Baloo 2"', SANS],
  ['playfair', 'Playfair Display (serif)', '"Playfair Display Variable"', SERIF],
  ['cormorant', 'Cormorant Garamond (serif)', '"Cormorant Garamond"', SERIF],
  ['lora', 'Lora (serif)', '"Lora Variable"', SERIF],
  ['newsreader', 'Newsreader (serif)', '"Newsreader Variable"', SERIF],
  ['fraunces', 'Fraunces (serif)', '"Fraunces Variable"', SERIF],
  ['dm-serif', 'DM Serif Display (serif)', '"DM Serif Display"', SERIF],
  ['anton', 'Anton (poster)', '"Anton"', SANS],
  ['archivo-black', 'Archivo Black (heavy)', '"Archivo Black"', SANS],
  ['bebas', 'Bebas Neue (caps)', '"Bebas Neue"', SANS],
  ['caveat', 'Caveat (handwriting)', '"Caveat Variable"', 'cursive'],
  ['patrick', 'Patrick Hand (handwriting)', '"Patrick Hand"', 'cursive'],
];

export const FONT_OPTIONS = Object.freeze([{ label: 'Design default', value: '' }, ...ENTRIES.map(([value, label]) => ({ label, value }))]);
export const FONT_CSS = Object.freeze(Object.fromEntries(ENTRIES.map(([value, , family, fallback]) => [value, `${family}, ${fallback}`])));

/** CSS font stack for a stored choice, or '' (keep the design's own font) for anything unknown. */
export const fontStack = (value) => (typeof value === 'string' && Object.prototype.hasOwnProperty.call(FONT_CSS, value) ? FONT_CSS[value] : '');
