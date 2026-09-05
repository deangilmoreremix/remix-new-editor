import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  supabase: { functions: { invoke: vi.fn() } },
  isSupabaseConfigured: vi.fn(() => true),
  getSupabaseUrl: vi.fn(),
  getUserKey: vi.fn(),
}));

// Mock the OpenAI Responses API client so generation tests never hit the network.
// NOTE: vi.mock is hoisted, so the mock object is defined inside the factory.
vi.mock('../lib/gtmResponses.js', async (importOriginal) => {
  const actual = await importOriginal();
  const gtmResponsesMock = {
    streamGTMPrompt: vi.fn(),
    generateGTMPrompt: vi.fn(),
    refineGTMPrompt: vi.fn(),
    generateGTMVariants: vi.fn(),
    gtmStructuredToText: (p) => (p ? `HOOK: ${p.hook || ''}` : ''),
  };
  return {
    ...actual,
    gtmResponses: gtmResponsesMock,
    gtmStructuredToText: gtmResponsesMock.gtmStructuredToText,
    resolveGtmModel: actual.resolveGtmModel || ((id) => id || 'gpt-4.1-mini'),
    GTM_MODEL_OPTIONS: actual.GTM_MODEL_OPTIONS || [],
  };
});

import { GTMPromptModal } from '../components/modals/GTMPromptModal.jsx';
import { gtmContentLibrary } from '../lib/gtmContentLibrary.js';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { gtmResponses } from '../lib/gtmResponses.js';
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

