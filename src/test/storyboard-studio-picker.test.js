import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/studioChrome.js', () => ({ mountStudioChrome: vi.fn() }));
vi.mock('../lib/clerkEntitlements.js', () => ({ requireEntitlement: vi.fn(async () => true) }));
vi.mock('../lib/editor/persistence.js', () => ({
  createAutosave: () => ({ schedule: vi.fn(), load: vi.fn(async () => null) }),
  saveProject: vi.fn(), loadProject: vi.fn(),
}));

import { StoryboardStudio } from '../components/StoryboardStudio.js';
import { t2iModels } from '../lib/models.js';

describe('Storyboard Studio real picker', () => {
  it('opens a connected model menu, applies a selection, and opens aspect ratios', async () => {
    const root = await StoryboardStudio();
    document.body.appendChild(root);
    try {
      root.querySelector('#model-btn').click();
      const model = t2iModels[1];
      const choice = [...root.querySelectorAll('button')].find(b => b.firstElementChild?.textContent === model.name);
      expect(choice).toBeDefined();
      expect(choice.isConnected).toBe(true);
      choice.click();
      expect(root.querySelector('#model-btn-label').textContent).toBe(model.name);
      root.querySelector('#ar-btn').click();
      expect([...root.querySelectorAll('div')].some(el => el.textContent === 'Aspect Ratio')).toBe(true);
    } finally {
      root.remove();
    }
  });
});
