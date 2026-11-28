// src/lib/outreach/profileCard.js
//
// "Profile card" background (Video Outreach → AI intro → Video background): a picture of the prospect's
// own details — name, job title, company, their logo or initials, and their LinkedIn address — drawn
// in the browser behind your camera bubble. Sendspark shows a prospect's LinkedIn page there; LinkedIn
// profiles can't be captured (they need a login and LinkedIn's terms forbid scraping), so this is our
// own card, with no LinkedIn branding.

export const CARD_W = 1280;
export const CARD_H = 720;

const clean = (s, n = 80) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** The details shown (and the cache key: a card is redrawn only when these change). */
export function cardDetails(c = {}, fallbacks = {}) {
  const name = clean([c.firstName, c.lastName].filter(Boolean).join(' ')) || clean(fallbacks.firstname) || 'There';
  const linkedin = clean(String(c.linkedin || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''), 60);
  return { name, title: clean(c.jobTitle), company: clean(c.company) || clean(fallbacks.company), linkedin, website: clean(String(c.website || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/.*$/, ''), 40) };
}
/** Named looks for the card. `classic` is the original (and the default, so existing cards keep their cache key). */
export const CARD_THEMES = Object.freeze({
  classic: { label: 'Classic', bg: ['#0f172a', '#1e293b'], banner: 'rgba(255,255,255,0.04)', card: '#ffffff', name: '#0b0c10', line: '#334155', sub: '#64748b', avatarText: '#0b0c10', accent: null },
  midnight: { label: 'Midnight', bg: ['#020617', '#0f172a'], banner: 'rgba(255,255,255,0.03)', card: '#111827', name: '#f8fafc', line: '#cbd5e1', sub: '#94a3b8', avatarText: '#0b0c10', accent: null },
  soft: { label: 'Soft', bg: ['#e2e8f0', '#f1f5f9'], banner: 'rgba(15,23,42,0.05)', card: '#ffffff', name: '#111827', line: '#475569', sub: '#64748b', avatarText: '#111827', accent: '#38bdf8' },
  brand: { label: 'Brand colour', bg: ['#0b0c10', '#14161c'], banner: 'rgba(217,255,0,0.08)', card: '#fefce8', name: '#111827', line: '#3f3f46', sub: '#71717a', avatarText: '#0b0c10', accent: null },
});
export const cardThemeId = (id) => (Object.prototype.hasOwnProperty.call(CARD_THEMES, id) ? id : 'classic');
export const cardKey = (d, side = 'right', theme = 'classic') => JSON.stringify([d.name, d.title, d.company, d.linkedin, d.website, ...(side === 'right' && cardThemeId(theme) === 'classic' ? [] : [side]), ...(cardThemeId(theme) === 'classic' ? [] : [cardThemeId(theme)])]);

/** Where the card goes so the camera bubble never covers it: the other side, or the top for a Spotlight bubble. */
export function cardSideFor(bubble = {}) {
  if (bubble.mode === 'spotlight') return 'top';
  return String(bubble.corner || 'bottom-left').endsWith('right') ? 'left' : 'right';
}

export function initials(name) {
  const parts = clean(name).split(' ').filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function fitText(ctx, text, max, size, weight = 800) {
  let s = size;
  ctx.font = `${weight} ${s}px Inter, Arial, sans-serif`;
  while (s > 18 && ctx.measureText(text).width > max) { s -= 2; ctx.font = `${weight} ${s}px Inter, Arial, sans-serif`; }
  return s;
}

/**
 * Draw the card. `logo` is an image (their company logo) or null (initials instead). The card sits on the
 * right; the bottom-left stays clear for the camera bubble. Pure canvas calls (testable with a fake context).
 */
export function drawProfileCard(ctx, d, { logo = null, accent: accentIn, width = CARD_W, height = CARD_H, side = 'right', theme = 'classic' } = {}) {
  const T = CARD_THEMES[cardThemeId(theme)];
  const accent = accentIn || T.accent || '#d9ff00';
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, T.bg[0]); g.addColorStop(1, T.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
  // Banner strip and card.
  ctx.fillStyle = T.banner; ctx.fillRect(0, 0, width, height * 0.3);
  // The camera bubble sits bottom-left in the video (multiCam pip, corner bottom-left): the card takes the right side.
  const box = { right: [0.38, 0.14, 0.56, 0.66], left: [0.06, 0.14, 0.56, 0.66], top: [0.2, 0.05, 0.6, 0.5] }[side] || [0.38, 0.14, 0.56, 0.66];
  const x = width * box[0]; const y = height * box[1]; const w = width * box[2]; const h = height * box[3];
  ctx.fillStyle = T.card;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 28) : ctx.rect(x, y, w, h); ctx.fill();
  // Avatar: their logo, else initials.
  const r = height * (side === 'top' ? 0.075 : 0.11); const cx = x + 48 + r; const cy = y + 48 + r;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = accent; ctx.fill();
  if (logo) {
    ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const iw = logo.naturalWidth || logo.width || 1; const ih = logo.naturalHeight || logo.height || 1;
    const s = Math.min((r * 1.5) / iw, (r * 1.5) / ih);
    ctx.drawImage(logo, cx - (iw * s) / 2, cy - (ih * s) / 2, iw * s, ih * s);
  } else {
    ctx.fillStyle = T.avatarText;
    ctx.font = `800 ${Math.round(r * 0.9)}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials(d.name), cx, cy + 2);
  }
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const tx = x + 48; const maxW = w - 96;
  let ty = cy + r + (side === 'top' ? 56 : 70);
  ctx.fillStyle = T.name;
  fitText(ctx, d.name, maxW, 52);
  ctx.fillText(d.name, tx, ty);
  ty += 46;
  const line = [d.title, d.company].filter(Boolean).join(' · ');
  if (line) { ctx.fillStyle = T.line; fitText(ctx, line, maxW, 28, 600); ctx.fillText(line, tx, ty); ty += 40; }
  const sub = d.linkedin || d.website;
  if (sub) { ctx.fillStyle = T.sub; fitText(ctx, sub, maxW, 22, 500); ctx.fillText(sub, tx, ty); }
}

const loadImage = (src) => new Promise((resolve) => {
  if (!src) { resolve(null); return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

/** The card as a JPEG Blob (1280×720). */
export async function renderProfileCard(details, { logoUrl = '', accent, side = 'right', theme = 'classic' } = {}) {
  const c = Object.assign(document.createElement('canvas'), { width: CARD_W, height: CARD_H });
  drawProfileCard(c.getContext('2d'), details, { logo: await loadImage(logoUrl), accent, side, theme });
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the profile card.'))), 'image/jpeg', 0.9));
}
