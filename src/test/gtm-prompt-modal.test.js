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
    gtmStructuredToText: (p) => (p ? (p.finalPrompt || `HOOK: ${p.hook || ''}`) : ''),
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
    expect(modal.footerContent).toContain('data-action="generate"');
    expect(modal.renderFooter()).toContain('Boost Video prompt');
  });

  it('labels the modal and the generate button for the studio that opened it', () => {
    const image = new GTMPromptModal({ appTheme: 'image-studio' });
    expect(image.title).toBe('🎯 GTM Boost · Image Studio');
    expect(image.renderFooter()).toContain('Boost Image prompt');
    expect(image.renderBody()).toContain('Image idea');

    const avatar = new GTMPromptModal({ appTheme: 'avatar-studio' });
    expect(avatar.renderFooter()).toContain('Boost Avatar script');
    expect(avatar.renderBody()).toContain('What should the presenter say?');

    const audio = new GTMPromptModal({ appTheme: 'audio-studio' });
    expect(audio.renderFooter()).toContain('Boost Audio brief');
  });

  it('pre-fills the idea box from the studio prompt', () => {
    const modal = new GTMPromptModal({ appTheme: 'image-studio', basePrompt: '  neon sneaker ad  ' });
    expect(modal.basePrompt).toBe('neon sneaker ad');
    expect(modal.renderBody()).toContain('neon sneaker ad');
  });

  it('uses the template output type to pick the profile in template studios', () => {
    const modal = new GTMPromptModal({ appTheme: 'template-studio', templateContext: { outputType: 'image' } });
    expect(modal.profile.kind).toBe('image');
    expect(modal._gtmParams().outputType).toBe('image');
  });

  it('shows inline error when base prompt is empty (no freeze)', async () => {
    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});
    await modal.handleGenerate();
    expect(modal.errorMessage).toBe('Add your video prompt idea first.');
    expect(modal.isGenerating).toBe(false);
    refreshSpy.mockRestore();
  });

  it('falls back to a studio-shaped local prompt when the AI call fails (no freeze)', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    vi.mocked(gtmResponses.streamGTMPrompt).mockRejectedValueOnce(new Error('network down'));
    const modal = new GTMPromptModal({ appTheme: 'image-studio' });
    modal.overlay = fakeOverlay;
    modal.basePrompt = 'a chef';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});
    await modal.handleGenerate();
    expect(modal.generatedPrompt.startsWith('a chef.')).toBe(true);
    // Image fallback must read like a still-image prompt, never a video outline.
    expect(modal.generatedPrompt).not.toMatch(/storybeat|camera move|dolly|audio/i);
    expect(modal.isLocalResult).toBe(true);
    expect(modal.errorMessage).toContain('network down');
    expect(modal.isGenerating).toBe(false);
    refreshSpy.mockRestore();
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
    expect(modalYes.renderBody()).toContain('🎨 Make Thumbnail');
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
      fakeOverlay._body.innerHTML = '<button data-action="generate-thumbnail">🎨 Make Thumbnail</button>';
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
    // Legacy (video-outline) results are normalized into the studio shape.
    expect(modal.generatedStructured.cta).toBe('Sign up now');
    expect(modal.generatedStructured.sections.map((x) => x.label)).toContain('Hook');
    expect(modal.generatedPrompt).toContain('A bold opening');
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
    expect(modal.renderGenerationProgress()).toContain('Finalizing');
  });

  it('applies the ready-to-use finalPrompt, not the breakdown', async () => {
    const structured = {
      finalPrompt: 'Hero shot of a ceramic mug on travertine, morning side light',
      angle: 'Quiet luxury for remote workers',
      sections: [{ label: 'Concept', content: 'Calm morning ritual' }],
      cta: 'Shop the mug',
      estimatedDurationSec: 0,
    };
    gtmResponses.streamGTMPrompt.mockResolvedValue({ prompt: structured, responseId: 'resp_9', usage: null });
    const modal = new GTMPromptModal({ appTheme: 'image-studio' });
    modal.overlay = fakeOverlay;
    modal.basePrompt = 'mug';
    vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});
    await modal.handleGenerate();
    expect(modal.generatedPrompt).toBe(structured.finalPrompt);
    expect(gtmResponses.streamGTMPrompt.mock.calls[0][0].appTheme).toBe('image-studio');
    const html = modal.renderGeneratedPrompt();
    // The GTM brief is the main result; the clean prompt sits under it.
    expect(html).toContain('Your GTM brief');
    expect(html).toContain('Calm morning ritual');
    expect(html).toContain('Clean prompt for Image Studio');
    expect(html).toContain('Apply full brief');
    expect(html).toContain('Apply as clean prompt');
  });

  it('Apply full brief sends every brief section and the CTA', async () => {
    const onGen = vi.fn();
    const modal = new GTMPromptModal({ appTheme: 'video-studio', onPromptGenerated: onGen });
    modal.overlay = fakeOverlay;
    modal.close = vi.fn();
    modal._setResult({
      prompt: {
        finalPrompt: 'One flowing shot',
        angle: 'x',
        sections: [{ label: 'Hook', content: 'Splash' }, { label: 'Story beat 1', content: 'Rooftop' }],
        cta: 'Get 2 free',
        estimatedDurationSec: 20,
      },
    });
    await modal.handleApplyBrief();
    const sent = onGen.mock.calls[0][0];
    expect(sent).toContain('HOOK: Splash');
    expect(sent).toContain('STORY BEAT 1: Rooftop');
    expect(sent).toContain('CALL TO ACTION: Get 2 free');
    expect(sent).toContain('ESTIMATED DURATION: 20s');
    expect(modal.close).toHaveBeenCalled();
  });

  it('video studios use the landing-page brief labels', () => {
    const modal = new GTMPromptModal({ appTheme: 'video-studio' });
    expect(modal.profile.sections).toEqual(['Hook', 'Story beat 1', 'Story beat 2', 'Story beat 3', 'Visual direction', 'Audio direction', 'Call to action']);
  });

  it('the offline template has no brief, so only the clean prompt can be applied', () => {
    const modal = new GTMPromptModal({ appTheme: 'image-studio' });
    modal.basePrompt = 'mug';
    modal._setLocalResult();
    const html = modal.renderGeneratedPrompt();
    expect(html).not.toContain('apply-brief');
    expect(html).toContain('Apply to Image Studio');
  });

  it('handleGenerate falls back to a local prompt per studio when streaming throws', async () => {
    gtmResponses.streamGTMPrompt.mockRejectedValue(new Error('boom'));
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);

    for (const theme of ['video-studio', 'image-studio', 'avatar-studio', 'audio-studio', 'storyboard-studio']) {
      const modal = new GTMPromptModal({ appTheme: theme });
      modal.overlay = fakeOverlay;
      modal.basePrompt = 'a chef';
      vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});
      await modal.handleGenerate();
      expect(modal.generatedPrompt.length).toBeGreaterThan(10);
      expect(modal.generatedPrompt).toContain('a chef');
      expect(modal.isGenerating).toBe(false);
    }
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
    expect(modal.generatedStructured.angle).toBe('v1');
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
    expect(modal.generatedStructured.angle).toBe('v2');
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

    expect(gtmResponses.refineGTMPrompt).toHaveBeenCalledWith('resp_1', 'make the hook bolder', expect.objectContaining({ model: expect.any(String), appTheme: 'timeline-editor' }));
    expect(modal.generatedStructured.angle).toBe('refined');
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
    const modal = new GTMPromptModal();
    modal.overlay = fakeOverlay;
    modal.basePrompt = 'a chef';
    const refreshSpy = vi.spyOn(modal, 'refreshBody').mockImplementation(() => {});

    await modal.handleGenerate();
    expect(modal.missingOpenAIKey).toBe(true);
    // A missing key is not an "error" — just the CTA plus the local result.
    expect(modal.errorMessage).toBe('');
    expect(modal.generatedPrompt).toContain('a chef');
    refreshSpy.mockRestore();
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
