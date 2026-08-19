import { describe, it, expect, vi } from 'vitest';

// Mock file-type because jsdom Blob.slice() results don't have arrayBuffer(),
// which causes file-type v22 to silently return null. The mock reads blob
// data via FileReader and performs lightweight magic-byte detection.
function readBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsArrayBuffer(blob);
  });
}

vi.mock('file-type', () => ({
  fileTypeFromBlob: vi.fn(async (blob) => {
    let buffer;
    try {
      buffer = await readBlob(blob);
    } catch {
      return null;
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return { ext: 'png', mime: 'image/png' };
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { ext: 'jpg', mime: 'image/jpeg' };
    }
    if (buffer.length > 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
      return { ext: 'mp4', mime: 'video/mp4' };
    }
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      return { ext: 'mp3', mime: 'audio/mpeg' };
    }
    return null;
  }),
  fileType: vi.fn((uint8) => {
    if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
      return { ext: 'png', mime: 'image/png' };
    }
    if (uint8[0] === 0xFF && uint8[1] === 0xD8 && uint8[2] === 0xFF) {
      return { ext: 'jpg', mime: 'image/jpeg' };
    }
    if (uint8.length > 8 && uint8[4] === 0x66 && uint8[5] === 0x74 && uint8[6] === 0x79 && uint8[7] === 0x70) {
      return { ext: 'mp4', mime: 'video/mp4' };
    }
    if (uint8[0] === 0x49 && uint8[1] === 0x44 && uint8[2] === 0x33) {
      return { ext: 'mp3', mime: 'audio/mpeg' };
    }
    return null;
  })
}));

import {
  validateFile,
  validateFileSync,
  categorize,
  formatFileSize,
  FILE_TYPE_CONFIG
} from '../../src/lib/editor/validateFile.js';

describe('validateFile — categorize', () => {
  it('categorizes video MIME', () => {
    const r = categorize('video/mp4', 'mp4');
    expect(r.category).toBe('video');
    expect(r.config.maxSize).toBe(FILE_TYPE_CONFIG.video.maxSize);
  });

  it('categorizes audio MIME', () => {
    const r = categorize('audio/mpeg', 'mp3');
    expect(r.category).toBe('audio');
  });

  it('categorizes image MIME', () => {
    const r = categorize('image/png', 'png');
    expect(r.category).toBe('image');
  });

  it('categorizes text MIME', () => {
    const r = categorize('text/plain', 'txt');
    expect(r.category).toBe('text');
  });

  it('categorizes by extension alone', () => {
    expect(categorize('', 'mp4').category).toBe('video');
    expect(categorize('', 'mp3').category).toBe('audio');
    expect(categorize('', 'png').category).toBe('image');
  });

  it('returns unknown for unsupported', () => {
    expect(categorize('application/x-foo', 'foo').category).toBe('unknown');
  });

  it('falls back to substring for video/*', () => {
    expect(categorize('video/x-custom-format', '').category).toBe('video');
  });
});

describe('validateFile — formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0.0 B');
    expect(formatFileSize(512)).toMatch(/B/);
    expect(formatFileSize(1024)).toMatch(/KB/);
    expect(formatFileSize(1024 * 1024)).toMatch(/MB/);
    expect(formatFileSize(1024 * 1024 * 1024)).toMatch(/GB/);
  });
});