describe('GTM Responses API features', () => {
  let fakeOverlay;

  beforeEach(() => {
    fakeOverlay = makeFakeOverlay();
    vi.mocked(gtmResponses.streamGTMPrompt).mockReset();
    vi.mocked(gtmResponses.generateGTMVariants).mockReset();
    vi.mocked(gtmResponses.refineGTMPrompt).mockReset();
  });

  it('handleGenerate uses streamed structured output and stores sections', async () => {
    const structured = {
      hook: 'A bold opening',
      storybeat_1: 'Beat one',
      storybeat_2: 'Beat two',
      storybeat_3: 'Beat three',
      visualDirection: 'Cinematic',
      audioDirection: 'Tense score',
      cta: 'Sign up now',
      estimatedDurationSec: 45,
    };
    gtmResponses.streamGTMPrompt.mockImplementation(async (_params, { onDelta, onDone }) => {
      onDelta?.('{', '{');
      onDone?.({ prompt: structured, responseId: 'resp_1', usage: { inputTokens: 10, outputTokens: 20 } });
      return { prompt: structured, responseId: 'resp_1', usage: { inputTokens: 10, outputTokens: 20 } };
    });

    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.basePrompt = 'a chef';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});

    await modal.handleGenerate();

    expect(gtmResponses.streamGTMPrompt).toHaveBeenCalledTimes(1);
    expect(modal.generatedStructured).toEqual(structured);
    expect(modal.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(modal.responseId).toBe('resp_1');
    expect(modal.isGenerating).toBe(false);
    refreshSpy.mockRestore();
  });

  it('5-step progress bar advances from real streamed data (no timer)', async () => {
    // Simulate the Responses API streaming raw JSON tokens incrementally.
    gtmResponses.streamGTMPrompt.mockImplementation(async (_params, { onDelta, onDone }) => {
      // Step 1 of 5: only the hook field has streamed in.
      onDelta?.('{"hook":"A bold opening hook','storybeat_1"', '{"hook":"A bold opening hook","storybeat_1"');
      const mid = { hook: 'A bold opening hook', storybeat_1: 'beat one', storybeat_2: 'beat two' };
      onDelta?.(JSON.stringify(mid), JSON.stringify(mid));
      const done = { hook: 'A bold opening hook', storybeat_1: 'beat one', storybeat_2: 'beat two', storybeat_3: 'beat three', visualDirection: 'cinematic', audioDirection: 'tense', cta: 'sign up', estimatedDurationSec: 45 };
      onDone?.({ prompt: done, responseId: 'resp_1', usage: { inputTokens: 1, outputTokens: 2 } });
      return { prompt: done, responseId: 'resp_1', usage: { inputTokens: 1, outputTokens: 2 } };
    });

    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.basePrompt = 'a chef';
    // Don't mock refreshBody so computeGenerationStep is exercised on each delta.
    await modal.handleGenerate();

    // Because the stream delivered a complete structured object, step should be 4 (done).
    expect(modal.generationStep).toBe(4);
    expect(modal.renderGenerationProgress()).toContain('progress-step done');
    expect(modal.renderGenerationProgress()).toContain('Finalizing cinematic prompt');
  });

  it('handleGenerate falls back to local library when streaming throws', async () => {
    gtmResponses.streamGTMPrompt.mockRejectedValue(new Error('no key'));
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    const spy = vi.spyOn(gtmContentLibrary, 'generateOptimizedPrompt').mockReturnValue('local fallback prompt');

    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.basePrompt = 'a chef';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});

    await modal.handleGenerate();

    expect(modal.generatedPrompt).toBe('local fallback prompt');
    expect(modal.isGenerating).toBe(false);
    spy.mockRestore();
    refreshSpy.mockRestore();
  });

  it('handleGenerateVariants populates variant list and selects first', async () => {
    const v1 = { hook: 'v1', storybeat_1: 'a', storybeat_2: 'b', storybeat_3: 'c', visualDirection: 'x', audioDirection: 'y', cta: 'z', estimatedDurationSec: 30 };
    const v2 = { hook: 'v2', storybeat_1: 'a', storybeat_2: 'b', storybeat_3: 'c', visualDirection: 'x', audioDirection: 'y', cta: 'z', estimatedDurationSec: 30 };
    gtmResponses.generateGTMVariants.mockResolvedValue([
      { prompt: v1, responseId: 'r1', usage: null },
      { prompt: v2, responseId: 'r2', usage: null },
    ]);

    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.basePrompt = 'a chef';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});

    await modal.handleGenerateVariants();

    expect(gtmResponses.generateGTMVariants).toHaveBeenCalledTimes(1);
    expect(modal.variants).toHaveLength(2);
    expect(modal.selectedVariantIndex).toBe(0);
    expect(modal.generatedStructured).toEqual(v1);
    refreshSpy.mockRestore();
  });

  it('selectVariant switches the active structured prompt', async () => {
    const v1 = { hook: 'v1', storybeat_1: 'a', storybeat_2: 'b', storybeat_3: 'c', visualDirection: 'x', audioDirection: 'y', cta: 'z', estimatedDurationSec: 30 };
    const v2 = { hook: 'v2', storybeat_1: 'a', storybeat_2: 'b', storybeat_3: 'c', visualDirection: 'x', audioDirection: 'y', cta: 'z', estimatedDurationSec: 30 };

    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.variants = [
      { prompt: v1, responseId: 'r1', usage: null },
      { prompt: v2, responseId: 'r2', usage: null },
    ];
    modal.selectedVariantIndex = 0;
    modal._setResult(modal.variants[0]);

    modal.selectVariant(1);
    expect(modal.selectedVariantIndex).toBe(1);
    expect(modal.generatedStructured).toEqual(v2);
  });

  it('handleRefine uses previous_response_id for multi-turn', async () => {
    const refined = { hook: 'refined', storybeat_1: 'a', storybeat_2: 'b', storybeat_3: 'c', visualDirection: 'x', audioDirection: 'y', cta: 'z', estimatedDurationSec: 30 };
    gtmResponses.refineGTMPrompt.mockResolvedValue({ prompt: refined, responseId: 'resp_2', usage: null });

    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.basePrompt = 'a chef';
    modal.responseId = 'resp_1';
    modal.refineInstruction = 'make the hook bolder';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});

    await modal.handleRefine();

    expect(gtmResponses.refineGTMPrompt).toHaveBeenCalledWith('resp_1', 'make the hook bolder', expect.objectContaining({ model: expect.any(String) }));
    expect(modal.generatedStructured).toEqual(refined);
    expect(modal.responseId).toBe('resp_2');
    refreshSpy.mockRestore();
  });

  it('handleRefine shows error when no previous response exists', async () => {
    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.basePrompt = 'a chef';
    modal.responseId = '';
    modal.refineInstruction = 'tweak it';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});

    await modal.handleRefine();
    expect(modal.errorMessage).toContain('No previous response to refine');
    refreshSpy.mockRestore();
  });

  // --- Real GTM skill examples panel (show + click-to-use) ---

  it('renderSkillExamples returns empty when no examples', () => {
    const modal = new GTMPromptModal();
    modal.skillExamples = [];
    expect(modal.renderSkillExamples()).toBe('');
  });

  it('refreshSkillExamples populates and renderSkillExamples shows cards', () => {
    const modal = new GTMPromptModal();
    modal.selectedRole = 'ae';
    modal.selectedIndustry = 'saas';
    modal.selectedMethodology = 'meddpicc';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});
    modal.refreshSkillExamples();
    expect(Array.isArray(modal.skillExamples)).toBe(true);
    expect(modal.skillExamples.length).toBeGreaterThan(0);
    const html = modal.renderSkillExamples();
    expect(html).toContain('gtm-example-card');
    expect(html).toContain('use-example');
    refreshSpy.mockRestore();
  });

  it('handleUseExample seeds basePrompt with the example prompt', () => {
    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.skillExamples = [
      { id: 'ex-1', title: 'Demo Script', prompt: 'Write a demo script for [PRODUCT].' },
    ];
    modal.basePrompt = '';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});
    modal.handleUseExample('ex-1');
    expect(modal.basePrompt).toContain('Write a demo script for [PRODUCT]');
    refreshSpy.mockRestore();
  });

  it('handleUseExample appends when basePrompt already has text', () => {
    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.skillExamples = [
      { id: 'ex-2', title: 'Cold Email', prompt: 'Craft a cold email.' },
    ];
    modal.basePrompt = 'Existing idea.';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});
    modal.handleUseExample('ex-2');
    expect(modal.basePrompt).toContain('Existing idea.');
    expect(modal.basePrompt).toContain('Craft a cold email.');
    refreshSpy.mockRestore();
  });

  // --- Missing API key CTA ---

  it('shows the add-API-key CTA when missingOpenAIKey is set', () => {
    const modal = new GTMPromptModal();
    modal.missingOpenAIKey = true;
    expect(modal.renderBody()).toContain('open-key-modal');
    expect(modal.renderBody()).toContain('Add API Key');
  });

  it('handleGenerate sets missingOpenAIKey when the key is unconfigured', async () => {
    gtmResponses.streamGTMPrompt.mockRejectedValue(new Error('OpenAI API key not configured'));
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    const spy = vi.spyOn(gtmContentLibrary, 'generateOptimizedPrompt').mockReturnValue('fallback');
    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.basePrompt = 'a chef';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});

    await modal.handleGenerate();
    expect(modal.missingOpenAIKey).toBe(true);
    expect(modal.generatedPrompt).toBe('fallback');
    refreshSpy.mockRestore();
    spy.mockRestore();
  });

  // --- Stop / copy / paste ---

  it('handleStop aborts an in-flight generation and resets state', () => {
    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.isGenerating = true;
    const controller = { abort: vi.fn() };
    modal.abortController = controller;
    modal.handleStop();
    expect(controller.abort).toHaveBeenCalled();
    expect(modal.isGenerating).toBe(false);
    expect(modal.streamingText).toBe('');
  });

  it('handleCopyOnly copies current prompt text without closing', async () => {
    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.generatedPrompt = 'a chef plating a dish';
    await modal.handleCopyOnly();
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('a chef plating a dish');
  });

  it('handleCopyPrompt fires onPromptGenerated and closes', async () => {
    const onGen = vi.fn();
    const modal = new GTMPromptModal({ onPromptGenerated: onGen });
    modal.overlay = fakeOverlay;
    modal.generatedPrompt = 'a cinematic chef';
    modal.close = vi.fn();
    await modal.handleCopyPrompt();
    expect(onGen).toHaveBeenCalledWith('a cinematic chef');
    expect(modal.close).toHaveBeenCalled();
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

  it('VideoStudio and ImageStudio import mountPersonalizeTrigger, not the deprecated alias', async () => {
    const videoSrc = fs.readFileSync(path.join(root, 'src/components/VideoStudio.js'), 'utf8');
    const imageSrc = fs.readFileSync(path.join(root, 'src/components/ImageStudio.js'), 'utf8');

    expect(videoSrc).toContain('import { mountPersonalizeTrigger, replaceTokensInPrompt } from \'./personalize/personalizePopover.js\'');
    expect(imageSrc).toContain('import { mountPersonalizeTrigger, replaceTokensInPrompt } from \'./personalize/personalizePopover.js\'');

    expect(videoSrc).not.toContain('mountPersonalizePopover');
    expect(imageSrc).not.toContain('mountPersonalizePopover');
  });
});
