// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LiveStage } from '../components/edit/preview-card';
import type { CardPreview } from '../components/edit/preview-types';
import { createOverlay } from '../lib/overlays/overlays';

const clip = (() => {
  const o = createOverlay('overlay-text', 0, 10);
  (o.addon as Record<string, unknown>).text = 'Hi {{firstName}} from {{company}}';
  return o;
})();
const preview = { kind: 'overlay', build: () => [{ ...clip, start: 0, end: 5 }], duration: 5, still: 1 } as Extract<CardPreview, { kind: 'overlay' }>;
const ada = { id: 'c-ada', contact: { firstName: 'Ada', name: 'Ada L', company: 'Analytical Co' }, variables: {} };

describe('Overlays lane picture uses the previewed contact', () => {
  it('shows the contact\'s details, and the generic token chips without one', () => {
    const withContact = render(<LiveStage preview={preview} playing={false} profile={ada} profileVersion={1} />);
    expect(withContact.container.querySelector('.popcorn-text')?.textContent).toBe('Hi Ada from Analytical Co');
    withContact.unmount();
    const without = render(<LiveStage preview={preview} playing={false} />);
    expect(without.container.querySelector('.popcorn-text .personalized-token')).not.toBeNull(); // chips, as in the Add window's cards
    expect(without.container.querySelector('.popcorn-text')?.textContent).not.toContain('Ada');
  });
  it('redraws when the contact changes', () => {
    const { container, rerender } = render(<LiveStage preview={preview} playing={false} />);
    expect(container.querySelector('.popcorn-text')?.textContent).not.toContain('Ada');
    rerender(<LiveStage preview={preview} playing={false} profile={ada} profileVersion={2} />);
    expect(container.querySelector('.popcorn-text')?.textContent).toBe('Hi Ada from Analytical Co');
  });
});
