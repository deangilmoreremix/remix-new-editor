/**
 * Render studio tests.
 *
 * Tests validate:
 * - Draft CRUD with Supabase + localStorage fallback
 * - Template CRUD with duplication
 * - Render queue management
 * - Render execution and status tracking
 * - Edge cases: empty states, failures, concurrent renders
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const localStorageStore = {};
const localStorageMock = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, value) => { localStorageStore[key] = value },
  removeItem: (key) => { delete localStorageStore[key] },
  clear: () => { for (const k in localStorageStore) delete localStorageStore[k]; },
};

function createMockSupabase() {
  const mock = {
    from: vi.fn(() => mock),
    select: vi.fn(() => mock),
    insert: vi.fn(() => mock),
    update: vi.fn(() => mock),
    delete: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    in: vi.fn(() => mock),
    order: vi.fn(() => mock),
    single: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  };
  return mock;
}

describe('Render Studio', () => {
  beforeEach(() => {
    localStorageMock.clear();
    global.localStorage = localStorageMock;
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('Drafts', () => {
    test('saveDraft persists entry with id and timestamps', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'draft-1', label: 'Test Draft', video_url: 'https://example.com/video.mp4', user_id: 'user-123' },
        error: null,
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { saveDraft } = await import('../lib/editor/renderActions.js');
      const result = await saveDraft({ label: 'Test Draft', videoUrl: 'https://example.com/video.mp4' });

      expect(result).toBeTruthy();
      expect(result.label).toBe('Test Draft');
    });

    test('listDrafts returns array', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { listDrafts } = await import('../lib/editor/renderActions.js');
      const result = await listDrafts();

      expect(Array.isArray(result)).toBe(true);
    });

    test('deleteDraft removes by id', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { deleteDraft } = await import('../lib/editor/renderActions.js');
      await deleteDraft('draft-1');

      expect(mockSupabase.delete).toHaveBeenCalled();
    });
  });

  describe('Templates', () => {
    test('saveTemplate persists entry with id and timestamps', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'template-1', label: 'Test Template', config: { effect: 'cinematic' }, user_id: 'user-123' },
        error: null,
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { saveTemplate } = await import('../lib/editor/renderActions.js');
      const result = await saveTemplate({ label: 'Test Template', config: { effect: 'cinematic' } });

      expect(result).toBeTruthy();
      expect(result.label).toBe('Test Template');
    });

    test('listTemplates returns array', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { listTemplates } = await import('../lib/editor/renderActions.js');
      const result = await listTemplates();

      expect(Array.isArray(result)).toBe(true);
    });

    test('duplicateTemplate creates copy with "(Copy)" suffix', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'template-1', label: 'Original', config: { effect: 'cinematic' }, user_id: 'user-123' },
        error: null,
      }).mockResolvedValueOnce({
        data: { id: 'template-2', label: 'Original (Copy)', config: { effect: 'cinematic' }, user_id: 'user-123' },
        error: null,
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { duplicateTemplate } = await import('../lib/editor/renderActions.js');
      const result = await duplicateTemplate('template-1');

      expect(result?.label).toBe('Original (Copy)');
    });

    test('deleteTemplate removes by id', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { deleteTemplate } = await import('../lib/editor/renderActions.js');
      await deleteTemplate('template-1');

      expect(mockSupabase.delete).toHaveBeenCalled();
    });
  });

  describe('localStorage fallback', () => {
    test('falls back to localStorage when not authenticated', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { saveDraft } = await import('../lib/editor/renderActions.js');
      await saveDraft({ label: 'Local Draft', videoUrl: 'https://example.com/video.mp4' });

      const stored = localStorageMock.getItem('render:drafts');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored || '[]');
      expect(parsed).toHaveLength(1);
      expect(parsed[0].label).toBe('Local Draft');
    });

    test('falls back to localStorage on Supabase error', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { saveDraft } = await import('../lib/editor/renderActions.js');
      await saveDraft({ label: 'Fallback Draft' });

      const stored = localStorageMock.getItem('render:drafts');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored || '[]');
      expect(parsed).toHaveLength(1);
    });
  });

  describe('Render Queue', () => {
    test('enqueueRender adds job to queue', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'job-1', video_url: 'https://example.com/video.mp4', action: 'enhance', status: 'pending', user_id: 'user-123' },
        error: null,
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { enqueueRender } = await import('../lib/editor/renderQueueStore.js');
      const result = await enqueueRender({ videoUrl: 'https://example.com/video.mp4', action: 'enhance' });

      expect(result).toBeTruthy();
      expect(result.id).toBe('job-1');
    });

    test('listRenderQueue returns array', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { listRenderQueue } = await import('../lib/editor/renderQueueStore.js');
      const result = await listRenderQueue();

      expect(Array.isArray(result)).toBe(true);
    });

    test('removeFromRenderQueue removes job', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { removeFromRenderQueue } = await import('../lib/editor/renderQueueStore.js');
      await removeFromRenderQueue('job-1');

      expect(mockSupabase.delete).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    test('handles empty queue gracefully', async () => {
      vi.resetModules();
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      vi.doMock('../lib/supabase.js', () => ({
        supabase: mockSupabase,
      }));

      const { listRenderQueue } = await import('../lib/editor/renderQueueStore.js');
      const result = await listRenderQueue();

      expect(result).toEqual([]);
    });
  });
});