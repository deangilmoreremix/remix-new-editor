// @vitest-environment node
// (Node's Blob has arrayBuffer(), as browsers do; jsdom's does not.)
// MediaRecorder WebM takes have no Duration: players show no length and cannot seek a download.
import { describe, expect, test } from 'vitest';
import { patchWebmHead, withWebmDuration } from '../webmDuration.js';

// Builders for a minimal WebM header: EBML header, Segment (unknown size), Info, then a Cluster.
const vint = (n, len) => { const b = []; let v = n; for (let i = 0; i < len; i++) { b.unshift(v & 0xff); v = Math.floor(v / 256); } b[0] |= 0x80 >> (len - 1); return b; };
const el = (idBytes, content, sizeLen = 1) => [...idBytes, ...vint(content.length, sizeLen), ...content];
const ebmlHeader = el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x82], [...'webm'].map((c) => c.charCodeAt(0))));
const timecodeScale = el([0x2a, 0xd7, 0xb1], [0x0f, 0x42, 0x40]); // 1,000,000 ns
const muxingApp = el([0x4d, 0x80], [...'Chrome'].map((c) => c.charCodeAt(0)));
const cluster = el([0x1f, 0x43, 0xb6, 0x75], [0xe7, 0x81, 0x00]);
const segUnknown = [0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
function file({ info = [...timecodeScale, ...muxingApp], extra = [] } = {}) {
  return new Uint8Array([...ebmlHeader, ...segUnknown, ...extra, ...el([0x15, 0x49, 0xa9, 0x66], info), ...cluster]);
}
// Duration value (float64 in TimecodeScale units) written in a patched header.
function durationIn(bytes) {
  for (let i = 0; i + 11 <= bytes.length; i++) {
    if (bytes[i] === 0x44 && bytes[i + 1] === 0x89 && bytes[i + 2] === 0x88) return new DataView(bytes.buffer, bytes.byteOffset + i + 3, 8).getFloat64(0);
  }
  return null;
}
const whole = (bytes, patched) => new Uint8Array([...patched.bytes, ...bytes.subarray(patched.replaced)]);

describe('patchWebmHead', () => {
  test('adds a Duration (ms at the default 1 ms timecode scale) and keeps the clusters intact', () => {
    const src = file();
    const p = patchWebmHead(src, 6000);
    expect(p).not.toBeNull();
    const out = whole(src, p);
    expect(durationIn(out)).toBe(6000);
    expect(out.length).toBe(src.length + 11);
    expect([...out.subarray(out.length - cluster.length)]).toEqual(cluster);
  });

  test('replaces an existing Duration instead of adding a second one', () => {
    const once = whole(file(), patchWebmHead(file(), 6000));
    const twice = whole(once, patchWebmHead(once, 5500));
    expect(durationIn(twice)).toBe(5500);
    expect(twice.length).toBe(once.length);
  });

  test('leaves files it cannot patch safely alone', () => {
    expect(patchWebmHead(new Uint8Array([1, 2, 3, 4]), 6000)).toBeNull(); // not WebM
    expect(patchWebmHead(file({ extra: el([0x11, 0x4d, 0x9b, 0x74], [0xec, 0x80]) }), 6000)).toBeNull(); // SeekHead offsets
    expect(patchWebmHead(file(), 0)).toBeNull();
  });
});

describe('withWebmDuration', () => {
  test('returns a WebM blob with the measured length written in', async () => {
    const blob = new Blob([file()], { type: 'video/webm;codecs=vp8,opus' });
    const out = await withWebmDuration(blob, 0, { measure: async () => 4200 });
    expect(out.type).toBe(blob.type);
    expect(durationIn(new Uint8Array(await out.arrayBuffer()))).toBe(4200);
  });

  test('falls back to the recorder timer when the length cannot be measured', async () => {
    const out = await withWebmDuration(new Blob([file()], { type: 'video/webm' }), 3000, { measure: async () => 0 });
    expect(durationIn(new Uint8Array(await out.arrayBuffer()))).toBe(3000);
  });

  test('passes MP4 and unpatchable files through unchanged', async () => {
    const mp4 = new Blob([new Uint8Array(20)], { type: 'video/mp4' });
    expect(await withWebmDuration(mp4, 3000, { measure: async () => 3000 })).toBe(mp4);
    const junk = new Blob([new Uint8Array(20)], { type: 'video/webm' });
    expect(await withWebmDuration(junk, 3000, { measure: async () => 3000 })).toBe(junk);
  });
});