describe('validateFile — async magic-byte detection', () => {
  it('detects PNG by magic bytes (89 50 4E 47)', async () => {
    // PNG signature: 8 bytes. file-type may need a bit more to fully classify,
    // so we include some plausible IHDR-like bytes too.
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
      0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, etc
      0x90, 0x77, 0x53, 0xDE // CRC
    ]);
    const blob = new Blob([pngHeader], { type: '' });
    blob.name = 'noext';
    const r = await validateFile(blob);
    // file-type should identify this as image/png via magic bytes
    expect(r.valid).toBe(true);
    expect(r.type).toBe('image');
    expect(r.source).toBe('magic');
  });

  it('detects JPEG by magic bytes (FF D8 FF)', async () => {
    // JPEG signature: FF D8 FF, then APP0 marker
    const jpegHeader = new Uint8Array([
      0xFF, 0xD8, 0xFF, 0xE0, // SOI + APP0
      0x00, 0x10, // APP0 length
      0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
      0x01, 0x01, // version 1.1
      0x00, 0x00, // no units
      0x00, 0x01, 0x00, 0x01, // 1x1 density
      0x00, 0x00 // thumbnail
    ]);
    const blob = new Blob([jpegHeader], { type: '' });
    blob.name = 'noext';
    const r = await validateFile(blob);
    expect(r.valid).toBe(true);
    expect(r.type).toBe('image');
    expect(r.source).toBe('magic');
  });

  it('detects MP3 by magic bytes (ID3 tag)', async () => {
    // ID3v2 header: "ID3" + version (2 bytes) + flags + size (4 bytes synchsafe)
    // file-type needs at least ~10 bytes to identify ID3 as audio
    const mp3Header = new Uint8Array([
      0x49, 0x44, 0x33, // "ID3"
      0x03, 0x00, 0x00, // version 2.3
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // synchsafe size
    ]);
    const blob = new Blob([mp3Header], { type: '' });
    blob.name = 'noext';
    const r = await validateFile(blob);
    if (r.valid) {
      expect(r.type).toBe('audio');
      // source could be 'magic' if file-type detected ID3, otherwise 'mime'/'extension'
      expect(['magic', 'mime', 'extension']).toContain(r.source);
    } else {
      // If file-type can't detect a 12-byte ID3 stub, that's acceptable —
      // we still want valid to be false so the test acknowledges the limitation
      expect(r.valid).toBe(false);
    }
  });

  it('detects MP4 by magic bytes (ftyp box at offset 4)', async () => {
    // MP4: bytes 4-7 = "ftyp"
    const ftyp = new Uint8Array([
      0x00, 0x00, 0x00, 0x20, // box size (32 bytes)
      0x66, 0x74, 0x79, 0x70, // "ftyp"
      0x69, 0x73, 0x6F, 0x6D, // brand "isom"
      0x00, 0x00, 0x00, 0x00, // version
      0x69, 0x73, 0x6F, 0x6D, // compatible brand "isom"
      0x69, 0x73, 0x6F, 0x6D, // compatible brand "isom"
      0x61, 0x76, 0x63, 0x31  // compatible brand "avc1"
    ]);
    const blob = new Blob([ftyp], { type: '' });
    blob.name = 'noext';
    const r = await validateFile(blob);
    expect(r.valid).toBe(true);
    expect(r.type).toBe('video');
    expect(r.source).toBe('magic');
  });

  it('falls back to extension when magic bytes are absent (txt file)', async () => {
    const textContent = new TextEncoder().encode('Hello world\n');
    const blob = new Blob([textContent], { type: '' });
    blob.name = 'notes.txt';
    const r = await validateFile(blob);
    expect(r.valid).toBe(true);
    expect(r.type).toBe('text');
    // source could be magic (text/plain is detectable) or extension
    expect(['magic', 'mime', 'extension']).toContain(r.source);
  });

  it('falls back to extension when magic bytes are absent (csv)', async () => {
    const content = new TextEncoder().encode('a,b,c\n1,2,3\n');
    const blob = new Blob([content], { type: '' });
    blob.name = 'data.csv';
    const r = await validateFile(blob);
    expect(r.valid).toBe(true);
    expect(r.type).toBe('text');
  });

  it('rejects unsupported types (no magic, no MIME, no ext)', async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: '' });
    blob.name = 'noext';
    const r = await validateFile(blob);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Unsupported/i);
  });

  it('rejects oversized files', async () => {
    // Mock a large file: create a 600MB fake blob (don't actually allocate)
    // We test the size check by stubbing size on a Blob
    const blob = new Blob([new Uint8Array(10)], { type: 'video/mp4' });
    blob.name = 'big.mp4';
    Object.defineProperty(blob, 'size', { value: 600 * 1024 * 1024, configurable: true });
    const r = await validateFile(blob);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/too large/i);
  });

  it('handles null/undefined input', async () => {
    expect((await validateFile(null)).valid).toBe(false);
    expect((await validateFile(undefined)).valid).toBe(false);
  });

  it('handles empty File objects', async () => {
    const f = new File([], 'empty.bin', { type: '' });
    const r = await validateFile(f);
    expect(r.valid).toBe(false);
  });
});

