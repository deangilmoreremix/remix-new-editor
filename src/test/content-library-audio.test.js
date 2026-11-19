import { describe, it, expect, beforeEach, vi } from 'vitest';

// Chainable Supabase query mock: from().insert().select().single()
const { insertSpy, supabaseMock } = vi.hoisted(() => {
  const insertSpy = vi.fn();
  const supabaseMock = {
    from: () => ({
      insert: (record) => {
        insertSpy(record);
        return { select: () => ({ single: async () => ({ data: { id: 'row-1', ...record }, error: null }) }) };
      },
    }),
  };
  return { insertSpy, supabaseMock };
});

vi.mock('../lib/supabase.js', () => ({
  supabase: supabaseMock,
  isSupabaseConfigured: vi.fn(() => true),
}));
vi.mock('../lib/uploadService.js', () => ({
  uploadFileToStorage: vi.fn(async (file) => `https://storage.test/uploads/user-1/${file.name}`),
}));
vi.mock('../lib/userKey.js', () => ({ getUserKey: () => 'user-1' }));

import * as supabaseModule from '../lib/supabase.js';
import { saveToContent, saveContentLibraryEntry, uploadToContentLibrary } from '../lib/contentLibrary.js';

describe('content library — audio support', () => {
  beforeEach(() => {
    localStorage.clear();
    insertSpy.mockClear();
    supabaseModule.isSupabaseConfigured.mockReturnValue(true);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }); // HEAD probe fails → defaults
  });

  describe('saveToContent (local store) infers audio from the extension', () => {
    it.each(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'oga'])('.%s → audio', (ext) => {
      const entry = saveToContent({ url: `https://cdn.test/track.${ext}?sig=1` });
      expect(entry.type).toBe('audio');
    });

    it('still treats unknown extensions as images and respects an explicit type', () => {
      expect(saveToContent({ url: 'https://cdn.test/pic.png' }).type).toBe('image');
      expect(saveToContent({ url: 'https://cdn.test/blob', type: 'audio' }).type).toBe('audio');
    });
  });

  describe('saveContentLibraryEntry (Supabase path)', () => {
    it.each(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'oga'])('.%s is stored as audio, not pdf', async (ext) => {
      await saveContentLibraryEntry(`https://storage.test/uploads/user-1/song.${ext}`);
      expect(insertSpy).toHaveBeenCalledTimes(1);
      const record = insertSpy.mock.calls[0][0];
      expect(record.type).toBe('audio');
      expect(record.mime_type).toBe('audio/mpeg');
    });

    it('does not regress video, image or pdf detection', async () => {
      await saveContentLibraryEntry('https://storage.test/uploads/user-1/a.mp4');
      await saveContentLibraryEntry('https://storage.test/uploads/user-1/a.png');
      await saveContentLibraryEntry('https://storage.test/uploads/user-1/a.pdf');
      expect(insertSpy.mock.calls.map((c) => c[0].type)).toEqual(['video', 'image', 'pdf']);
    });

    it('keeps an explicit meta.type over extension detection', async () => {
      await saveContentLibraryEntry('https://storage.test/uploads/user-1/a.mp3', { type: 'video' });
      expect(insertSpy.mock.calls[0][0].type).toBe('video');
    });

    it('uses the real content-type from the HEAD probe when available', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: (h) => (h === 'content-type' ? 'audio/wav' : h === 'content-length' ? '1234' : null) },
      });
      await saveContentLibraryEntry('https://storage.test/uploads/user-1/a.wav');
      const record = insertSpy.mock.calls[0][0];
      expect(record.mime_type).toBe('audio/wav');
      expect(record.size).toBe(1234);
    });
  });

  describe('uploadToContentLibrary', () => {
    it('accepts an audio file and records it with type audio', async () => {
      const file = new File(['x'], 'voice.mp3', { type: 'audio/mpeg' });
      await uploadToContentLibrary(file);
      const record = insertSpy.mock.calls[0][0];
      expect(record.type).toBe('audio');
      expect(record.mime_type).toBe('audio/mpeg');
      expect(record.filename).toBe('voice.mp3');
    });

    it('still records video and pdf with their own types', async () => {
      await uploadToContentLibrary(new File(['x'], 'v.mp4', { type: 'video/mp4' }));
      await uploadToContentLibrary(new File(['x'], 'd.pdf', { type: 'application/pdf' }));
      expect(insertSpy.mock.calls.map((c) => c[0].type)).toEqual(['video', 'pdf']);
    });

    it('rejects unsupported files with a message that mentions audio', async () => {
      const file = new File(['x'], 'pic.png', { type: 'image/png' });
      await expect(uploadToContentLibrary(file)).rejects.toThrow(/PDF, video and audio/);
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });
});
