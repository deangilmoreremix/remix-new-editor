import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  supabase: { functions: { invoke: vi.fn() } },
  isSupabaseConfigured: vi.fn(() => true),
  getSupabaseUrl: vi.fn(),
  getUserKey: vi.fn(),
}));

import { GTMPromptModal } from '../components/modals/GTMPromptModal.jsx';
import { gtmContentLibrary } from '../lib/gtmContentLibrary.js';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { openGTMPromptModal } from '../lib/uiIntegration.js';
import fs from 'node:fs';
import path from 'node:path';

// A element stub that returns self for querySelector and [] for querySelectorAll.
// This ensures nothing ever gets `null.querySelector`.
const makeSafeEl = () => {
  const el = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) },
    style: {},
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    getAttribute: vi.fn(() => null),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
    click: vi.fn(),
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    dataset: {},
    type: '',
  };
  el.querySelector = vi.fn(() => makeSafeEl());
  el.querySelectorAll = vi.fn(() => []);
  return el;
};

const makeFakeOverlay = () => {
  const body = makeSafeEl();
  const overlay = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  overlay.querySelector = vi.fn((sel) => {
    if (sel === '.modal-body') return body;
    return makeSafeEl();
  });
  overlay.querySelectorAll = vi.fn(() => []);
  overlay._body = body;
  return overlay;
};

describe('GTMPromptModal', () => {
  let fakeOverlay;

  beforeEach(() => {
    fakeOverlay = makeFakeOverlay();
    global.window = {
      CustomEvent: class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts?.detail || {}; } },
      dispatchEvent: vi.fn(),
    };
    global.navigator = { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores and renders footer content (Generate button fix)', () => {
    const modal = new GTMPromptModal();
    expect(modal.footerContent).toContain('Generate Cinematic Prompt');
    expect(modal.renderFooter()).toContain('Generate Cinematic Prompt');
  });

  it('shows inline error when base prompt is empty (no freeze)', async () => {
    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});
    await modal.handleGenerate();
    expect(modal.errorMessage).toBe('Please describe your video idea first.');
    expect(modal.isGenerating).toBe(false);
    refreshSpy.mockRestore();
  });

  it('falls back to local library when supabase is unconfigured (no freeze)', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    const spy = vi.spyOn(gtmContentLibrary, 'generateOptimizedPrompt').mockReturnValue('local fallback prompt');
    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.basePrompt = 'a chef';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});
    await modal.handleGenerate();
    expect(modal.generatedPrompt).toBe('local fallback prompt');
    expect(modal.isGenerating).toBe(false);
    refreshSpy.mockRestore();
    spy.mockRestore();
  });

  it('includes error banner in body when errorMessage is set', () => {
    const modal = new GTMPromptModal();
    modal.errorMessage = 'something broke';
    expect(modal.renderBody()).toContain('something broke');
  });

  it('replaces .modal-body in place via refreshBody (no silent no-op)', () => {
    const modal = new GTMPromptModal();
    const body = { innerHTML: '' };
    modal.overlay = {
      querySelector: vi.fn((sel) => (sel === '.modal-body' ? body : makeSafeEl())),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
    };
    const bindSpy = vi.spyOn(modal, 'bindBodyListeners').mockImplementation(() => {});
    modal.refreshBody();
    expect(body.innerHTML).toContain('gtm-prompt-modal');
    bindSpy.mockRestore();
  });

  it('does not throw during setupEventListeners (this.content bug fix)', () => {
    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    expect(() => modal.setupEventListeners()).not.toThrow();
  });

  // --- GTM ↔ Thumbnail bridge ---

  it('captures onGenerateThumbnail option in constructor', () => {
    const cb = vi.fn();
    const modal = new GTMPromptModal({ onGenerateThumbnail: cb });
    expect(modal.onGenerateThumbnail).toBe(cb);
  });

  it('renders the Generate Thumbnail button only when callback is provided', () => {
    const modalNo = new GTMPromptModal();
    modalNo.generatedPrompt = 'a cinematic shot of a chef plating';
    expect(modalNo.renderBody()).not.toContain('generate-thumbnail');

    const modalYes = new GTMPromptModal({ onGenerateThumbnail: vi.fn() });
    modalYes.generatedPrompt = 'a cinematic shot of a chef plating';
    expect(modalYes.renderBody()).toContain('generate-thumbnail');
    expect(modalYes.renderBody()).toContain('🎨 Generate Thumbnail');
  });

  it('handleGenerateThumbnail is a no-op without a callback', async () => {
    const modal = new GTMPromptModal();
    modal.generatedPrompt = 'x';
    modal.overlay = fakeOverlay;
    await expect(modal.handleGenerateThumbnail()).resolves.toBeUndefined();
  });

  it('handleGenerateThumbnail invokes callback and surfaces errors', async () => {
    const modal = new GTMPromptModal({
      onGenerateThumbnail: vi.fn().mockRejectedValue(new Error('upstream down')),
    });
    modal.generatedPrompt = 'test prompt';
    vi.spyOn(GTMPromptModal.prototype, 'refreshBody').mockImplementation(() => {
      fakeOverlay._body.innerHTML = '<button data-action="generate-thumbnail">🎨 Generate Thumbnail</button>';
    });
    modal.overlay = fakeOverlay;
    await modal.handleGenerateThumbnail();
    expect(modal.errorMessage).toContain('upstream down');
  });
});

describe('openGTMPromptModal integration', () => {
  it('is exported and opens without throwing', () => {
    expect(typeof openGTMPromptModal).toBe('function');
    const modal = openGTMPromptModal('timeline-editor', (prompt) => {});
    expect(modal).toBeTruthy();
  });

  it('passes onGenerateThumbnail to the modal', () => {
    const thumbFn = vi.fn();
    const modal = openGTMPromptModal('image-studio', () => {}, thumbFn);
    expect(modal.onGenerateThumbnail).toBe(thumbFn);
  });
});

describe('GTM premium studio integration', () => {
  const root = process.cwd();

  it('includes GTM Boost button in ImageStudio', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/ImageStudio.js'), 'utf8');
    expect(src).toContain('🎯 GTM Boost');
    expect(src).toContain('openGTMPromptModal');
    expect(src).toContain("'image-studio'");
  });

  it('includes GTM Boost button in VideoStudio', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/VideoStudio.js'), 'utf8');
    expect(src).toContain('🎯 GTM Boost');
    expect(src).toContain('openGTMPromptModal');
    expect(src).toContain("'video-studio'");
  });

  it('has GTM modal CSS imported globally', () => {
    const style = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
    expect(style).toContain('gtm-prompt-modal.css');
  });

  it('css has thumbnail-prompt-btn styles', () => {
    const css = fs.readFileSync(path.join(root, 'src/styles/gtm-prompt-modal.css'), 'utf8');
    expect(css).toContain('.thumbnail-prompt-btn');
    expect(css).toContain('.generated-prompt-actions');
  });
});
