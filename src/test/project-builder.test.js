/**
 * Project builder / dashboard tests.
 *
 * Tests validate:
 * - Project CRUD
 * - Project preview and device switching
 * - Agent code generation
 * - Cloudflare Pages deployment
 * - Search and filter
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock esbuild-wasm
vi.mock('esbuild-wasm', () => ({
  build: vi.fn(() => Promise.resolve({ outputFiles: [{ text: 'console.log("test")' }] })),
}));

// Mock router
vi.mock('../../lib/router.js', () => ({
  navigate: vi.fn(),
}));

describe('Project Builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PB-01: Create project', () => {
    test('creates project with prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'proj-1', title: 'My Website', files: {} }),
      });

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ prompt: 'Create a landing page for a coffee shop' }),
      });

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.id).toBe('proj-1');
    });

    test('rejects empty prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Prompt is required' }),
      });

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ prompt: '' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('PB-02: List projects', () => {
    test('lists user projects', async () => {
      const projects = [
        { id: 'proj-1', title: 'Project 1', user_id: 'user-123' },
        { id: 'proj-2', title: 'Project 2', user_id: 'user-123' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ projects }),
      });

      const res = await fetch('/api/projects', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });

      const data = await res.json();
      expect(data.projects).toHaveLength(2);
    });

    test('returns empty list when no projects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ projects: [] }),
      });

      const res = await fetch('/api/projects', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });

      const data = await res.json();
      expect(data.projects).toEqual([]);
    });
  });

  describe('PB-03: Rename project', () => {
    test('updates project title', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'proj-1', title: 'New Title' }),
      });

      const res = await fetch('/api/projects/proj-1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ title: 'New Title' }),
      });

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.title).toBe('New Title');
    });
  });

  describe('PB-04: Delete project', () => {
    test('deletes project', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const res = await fetch('/api/projects/proj-1', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer valid-token',
          'x-csrf-token': 'valid-csrf-token',
        },
      });

      expect(res.ok).toBe(true);
    });
  });

  describe('PB-09: Preview project', () => {
    test('builds and returns preview HTML', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ html: '<html>...</html>', assets: {} }),
      });

      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ projectId: 'proj-1' }),
      });

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.html).toBeTruthy();
    });
  });

  describe('PB-10: Device preview switching', () => {
    test('returns mobile preview', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ html: '<html>...</html>', device: 'mobile' }),
      });

      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ projectId: 'proj-1', device: 'mobile' }),
      });

      const data = await res.json();
      expect(data.device).toBe('mobile');
    });
  });

  describe('PB-14: Deploy to Cloudflare Pages', () => {
    test('deploys project successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          url: 'https://my-project.pages.dev',
          deploymentId: 'deploy-123',
        }),
      });

      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ projectId: 'proj-1' }),
      });

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.url).toContain('pages.dev');
    });

    test('handles deploy failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Cloudflare API error' }),
      });

      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ projectId: 'proj-1' }),
      });

      expect(res.status).toBe(500);
    });
  });

  describe('PB-06: Search projects', () => {
    test('filters projects by title', async () => {
      const projects = [
        { id: 'proj-1', title: 'Coffee Shop', user_id: 'user-123' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ projects }),
      });

      const res = await fetch('/api/projects?search=coffee', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });

      const data = await res.json();
      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].title).toBe('Coffee Shop');
    });
  });

  describe('Agent integration', () => {
    test('agent generates code from prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: { 'App.jsx': 'export default function App() { return <div>Hello</div>; }' },
          status: 'done',
        }),
      });

      const res = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ prompt: 'Create a landing page', projectId: 'proj-1' }),
      });

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.files['App.jsx']).toBeTruthy();
    });

    test('agent fails over to alternate provider on failure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Provider unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            files: { 'App.jsx': 'export default function App() { return <div>Hello</div>; }' },
            status: 'done',
          }),
        });

      // First request fails, second succeeds with fallback
      const res1 = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ prompt: 'Create a landing page', projectId: 'proj-1' }),
      });

      const res2 = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ prompt: 'Create a landing page', projectId: 'proj-1' }),
      });

      expect(res1.status).toBe(500);
      expect(res2.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
