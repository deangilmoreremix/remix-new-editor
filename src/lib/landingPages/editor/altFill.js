// Fills a picture's "screen-reader description" (alt text) when a picture is chosen and the description is still empty.
// A field can't see its neighbours, so the choosers remember a label per URL here and each component's resolveData reads it.
const labels = new Map();
const MAX = 200;

/** Called where a picture is chosen (studio tray, library, AI picture): its prompt or title becomes the alt text. */
export function rememberPictureLabel(url, label) {
  const text = String(label || '').replace(/\s+/g, ' ').trim().slice(0, 125);
  if (!url || !text) return;
  if (labels.size >= MAX) labels.delete(labels.keys().next().value);
  labels.set(String(url), text);
}
export const pictureLabel = (url) => labels.get(String(url || '')) || '';

// picture prop -> alt prop (same component or same array item)
const PAIRS = [['logo', 'logoAlt'], ['senderPhoto', 'senderPhotoAlt'], ['avatar', 'avatarAlt'], ['image', 'alt'], ['src', 'alt']];

/** Pure: props with empty alt filled for pictures that have a remembered label. */
export function fillAlts(props) {
  if (!props || typeof props !== 'object') return props;
  let out = props;
  const set = (k, v) => { if (out === props) out = { ...props }; out[k] = v; };
  for (const [pic, alt] of PAIRS) {
    if (typeof props[pic] === 'string' && props[pic] && !String(props[alt] || '').trim() && pictureLabel(props[pic])) set(alt, pictureLabel(props[pic]));
  }
  for (const [k, v] of Object.entries(props)) {
    if (!Array.isArray(v)) continue;
    const next = v.map((it) => (it && typeof it === 'object' ? fillAlts(it) : it));
    if (next.some((it, i) => it !== v[i])) set(k, next);
  }
  return out;
}

/** Every component fills its empty alt texts as pictures are chosen (never overwrites one you typed). */
export function withAltFill(components) {
  for (const comp of Object.values(components)) {
    const prev = comp.resolveData;
    comp.resolveData = async (data, params) => {
      const base = prev ? await prev(data, params) : data;
      const src = base?.props ? base : data;
      const props = fillAlts(src.props);
      return props === src.props ? base : { ...src, props };
    };
  }
}
