import { describe, it, expect } from 'vitest';
import { CAPTION_PRESETS, CAPITE_PRESETS, defaultCaptionStyle } from '../captions.js';
import { collectFonts } from '../timelineToComposition.js';

describe('Capite caption presets in the timeline editor', () => {
  it('adds all 27 looks next to the original five without changing them', () => {
    expect(Object.keys(CAPITE_PRESETS)).toHaveLength(27);
    expect(Object.keys(CAPTION_PRESETS)).toEqual(['tiktok', 'classic', 'box', 'karaoke', 'minimal']);
    expect(Object.keys(CAPITE_PRESETS).every((k) => k.startsWith('capite-'))).toBe(true);
  });
  it('builds a full style from a Capite look, and the group name is not stored on it', () => {
    const s = defaultCaptionStyle('capite-hormozi');
    expect(s.preset).toBe('capite-hormozi');
    expect(s).toMatchObject({ fontFamily: 'Montserrat', highlightColor: '#00FFFF', stroke: true, strokeColor: '#000000', highlightActive: true });
    expect(s.group).toBeUndefined();
    expect(s.label).toBeUndefined();
  });
  it('an unknown preset still falls back to the default look', () => {
    expect(defaultCaptionStyle('capite-nope').preset).toBe('tiktok');
  });
  it('box and karaoke looks carry the flags the renderer reads', () => {
    expect(defaultCaptionStyle('capite-crimson-pop').boxed).toBe(true);
    expect(defaultCaptionStyle('capite-karaoke').karaoke).toBe(true);
    expect(defaultCaptionStyle('capite-hormozi').boxed).toBe(false);
  });
  it('the look\'s font is loaded for the render', () => {
    expect(collectFonts([{ kind: 'captions', style: defaultCaptionStyle('capite-cyberpunk') }])).toContain('Orbitron');
  });
});
