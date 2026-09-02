import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/clerkEntitlements.js', () => ({
  requireEntitlement: vi.fn().mockResolvedValue(true),
}));

describe('StoryboardPanel', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders without throwing when a frame is selected', async () => {
    const mod = await import('../components/StoryboardPanel.js');
    const root = mod.StoryboardPanel();
    expect(root).toBeDefined();
    expect(root.innerHTML).toBeTruthy();
  });

  it('marks the selected shot button as active', async () => {
    const mod = await import('../components/StoryboardPanel.js');
    const root = mod.StoryboardPanel();
    const shotButtons = root.querySelectorAll('.sb-shot');
    expect(shotButtons.length).toBeGreaterThan(0);
    const activeButtons = [...shotButtons].filter((btn) =>
      btn.classList.contains('bg-primary')
    );
    expect(activeButtons.length).toBe(1);
  });
});