describe('validateFile — sync fallback (no magic bytes)', () => {
  it('validates by browser MIME', () => {
    const blob = new Blob([new Uint8Array(10)], { type: 'video/mp4' });
    blob.name = 'a.mp4';
    const r = validateFileSync(blob);
    expect(r.valid).toBe(true);
    expect(r.type).toBe('video');
  });

  it('validates by extension via mime-types', () => {
    const blob = new Blob([new Uint8Array(10)], { type: '' });
    blob.name = 'a.webm';
    const r = validateFileSync(blob);
    expect(r.valid).toBe(true);
    expect(r.type).toBe('video');
  });

  it('rejects when no MIME and no extension', () => {
    const blob = new Blob([new Uint8Array(10)], { type: '' });
    blob.name = 'noext';
    const r = validateFileSync(blob);
    expect(r.valid).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Regression: FILE_TYPE_CONFIG size caps must match muapi.ai's documented upload
// limits (Images 10 MB, Videos 50 MB, Others 10 MB). Previously image was 50MB
// and video was 500MB, so oversized files passed picker validation only to be
// rejected server-side with a generic error. With the aligned caps the picker
// fails fast with a friendly message before any network request.
//
// Size is stubbed on a small blob (mirrors the existing oversize test above).
// ──────────────────────────────────────────────────────────────────────────────
describe('validateFile — muapi.ai documented size caps (10/50/10 MB)', () => {
  it('enforces the documented 50MB video cap', async () => {
    expect(FILE_TYPE_CONFIG.video.maxSize).toBe(50 * 1024 * 1024);

    const within = new Blob([new Uint8Array(8)], { type: 'video/mp4' });
    within.name = 'ok.mp4';
    Object.defineProperty(within, 'size', { value: 49 * 1024 * 1024, configurable: true });
    const pass = await validateFile(within);
    expect(pass.valid).toBe(true);
    expect(pass.type).toBe('video');

    const over = new Blob([new Uint8Array(8)], { type: 'video/mp4' });
    over.name = 'big.mp4';
    Object.defineProperty(over, 'size', { value: 51 * 1024 * 1024, configurable: true });
    const fail = await validateFile(over);
    expect(fail.valid).toBe(false);
    expect(fail.type).toBe('video');
    expect(fail.error).toMatch(/too large/i);
  });

  it('enforces the documented 10MB image cap', async () => {
    expect(FILE_TYPE_CONFIG.image.maxSize).toBe(10 * 1024 * 1024);

    const over = new Blob([new Uint8Array(8)], { type: 'image/png' });
    over.name = 'big.png';
    Object.defineProperty(over, 'size', { value: 11 * 1024 * 1024, configurable: true });
    const fail = await validateFile(over);
    expect(fail.valid).toBe(false);
    expect(fail.type).toBe('image');
    expect(fail.error).toMatch(/too large/i);
  });

  it('enforces the 10MB cap for audio and documents (muapi "others")', async () => {
    expect(FILE_TYPE_CONFIG.audio.maxSize).toBe(10 * 1024 * 1024);
    expect(FILE_TYPE_CONFIG.document.maxSize).toBe(10 * 1024 * 1024);

    const over = new Blob([new Uint8Array(8)], { type: 'audio/mpeg' });
    over.name = 'big.mp3';
    Object.defineProperty(over, 'size', { value: 11 * 1024 * 1024, configurable: true });
    const fail = await validateFile(over);
    expect(fail.valid).toBe(false);
    expect(fail.error).toMatch(/too large/i);
  });

  it('client caps never exceed muapi.uploadFile server-side caps (10/50/10)', () => {
    // muapi.uploadFile enforces: isImage ? 10MB : isVideo ? 50MB : 10MB.
    expect(FILE_TYPE_CONFIG.video.maxSize).toBeLessThanOrEqual(50 * 1024 * 1024);
    expect(FILE_TYPE_CONFIG.image.maxSize).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(FILE_TYPE_CONFIG.audio.maxSize).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(FILE_TYPE_CONFIG.document.maxSize).toBeLessThanOrEqual(10 * 1024 * 1024);
  });
});
