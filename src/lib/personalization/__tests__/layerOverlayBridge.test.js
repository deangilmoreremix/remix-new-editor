import { describe, it, expect } from 'vitest';
import { layersToTimelineOverlays, timelineOverlaysToLayers, isBridgeable, BRIDGE_SOURCE } from '../layerOverlayBridge.js';

const settings = { fps: 30, durationInFrames: 300, width: 1920, height: 1080 };
const base = (over = {}) => ({ animation: 'none', animationDelay: 0, startFrame: 0, opacity: 1, visible: true, ...over });
const logo = base({ id: 'logo', kind: 'logo', x: 0.85, y: 0.3, scale: 0.15 });
const headline = base({ id: 'headline', kind: 'headline', x: 0.5, y: 0.5, scale: 0.06, startFrame: 30, endFrame: 150, color: '#ffffff' });
const design = base({ id: 'design', kind: 'design', x: 0.5, y: 0.5, scale: 0.5 });
const hidden = base({ id: 'offer', kind: 'offer', x: 0.5, y: 0.8, scale: 0.05, visible: false });
const layers = [logo, headline, design, hidden];
const near = (a, b, d = 2) => expect(a).toBeCloseTo(b, d);

describe('layersToTimelineOverlays', () => {
  const items = layersToTimelineOverlays(layers, settings);
  it('bridges only visible image/text layers', () => {
    expect(items.map((i) => i.layerId)).toEqual(['logo', 'headline']);
    expect(isBridgeable(design)).toBe(false);
    expect(isBridgeable(hidden)).toBe(false);
  });
  it('makes a token-driven Personalized Image for the logo', () => {
    const i = items[0];
    expect(i).toMatchObject({ type: 'overlay-personalized-image', source: BRIDGE_SOURCE, startSec: 0, endSec: 10 });
    expect(i.addon.src).toBe('{{logoUrl}}');
    near(i.addon.geometry.width, 15, 1); // scale .15 of the width
  });
  it('turns frames into seconds and uses a brand token for text', () => {
    expect(items[1]).toMatchObject({ type: 'overlay-text', startSec: 1, endSec: 5 });
    expect(items[1].addon.text).toBe('{{ctaHeadline}}');
  });
  it('keeps literal layer text', () => {
    const [i] = layersToTimelineOverlays([{ ...headline, text: 'Spring sale' }], settings);
    expect(i.addon.text).toBe('Spring sale');
  });
});

describe('timelineOverlaysToLayers', () => {
  it('round-trips untouched overlays', () => {
    const items = layersToTimelineOverlays(layers, settings);
    const back = timelineOverlaysToLayers(items, layers, settings);
    const find = (id) => back.find((l) => l.id === id);
    near(find('logo').x, 0.85, 2); near(find('logo').y, 0.3, 2); near(find('logo').scale, 0.15, 2);
    near(find('headline').scale, 0.06, 2); near(find('headline').x, 0.5, 2);
    expect(find('headline')).toMatchObject({ startFrame: 30, endFrame: 150 });
    expect(find('design')).toBe(design);
    expect(find('offer').visible).toBe(false);
  });
  it('an out-of-frame logo comes back where it is actually drawn (safe-area clamp), not off-screen', () => {
    const off = base({ id: 'logo', kind: 'logo', x: 0.85, y: 0.12, scale: 0.15 });
    const back = timelineOverlaysToLayers(layersToTimelineOverlays([off], settings), [off], settings)[0];
    expect(back.y).toBeGreaterThan(0.12);
    near(back.y, (0.02 * 1080 + 144) / 1080, 2);
  });
  it('applies a timeline edit (moved and resized logo, new timing)', () => {
    const items = layersToTimelineOverlays(layers, settings);
    items[0].addon.geometry = { left: 10, top: 20, width: 20, height: 35.56 };
    items[0].startSec = 2; items[0].endSec = 6;
    const logoBack = timelineOverlaysToLayers(items, layers, settings).find((l) => l.id === 'logo');
    near(logoBack.scale, 0.2, 3);
    near(logoBack.x, 0.2, 3); // left 10% + half of a 20%-wide box
    near(logoBack.y, ((0.2 * 1080) + 192) / 1080, 2);
    expect(logoBack).toMatchObject({ startFrame: 60, endFrame: 180 });
  });
  it('hides a layer whose overlay was deleted, and ignores untagged clips', () => {
    const items = layersToTimelineOverlays(layers, settings).filter((i) => i.layerId !== 'logo');
    items.push({ type: 'overlay-text', addon: { geometry: {} } });
    const back = timelineOverlaysToLayers(items, layers, settings);
    expect(back.find((l) => l.id === 'logo').visible).toBe(false);
    expect(back.find((l) => l.id === 'headline').visible).toBe(true);
  });
  it('only a literal edit becomes layer text, a token stays the brand text', () => {
    const items = layersToTimelineOverlays(layers, settings);
    expect(timelineOverlaysToLayers(items, layers, settings).find((l) => l.id === 'headline').text).toBeUndefined();
    items[1].addon.text = 'Big news';
    expect(timelineOverlaysToLayers(items, layers, settings).find((l) => l.id === 'headline').text).toBe('Big news');
  });
});
