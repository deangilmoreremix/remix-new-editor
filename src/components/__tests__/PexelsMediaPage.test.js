import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PexelsMediaPage } from '../PexelsMediaPage.js';

describe('PexelsMediaPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('renders a container element', () => {
    const container = PexelsMediaPage();
    expect(container.tagName).toBe('DIV');
    expect(container.className).toContain('bg-app-bg');
  });

  it('returns a container with expected structure', () => {
    const container = PexelsMediaPage();
    expect(container.children.length).toBeGreaterThan(0);
    // Should have topBar, gridArea, previewOverlay etc.
    const hasGrid = Array.from(container.children).some(c => c.className && c.className.includes('overflow-y-auto'));
    expect(hasGrid).toBe(true);
  });
});
