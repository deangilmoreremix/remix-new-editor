// Render studio action tests
// Tests validate draft/template management and render queue operations
import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
  auth: {
    getSession: vi.fn(),
  },
}

vi.mock('../src/lib/supabase', () => ({
  supabase: mockSupabase,
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

describe('Render Actions (Supabase-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
    })
  })

  describe('Drafts', () => {
    test('should save draft to Supabase when authenticated', async () => {
      const draft = {
        id: 'draft-1',
        label: 'Test Draft',
        video_url: 'https://example.com/video.mp4',
        user_id: 'user-123',
      }

      mockSupabase.single.mockResolvedValue({
        data: draft,
        error: null,
      })

      const { saveDraft } = await import('../src/lib/editor/renderActions.js')
      const result = await saveDraft({
        label: 'Test Draft',
        videoUrl: 'https://example.com/video.mp4',
      })

      expect(result.id).toBe('draft-1')
      expect(result.label).toBe('Test Draft')
      expect(mockSupabase.insert).toHaveBeenCalled()
    })

    test('should fallback to localStorage when not authenticated', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      })

      const { saveDraft } = await import('../src/lib/editor/renderActions.js')
      const result = await saveDraft({
        label: 'Local Draft',
        videoUrl: 'https://example.com/video.mp4',
      })

      expect(result.label).toBe('Local Draft')
      expect(result.id).toBeTruthy()
      // Should be in localStorage
      const stored = JSON.parse(localStorageMock.getItem('render:drafts') || '[]')
      expect(stored).toHaveLength(1)
    })

    test('should list drafts from Supabase', async () => {
      const drafts = [
        { id: '1', label: 'Draft 1', video_url: 'url1', user_id: 'user-123' },
        { id: '2', label: 'Draft 2', video_url: 'url2', user_id: 'user-123' },
      ]

      mockSupabase.mockResolvedValue({
        data: drafts,
        error: null,
      })

      const { listDrafts } = await import('../src/lib/editor/renderActions.js')
      const result = await listDrafts()

      expect(result).toHaveLength(2)
      expect(result[0].label).toBe('Draft 1')
    })

    test('should delete draft from Supabase', async () => {
      mockSupabase.mockResolvedValue({
        data: null,
        error: null,
      })

      const { deleteDraft } = await import('../src/lib/editor/renderActions.js')
      await deleteDraft('draft-1')

      expect(mockSupabase.delete).toHaveBeenCalledWith('draft-1')
    })

    test('should fallback to localStorage delete when Supabase fails', async () => {
      // Pre-populate localStorage
      localStorageMock.setItem('render:drafts', JSON.stringify([
        { id: 'draft-1', label: 'Test' },
      ]))

      mockSupabase.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const { deleteDraft } = await import('../src/lib/editor/renderActions.js')
      await deleteDraft('draft-1')

      const stored = JSON.parse(localStorageMock.getItem('render:drafts') || '[]')
      expect(stored).toHaveLength(0)
    })
  })

  describe('Templates', () => {
    test('should save template to Supabase when authenticated', async () => {
      const template = {
        id: 'template-1',
        label: 'Test Template',
        config: { effect: 'cinematic' },
        user_id: 'user-123',
      }

      mockSupabase.single.mockResolvedValue({
        data: template,
        error: null,
      })

      const { saveTemplate } = await import('../src/lib/editor/renderActions.js')
      const result = await saveTemplate({
        label: 'Test Template',
        config: { effect: 'cinematic' },
      })

      expect(result.id).toBe('template-1')
      expect(result.label).toBe('Test Template')
    })

    test('should list templates from Supabase', async () => {
      const templates = [
        { id: '1', label: 'Template 1', config: {}, user_id: 'user-123' },
        { id: '2', label: 'Template 2', config: {}, user_id: 'user-123' },
      ]

      mockSupabase.mockResolvedValue({
        data: templates,
        error: null,
      })

      const { listTemplates } = await import('../src/lib/editor/renderActions.js')
      const result = await listTemplates()

      expect(result).toHaveLength(2)
      expect(result[0].label).toBe('Template 1')
    })

    test('should duplicate template', async () => {
      const original = {
        id: 'template-1',
        label: 'Original',
        config: { effect: 'cinematic' },
        user_id: 'user-123',
      }

      const copy = {
        ...original,
        id: 'template-2',
        label: 'Original (Copy)',
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: original,
        error: null,
      }).mockResolvedValueOnce({
        data: copy,
        error: null,
      })

      const { duplicateTemplate } = await import('../src/lib/editor/renderActions.js')
      const result = await duplicateTemplate('template-1')

      expect(result?.label).toBe('Original (Copy)')
      expect(result?.id).toBe('template-2')
    })

    test('should delete template', async () => {
      mockSupabase.mockResolvedValue({
        data: null,
        error: null,
      })

      const { deleteTemplate } = await import('../src/lib/editor/renderActions.js')
      await deleteTemplate('template-1')

      expect(mockSupabase.delete).toHaveBeenCalled()
    })
  })

  describe('Fallback Behavior', () => {
    test('should fallback to localStorage when Supabase errors', async () => {
      mockSupabase.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const { saveDraft } = await import('../src/lib/editor/renderActions.js')
      await saveDraft({ label: 'Fallback Draft' })

      const stored = JSON.parse(localStorageMock.getItem('render:drafts') || '[]')
      expect(stored).toHaveLength(1)
      expect(stored[0].label).toBe('Fallback Draft')
    })

    test('should handle empty Supabase response', async () => {
      mockSupabase.mockResolvedValue({
        data: null,
        error: null,
      })

      const { listDrafts } = await import('../src/lib/editor/renderActions.js')
      const result = await listDrafts()

      expect(result).toEqual([])
    })
  })
})
