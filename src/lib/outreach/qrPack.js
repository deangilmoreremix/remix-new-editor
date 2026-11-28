// src/lib/outreach/qrPack.js
//
// Per-prospect QR codes and share packs (requirements 30 and 36). Everything runs in the browser with the
// `qrcode` package (MIT). A QR is only made for a real https link; the picture contains the link and nothing else.
import QRCode from 'qrcode';
import { csvCell } from './email.js';
import { createZip, safeFileName } from './zipStore.js';

/** The link to encode, or throws. Only https links to a real host are accepted, with no credentials in them. */
export function qrTarget(link) {
  let u;
  try { u = new URL(String(link || '').trim()); } catch { throw new Error('That is not a web link.'); }
  if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.username || u.password) throw new Error('A QR code needs a secure (https) link.');
  return u.toString();
}

const OPTS = { errorCorrectionLevel: 'M', margin: 2 };

/** The QR as an SVG string (resizable, prints sharply). */
export async function qrSvg(link, { margin = OPTS.margin } = {}) {
  return QRCode.toString(qrTarget(link), { type: 'svg', errorCorrectionLevel: OPTS.errorCorrectionLevel, margin });
}

/** The QR's dark/light modules as a square boolean matrix, for drawing it yourself. */
export function qrMatrix(link) {
  const q = QRCode.create(qrTarget(link), { errorCorrectionLevel: OPTS.errorCorrectionLevel });
  const n = q.modules.size;
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => !!q.modules.data[y * n + x]));
}

/** The picture's real side length for `size`: whole pixels per module, so edges stay sharp. */
export const qrPixels = (modules, size, quiet = 2) => Math.floor(size / (modules + quiet * 2)) * (modules + quiet * 2);

/** Paint a matrix on a 2D canvas context: white square, black modules, a quiet zone around them. */
export function drawQr(ctx, matrix, size, { quiet = 2 } = {}) {
  const n = matrix.length;
  const cell = Math.floor(size / (n + quiet * 2));
  const total = qrPixels(n, size, quiet);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, total, total);
  ctx.fillStyle = '#000000';
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) if (matrix[y][x]) ctx.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
  return total;
}

/** The QR as a PNG Blob (needs a canvas, so browsers only). Resolves null where canvas is not available. */
export async function qrPngBlob(link, { size = 512, doc = globalThis.document } = {}) {
  const matrix = qrMatrix(link);
  if (!doc?.createElement) return null;
  const canvas = doc.createElement('canvas');
  const px = qrPixels(matrix.length, size);
  canvas.width = px; canvas.height = px;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;
  drawQr(ctx, matrix, size);
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
}

/** Open or download a Blob as a file name. */
export function downloadBlob(blob, name, doc = globalThis.document) {
  const a = doc.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = safeFileName(name, 'download');
  doc.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const who = (r) => safeFileName([r.contact?.firstName, r.contact?.lastName].filter(Boolean).join('-') || r.contact?.company || r.contact?.email || 'prospect', 'prospect');

/**
 * Everything to send one prospect, as files for a zip:
 *   links.csv (all prospects), emails.txt (every email ready to paste), and per prospect a QR as SVG (and PNG when possible).
 * @param {{ contact:object, link:string, subject?:string, text?:string, thumbnailUrl?:string }[]} rows  one per prospect
 * @param {{ png?: (link:string)=>Promise<Blob|null> }} [deps]
 * @returns {Promise<{ files:{name:string,data:string|Uint8Array}[], skipped:{name:string, reason:string}[] }>}
 */
export async function buildSharePack(rows, { png = (l) => qrPngBlob(l) } = {}) {
  const files = [];
  const skipped = [];
  const head = ['First name', 'Last name', 'Email', 'Company', 'Link', 'Thumbnail', 'QR file'];
  const lines = [head.join(',')];
  const emails = [];
  const used = new Map();
  // The same name twice must still give two different files, and the CSV must name the right one.
  const uniqueBase = (r) => {
    const b = who(r);
    const n = (used.get(b.toLowerCase()) || 0) + 1;
    used.set(b.toLowerCase(), n);
    return n === 1 ? b : `${b} (${n})`;
  };
  for (const r of rows || []) {
    const base = uniqueBase(r);
    let qrFile = '';
    try {
      const svg = await qrSvg(r.link);
      qrFile = `${base}-qr.svg`;
      files.push({ name: qrFile, data: svg });
      try {
        const blob = await png(r.link);
        if (blob) files.push({ name: `${base}-qr.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      } catch { /* the SVG is enough */ }
    } catch (err) { skipped.push({ name: base, reason: err?.message || 'No QR code.' }); }
    lines.push([r.contact?.firstName, r.contact?.lastName, r.contact?.email, r.contact?.company, r.link, r.thumbnailUrl, qrFile].map(csvCell).join(','));
    emails.push(`To: ${r.contact?.email || ''}\nSubject: ${r.subject || ''}\n\n${r.text || r.link || ''}\n`);
  }
  files.unshift({ name: 'links.csv', data: `${lines.join('\r\n')}\r\n` }, { name: 'emails.txt', data: emails.join('\n----------------------------------------\n\n') });
  return { files, skipped };
}

/** The pack as one zip. */
export async function buildSharePackZip(rows, deps) {
  const { files, skipped } = await buildSharePack(rows, deps);
  return { zip: createZip(files), skipped, count: files.length };
}
