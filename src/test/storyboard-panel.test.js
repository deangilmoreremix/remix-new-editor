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
});
