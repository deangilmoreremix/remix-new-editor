import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('Workspace Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('saves spaces to localStorage', () => {
    const spaces = [
      {
        id: 'space-1',
        name: 'Test Space',
        nodes: [{ id: 'node-1', type: 'prompt', position: { x: 0, y: 0 }, data: { type: 'prompt', config: { prompt: 'test' } } }],
        edges: [],
      },
    ];
    localStorageMock.setItem('cinegen_spaces', JSON.stringify(spaces));
    localStorageMock.setItem('cinegen_active_space', 'space-1');

    const loaded = JSON.parse(localStorageMock.getItem('cinegen_spaces'));
    expect(loaded).toEqual(spaces);
    expect(localStorageMock.getItem('cinegen_active_space')).toBe('space-1');
  });

  it('preserves node positions and configurations through save/load', () => {
    const node = {
      id: 'node-1',
      type: 'prompt',
      position: { x: 100, y: 200 },
      data: {
        type: 'prompt',
        config: { prompt: 'a cinematic sunset' },
      },
    };
    const space = {
      id: 'space-1',
      name: 'Test Space',
      nodes: [node],
      edges: [],
    };
    localStorageMock.setItem('cinegen_spaces', JSON.stringify([space]));

    const loaded = JSON.parse(localStorageMock.getItem('cinegen_spaces'));
    expect(loaded[0].nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(loaded[0].nodes[0].data.config.prompt).toBe('a cinematic sunset');
  });

  it('handles missing localStorage gracefully', () => {
    localStorageMock.clear();
    const saved = localStorageMock.getItem('cinegen_spaces');
    expect(saved).toBeNull();
  });

  it('preserves edges through save/load', () => {
    const space = {
      id: 'space-1',
      name: 'Test Space',
      nodes: [
        { id: 'node-1', type: 'prompt', position: { x: 0, y: 0 }, data: { type: 'prompt', config: {} } },
        { id: 'node-2', type: 'assetOutput', position: { x: 200, y: 0 }, data: { type: 'assetOutput', config: {} } },
      ],
      edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2', sourceHandle: 'text', targetHandle: 'image' }],
    };
    localStorageMock.setItem('cinegen_spaces', JSON.stringify([space]));

    const loaded = JSON.parse(localStorageMock.getItem('cinegen_spaces'));
    expect(loaded[0].edges).toHaveLength(1);
    expect(loaded[0].edges[0].source).toBe('node-1');
    expect(loaded[0].edges[0].target).toBe('node-2');
  });
});
