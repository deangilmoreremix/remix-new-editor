import { describe, it, expect } from 'vitest';
import '../index.js';
import { endScreenClips } from '../endScreenClips.js';

describe('classic End Screen result → clips', () => {
  it('applies the style (background, duration) and each button (text, link, position)', () => {
    const clips = endScreenClips({
      style: { backgroundColor: 'rgba(10,20,30,0.9)', textColor: '#ffffff', duration: 8 },
      buttons: [{ text: 'Subscribe', url: 'https://example.com/s', style: 'filled', position: 'bottom-right' }, { text: 'Watch More', url: '', style: 'outlined', position: 'center' }],
    }, 60, 100);
    expect(clips).toHaveLength(3);
    const [bg, a, b] = clips;
    expect(bg.type).toBe('overlay-background');
    expect(bg.addon.styles).toContain('rgba(10,20,30,0.9)');
    expect(bg.end).toBe(60);
    expect(bg.start).toBe(52);
    expect(a).toMatchObject({ type: 'click-to-call', buttonText: 'Subscribe', linkUrl: 'https://example.com/s' });
    expect(a.style.buttonColor).toBe('#22d3ee');
    expect(a.style.posLeft).toBeCloseTo(70);
    expect(b.style.buttonColor).toBe('transparent');
    clips.forEach((c) => { expect(c.end).toBeLessThanOrEqual(60); expect(c.end).toBeGreaterThan(c.start); });
  });
  it('buttons only: no background wrapper', () => {
    const clips = endScreenClips({ buttons: [{ text: 'Go', url: '', position: 'center' }] }, 30, 1);
    expect(clips.map((c) => c.type)).toEqual(['click-to-call']);
  });
});
