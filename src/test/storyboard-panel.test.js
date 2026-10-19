import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/clerkEntitlements.js', () => ({
  requireEntitlement: vi.fn().mockResolvedValue(true),
}));

describe('StoryboardPanel', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // Importing StoryboardPanel pulls in the real module graph
  // (directorAgentRuntime -> muapi -> models.js, a ~290KB auto-generated model
  // catalog). Under vitest's transform that cold import takes ~8-10s, so these
  // tests need a budget well above the 5s default (same pattern as
  // edit-studio-integration.test.js / personalizer.test.js).
  it('renders without throwing when a frame is selected', async () => {
    const mod = await import('../components/StoryboardPanel.js');
    const root = mod.StoryboardPanel();
    expect(root).toBeDefined();
    expect(root.innerHTML).toBeTruthy();
  }, 30000);

  it('marks the selected shot button as active', async () => {
    const mod = await import('../components/StoryboardPanel.js');
    const root = mod.StoryboardPanel();
    const shotButtons = root.querySelectorAll('.sb-shot');
    expect(shotButtons.length).toBeGreaterThan(0);
    const activeButtons = [...shotButtons].filter((btn) =>
      btn.classList.contains('btn-secondary-modern')
    );
    expect(activeButtons.length).toBe(1);
  }, 30000);

  // Regression test: generateStoryboardFromIntent destructures `intent` with a
  // `model = t2iModels[0]?.id` default. The `t2iModels` import was missing from
  // src/lib/storyboardEngine.js, so every call without an explicit `model`
  // (as src/components/StoryboardStudio.js:424 makes) threw
  // `ReferenceError: t2iModels is not defined`. Same cold-import budget as the
  // tests above since storyboardEngine.js pulls in models.js.
  it('generateStoryboardFromIntent does not throw ReferenceError when called without a model argument', async () => {
    const { generateStoryboardFromIntent } = await import('../lib/storyboardEngine.js');
    const intent = {
      subject: 'A cinematic product launch',
      videoType: 'commercial',
      duration: 30,
      aspectRatio: '16:9',
      tone: 'cinematic',
      targetAudience: 'early adopters',
      // model intentionally omitted to exercise the t2iModels[0]?.id default
    };
    const result = await generateStoryboardFromIntent(intent, { generateImages: false });
    expect(result).toBeDefined();
    expect(result.frames.length).toBe(Math.round(30 / 5));
    expect(result.frames.every((frame) => typeof frame.prompt === 'string' && frame.prompt.length > 0)).toBe(true);
    expect(result.metadata.subject).toBe('A cinematic product launch');
  }, 30000);
});
