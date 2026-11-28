// Chrome's MediaRecorder writes WebM files with no Duration in their header. Players then show no
// length and cannot seek a downloaded take, and some editors refuse the file. This writes the
// Duration into the header's Segment > Info element. Only the first few kilobytes change; the rest
// of the file is reused as is.
//
// Files we cannot patch safely are left alone (returned unchanged): not WebM, an Info element we
// cannot find near the start, or a SeekHead/Cues index whose byte offsets an insertion would break
// (MediaRecorder writes neither).

const HEAD_BYTES = 64 * 1024;
const ID = {
  EBML: 0x1a45dfa3, SEGMENT: 0x18538067, INFO: 0x1549a966, SEEKHEAD: 0x114d9b74, CUES: 0x1c53bb6b,
  CLUSTER: 0x1f43b675, TIMECODE_SCALE: 0x2ad7b1, DURATION: 0x4489,
};

// EBML variable-length integer at `pos`: { len, value } (value without the length marker).
function readVint(bytes, pos) {
  const first = bytes[pos];
  if (first === undefined || first === 0) return null;
  let len = 1;
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
  if (len > 8 || pos + len > bytes.length) return null;
  let value = first & (0xff >> len);
  let allOnes = value === (0xff >> len);
  for (let i = 1; i < len; i++) {
    value = value * 256 + bytes[pos + i];
    if (bytes[pos + i] !== 0xff) allOnes = false;
  }
  return { len, value, unknown: allOnes };
}

// Element ID at `pos` (marker bits kept, as IDs are written).
function readId(bytes, pos) {
  const v = readVint(bytes, pos);
  if (!v) return null;
  let id = 0;
  for (let i = 0; i < v.len; i++) id = id * 256 + bytes[pos + i];
  return { len: v.len, id };
}

function readElement(bytes, pos) {
  const id = readId(bytes, pos);
  if (!id) return null;
  const size = readVint(bytes, pos + id.len);
  if (!size) return null;
  const dataStart = pos + id.len + size.len;
  return { id: id.id, start: pos, sizePos: pos + id.len, sizeLen: size.len, size: size.value, unknown: size.unknown, dataStart, end: size.unknown ? Infinity : dataStart + size.value };
}

function writeSizeVint(value, len) {
  const out = new Uint8Array(len);
  let v = value;
  for (let i = len - 1; i >= 0; i--) { out[i] = v % 256; v = Math.floor(v / 256); }
  out[0] |= 0x80 >> (len - 1);
  return out;
}

function sizeFits(value, len) { return value < 2 ** (7 * len) - 1; }

function uintAt(bytes, start, len) { let v = 0; for (let i = 0; i < len; i++) v = v * 256 + bytes[start + i]; return v; }

/**
 * Header bytes with the Duration set, or null when the file cannot be patched safely.
 * @param {Uint8Array} head   the start of the file (Info must lie fully inside it)
 * @param {number} durationMs
 * @returns {{ bytes: Uint8Array, replaced: number } | null}  new header bytes, and how many bytes of `head` they replace
 */
