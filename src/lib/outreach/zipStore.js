// src/lib/outreach/zipStore.js
//
// A tiny ZIP writer (stored, no compression) so share packs can be downloaded as one file with no extra
// dependency or licence to carry. Plain ZIP 2.0 with UTF-8 names; opens in every unzip tool.
//   createZip([{ name, data: string | Uint8Array }]) -> Uint8Array

const enc = new TextEncoder();
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) c = TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** A file name safe on every system: no paths, no control or reserved characters, never empty. */
export function safeFileName(name, fallback = 'file') {
  const cleaned = String(name ?? '')
    .normalize('NFKC')
    .replace(/\p{C}/gu, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/^[.\s-]+|[.\s]+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
const dosDate = (d) => (((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;

/** Make names unique inside the zip ("a.csv", "a (2).csv"). */
function uniqueNames(files) {
  const seen = new Map();
  return files.map((f) => {
    const base = safeFileName(f.name);
    const n = (seen.get(base.toLowerCase()) || 0) + 1;
    seen.set(base.toLowerCase(), n);
    if (n === 1) return base;
    const dot = base.lastIndexOf('.');
    return dot > 0 ? `${base.slice(0, dot)} (${n})${base.slice(dot)}` : `${base} (${n})`;
  });
}

export function createZip(files, { now = new Date() } = {}) {
  const list = Array.isArray(files) ? files : [];
  const names = uniqueNames(list);
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (v) => new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF]);
  const u32 = (v) => new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]);
  const push = (...parts) => { for (const p of parts) { chunks.push(p); offset += p.length; } };
  const time = dosTime(now); const date = dosDate(now);
  list.forEach((f, i) => {
    const nameBytes = enc.encode(names[i]);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data || 0);
    const crc = crc32(data);
    const start = offset;
    // local header
    push(u32(0x04034B50), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data);
    central.push([u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(start), nameBytes]);
  });
  const cdStart = offset;
  for (const parts of central) push(...parts);
  const cdSize = offset - cdStart;
  push(u32(0x06054B50), u16(0), u16(0), u16(list.length), u16(list.length), u32(cdSize), u32(cdStart), u16(0));
  const out = new Uint8Array(offset);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
