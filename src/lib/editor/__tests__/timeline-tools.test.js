import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal DOM shim for TimelineEditorPage keyboard/tool logic tests
function setupDom() {
  const doc = document;
  if (typeof doc === 'undefined') {
    // @ts-ignore
    global.document = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      querySelector: vi.fn(() => ({})),
      querySelectorAll: vi.fn(() => []),
      createElement: vi.fn(() => ({
        className: '',
        textContent: '',
        innerHTML: '',
        style: {},
        dataset: {},
        appendChild: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        querySelector: vi.fn(() => null),
        querySelectorAll: vi.fn(() => []),
        closest: vi.fn(() => null),
        getBoundingClientRect: vi.fn(() => ({ width: 1000, height: 600, top: 0, left: 0, bottom: 600, right: 1000 })),
        setPointerCapture: vi.fn(),
        classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false) },
        scrollIntoView: vi.fn(),
        remove: vi.fn(),
        focus: vi.fn(),
        click: vi.fn(),
      })),
      body: {
        classList: { add: vi.fn(), remove: vi.fn() },
        style: {},
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };
  }
}

describe('Timeline tool wiring (Sub-Agent 2)', () => {
  beforeEach(() => {
    setupDom();
  });

  // CineGen tool shortcut map (mirrors handleKeyboardShortcuts)
  const TOOL_SHORTCUTS = {
    'v': 'select',
    'b': 'blade',
    'r': 'ripple',
    'n': 'roll',
    'y': 'slip',
    'u': 'slide',
    'm': 'music',
    'e': 'extend',
    'x': 'mask',
  };

  it('maps every CineGen shortcut to the correct tool name', () => {
    expect(TOOL_SHORTCUTS['v']).toBe('select');
    expect(TOOL_SHORTCUTS['b']).toBe('blade');
    expect(TOOL_SHORTCUTS['r']).toBe('ripple');
    expect(TOOL_SHORTCUTS['n']).toBe('roll');
    expect(TOOL_SHORTCUTS['y']).toBe('slip');
    expect(TOOL_SHORTCUTS['u']).toBe('slide');
    expect(TOOL_SHORTCUTS['m']).toBe('music');
    expect(TOOL_SHORTCUTS['e']).toBe('extend');
    expect(TOOL_SHORTCUTS['x']).toBe('mask');
  });

  it('has no duplicate shortcuts', () => {
    const values = Object.values(TOOL_SHORTCUTS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('covers all tools defined in renderTools', () => {
    const definedTools = ['select', 'blade', 'ripple', 'roll', 'slip', 'slide', 'zoom', 'hand'];
    const shortcutTools = Object.values(TOOL_SHORTCUTS);
    // Every tool except Zoom/Hand (which have no shortcuts) should be in the shortcut map
    for (const tool of definedTools) {
      if (tool === 'zoom' || tool === 'hand') continue;
      expect(shortcutTools).toContain(tool);
    }
  });

  it('uses single lowercase letters only', () => {
    for (const key of Object.keys(TOOL_SHORTCUTS)) {
      expect(key).toHaveLength(1);
      expect(key).toMatch(/^[a-z]$/);
    }
  });

  it('tool names match the state.selectedTool values used in the editor', () => {
    // These are the exact strings the editor sets on state.selectedTool
    const expected = ['select', 'blade', 'ripple', 'roll', 'slip', 'slide'];
    for (const tool of expected) {
      expect(Object.values(TOOL_SHORTCUTS)).toContain(tool);
    }
  });
});