export function patchWebmHead(head, durationMs) {
  if (!(durationMs > 0) || !Number.isFinite(durationMs)) return null;
  const ebml = readElement(head, 0);
  if (!ebml || ebml.id !== ID.EBML || ebml.unknown) return null;
  const seg = readElement(head, ebml.end);
  if (!seg || seg.id !== ID.SEGMENT) return null;

  // Walk Segment's children up to the first Cluster: find Info, refuse byte-offset indexes.
  let pos = seg.dataStart;
  let info = null;
  while (pos < head.length) {
    const el = readElement(head, pos);
    if (!el) return null;
    if (el.id === ID.SEEKHEAD || el.id === ID.CUES) return null;
    if (el.id === ID.CLUSTER) break;
    if (el.id === ID.INFO) { info = el; break; }
    if (el.unknown || el.end > head.length) return null;
    pos = el.end;
  }
  if (!info || info.unknown || info.end > head.length) return null;
  // A SeekHead after Info would also hold offsets; check the rest of the header up to the first Cluster.
  for (let p = info.end; p < head.length;) {
    const el = readElement(head, p);
    if (!el || el.id === ID.CLUSTER) break;
    if (el.id === ID.SEEKHEAD || el.id === ID.CUES) return null;
    if (el.unknown) break;
    p = el.end;
  }

  // Duration is in TimecodeScale units (default 1,000,000 ns = 1 ms).
  let scale = 1e6;
  let existing = null;
  for (let p = info.dataStart; p < info.end;) {
    const el = readElement(head, p);
    if (!el || el.end > info.end) return null;
    if (el.id === ID.TIMECODE_SCALE) scale = uintAt(head, el.dataStart, el.size) || 1e6;
    if (el.id === ID.DURATION) existing = el;
    p = el.end;
  }
  const value = (durationMs * 1e6) / scale;

  const durationEl = new Uint8Array(11);
  durationEl.set([0x44, 0x89, 0x88]);
  new DataView(durationEl.buffer).setFloat64(3, value);

  // Info content: everything but an old Duration, then the new one.
  const parts = [];
  if (existing) {
    parts.push(head.subarray(info.dataStart, existing.start), head.subarray(existing.end, info.end));
  } else {
    parts.push(head.subarray(info.dataStart, info.end));
  }
  parts.push(durationEl);
  const contentLen = parts.reduce((n, a) => n + a.length, 0);

  let infoSizeLen = info.sizeLen;
  if (!sizeFits(contentLen, infoSizeLen)) infoSizeLen = 8;
  const infoIdLen = info.sizePos - info.start;
  const newInfoLen = infoIdLen + infoSizeLen + contentLen;
  const delta = newInfoLen - (info.end - info.start);

  // Segment size changes too, unless it is "unknown" (what MediaRecorder writes while streaming).
  let segSize = null;
  if (!seg.unknown) {
    if (!sizeFits(seg.size + delta, seg.sizeLen)) return null;
    segSize = writeSizeVint(seg.size + delta, seg.sizeLen);
  }

  const out = new Uint8Array(info.end + delta);
  out.set(head.subarray(0, info.start));
  if (segSize) out.set(segSize, seg.sizePos);
  let w = info.start;
  out.set(head.subarray(info.start, info.sizePos), w); w += infoIdLen;
  out.set(writeSizeVint(contentLen, infoSizeLen), w); w += infoSizeLen;
  for (const a of parts) { out.set(a, w); w += a.length; }
  return { bytes: out, replaced: info.end };
}

/** Duration in milliseconds from the recorded file itself (handles pauses), or 0 when unknown. */
export function measureDuration(blob, { timeoutMs = 8000 } = {}) {
  if (typeof document === 'undefined') return Promise.resolve(0);
  return new Promise((resolve) => {
    const el = document.createElement(/^audio/.test(blob.type) ? 'audio' : 'video');
    const url = URL.createObjectURL(blob);
    let done = false;
    const finish = (ms) => { if (done) return; done = true; clearTimeout(timer); el.removeAttribute('src'); el.load?.(); URL.revokeObjectURL(url); resolve(ms > 0 && Number.isFinite(ms) ? ms : 0); };
    const timer = setTimeout(() => finish(0), timeoutMs);
    el.preload = 'metadata';
    el.muted = true;
    el.onerror = () => finish(0);
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) { finish(el.duration * 1000); return; }
      // Files without a Duration report Infinity until the player has seen the end.
      el.ondurationchange = () => { if (Number.isFinite(el.duration) && el.duration > 0) finish(el.duration * 1000); };
      try { el.currentTime = 1e101; } catch { finish(0); }
    };
    el.src = url;
  });
}

/**
 * The same take with its Duration written in, or the take unchanged when it is not WebM, already has
 * a length, or cannot be patched safely.
 * @param {Blob} blob
 * @param {number} [fallbackMs]  used when the file's own length cannot be measured
 */
export async function withWebmDuration(blob, fallbackMs = 0, { measure = measureDuration } = {}) {
  if (!blob || !/webm/i.test(blob.type || '')) return blob;
  try {
    const ms = (await measure(blob)) || fallbackMs;
    if (!(ms > 0)) return blob;
    const head = new Uint8Array(await blob.slice(0, HEAD_BYTES).arrayBuffer());
    const patched = patchWebmHead(head, ms);
    if (!patched) return blob;
    return new Blob([patched.bytes, blob.slice(patched.replaced)], { type: blob.type });
  } catch {
    return blob;
  }
}
