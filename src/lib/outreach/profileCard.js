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
export const cardKey = (d) => JSON.stringify([d.name, d.title, d.company, d.linkedin, d.website]);

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
export function drawProfileCard(ctx, d, { logo = null, accent = '#d9ff00', width = CARD_W, height = CARD_H } = {}) {
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, '#0f172a'); g.addColorStop(1, '#1e293b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
  // Banner strip and card.
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 0, width, height * 0.3);
  // The camera bubble sits bottom-left in the video (multiCam pip, corner bottom-left): the card takes the right side.
  const x = width * 0.38; const y = height * 0.14; const w = width * 0.56; const h = height * 0.66;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 28) : ctx.rect(x, y, w, h); ctx.fill();
  // Avatar: their logo, else initials.
  const r = height * 0.11; const cx = x + 48 + r; const cy = y + 48 + r;
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
    ctx.fillStyle = '#0b0c10';
    ctx.font = `800 ${Math.round(r * 0.9)}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials(d.name), cx, cy + 2);
  }
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const tx = x + 48; const maxW = w - 96;
  let ty = cy + r + 70;
  ctx.fillStyle = '#0b0c10';
  fitText(ctx, d.name, maxW, 52);
  ctx.fillText(d.name, tx, ty);
  ty += 46;
  const line = [d.title, d.company].filter(Boolean).join(' · ');
  if (line) { ctx.fillStyle = '#334155'; fitText(ctx, line, maxW, 28, 600); ctx.fillText(line, tx, ty); ty += 40; }
  const sub = d.linkedin || d.website;
  if (sub) { ctx.fillStyle = '#64748b'; fitText(ctx, sub, maxW, 22, 500); ctx.fillText(sub, tx, ty); }
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
export async function renderProfileCard(details, { logoUrl = '', accent } = {}) {
  const c = Object.assign(document.createElement('canvas'), { width: CARD_W, height: CARD_H });
  drawProfileCard(c.getContext('2d'), details, { logo: await loadImage(logoUrl), accent });
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the profile card.'))), 'image/jpeg', 0.9));
}
