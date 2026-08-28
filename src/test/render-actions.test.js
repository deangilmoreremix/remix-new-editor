import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as router from '../lib/router.js';
import {
  getVideoMetadata,
  downloadFrame,
  copyToClipboard,
  saveDraft,
  saveTemplate,
  duplicateTemplate,
  listTemplates,
  listDrafts,
  deleteTemplate,
  deleteDraft,
  sendToStoryboard,
} from '../lib/editor/renderActions.js';

describe('renderActions', () => {
  let localStorageMock;
  let originalLocalStorage;
  let navigateSpy;

  beforeEach(() => {
    originalLocalStorage = global.localStorage;
    const store = {};

    localStorageMock = {
      getItem: vi.fn((key) => store[key] ?? null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { for (const k in store) delete store[k]; }),
    };

    global.localStorage = localStorageMock;
    navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() => {});
  });

  afterEach(() => {
    localStorageMock.clear();
    global.localStorage = originalLocalStorage;
    vi.restoreAllMocks();
  });

  describe('saveDraft', () => {
    it('persists entry with id and timestamps', async () => {
      const entry = await saveDraft({ label: 'my draft' });
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('created_at');
      expect(entry).toHaveProperty('updated_at');
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.created_at).toBe('string');
      expect(typeof entry.updated_at).toBe('string');
    });
  });

  describe('saveTemplate', () => {
    it('persists entry with id and timestamps', async () => {
      const entry = await saveTemplate({ label: 'my template' });
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('created_at');
      expect(entry).toHaveProperty('updated_at');
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.created_at).toBe('string');
      expect(typeof entry.updated_at).toBe('string');
    });
  });

  describe('drafts/templates isolation', () => {
    it('saves drafts and templates separately', async () => {
      await saveDraft({ label: 'draft 1' });
      await saveTemplate({ label: 'template 1' });

      const drafts = await listDrafts();
      const templates = await listTemplates();

      expect(drafts).toHaveLength(1);
      expect(drafts[0].label).toBe('draft 1');
      expect(templates).toHaveLength(1);
      expect(templates[0].label).toBe('template 1');
    });
  });

  describe('duplicateTemplate', () => {
    it('returns copy with "(Copy)" suffix', async () => {
      const original = await saveTemplate({ label: 'original' });
      const copy = await duplicateTemplate(original.id);

      expect(copy.label).toBe('original (Copy)');
      expect(copy.id).not.toBe(original.id);
    });
  });

  describe('deleteDraft', () => {
    it('removes draft by id', async () => {
      const entry = await saveDraft({ label: 'to delete' });
      await deleteDraft(entry.id);
      expect(await listDrafts()).toHaveLength(0);
    });
  });

  describe('deleteTemplate', () => {
    it('removes template by id', async () => {
      const entry = await saveTemplate({ label: 'to delete' });
      await deleteTemplate(entry.id);
      expect(await listTemplates()).toHaveLength(0);
    });
  });

  describe('copyToClipboard', () => {
    it('uses clipboard API with execCommand fallback', async () => {
      const writeText = vi.fn();
      const mockDocument = {
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
        createElement: vi.fn(() => ({
          value: '',
          select: vi.fn(),
        })),
        execCommand: vi.fn(),
      };
      const originalDocument = global.document;
      global.document = mockDocument;
      global.navigator = { clipboard: { writeText } };

      await copyToClipboard('hello world');

      expect(writeText).toHaveBeenCalledWith('hello world');
      global.document = originalDocument;
    });

    it('falls back to execCommand when clipboard API fails', async () => {
      const mockDocument = {
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
        createElement: vi.fn(() => ({
          value: '',
          select: vi.fn(),
          style: {},
        })),
        execCommand: vi.fn(),
      };
      const originalDocument = global.document;
      global.document = mockDocument;
      global.navigator = {
        clipboard: {
          writeText: vi.fn(() => { throw new Error('fail'); }),
        },
      };

      await copyToClipboard('fallback text');

      expect(mockDocument.execCommand).toHaveBeenCalledWith('copy');
      global.document = originalDocument;
    });
  });

  describe('sendToStoryboard', () => {
    it('calls navigate with storyboard page and params', () => {
      sendToStoryboard('video-123', 'https://example.com/video.mp4');
      expect(navigateSpy).toHaveBeenCalledWith('storyboard', {
        videoId: 'video-123',
        videoUrl: 'https://example.com/video.mp4',
      });
    });
  });

  describe('getVideoMetadata', () => {
    it('returns null for empty url', async () => {
      const result = await getVideoMetadata('');
      expect(result).toBeNull();
    });
  });
});
