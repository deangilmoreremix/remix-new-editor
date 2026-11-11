import { describe, expect, it } from 'vitest';
import { SLOW_MS_PER_FRAME, estimateExportSec, isSlowToExport, msPerFrame } from '../lib/exportCost';
import { buildCatalogBrief } from '../lib/directorPlan';
import { EXPORT_MS_PER_FRAME } from '../demosrc/_generated/exportCost';
import type { ProjectData } from '../types';

const clip = (cardId: string, start: number, duration: number) => ({ id: cardId + start, cardId, start, duration, inOffset: 0, speed: 1, opacity: 1, scale: 1, x: 0, y: 0, props: {} });
const project = (clips: ReturnType<typeof clip>[]): ProjectData => ({ name: 't', fps: 30, width: 1920, height: 1080, tracks: [{ id: 'a', name: 'a', clips }] });

describe('export cost', () => {
  it('has a measured cost for nearly every recipe, and some are slow', () => {
    expect(Object.keys(EXPORT_MS_PER_FRAME).length).toBeGreaterThan(130);
    expect(Object.values(EXPORT_MS_PER_FRAME).filter((v) => v >= SLOW_MS_PER_FRAME).length).toBeGreaterThan(10);
    expect(msPerFrame('NotARecipe')).toBe(150);
  });

  it('flags the slow recipes in the director\'s catalog', () => {
    const slow = Object.keys(EXPORT_MS_PER_FRAME).filter(isSlowToExport);
    const flagged = buildCatalogBrief().split('\n').filter((l) => l.includes('SLOW-EXPORT'));
    expect(flagged.length).toBe(slow.length);
  });

  it('estimates a film by summing what is on screen each frame, ignoring audio', () => {
    const light = Object.keys(EXPORT_MS_PER_FRAME).find((k) => EXPORT_MS_PER_FRAME[k] === 100) ?? 'PaperTitleCard';
    const secs = estimateExportSec(project([clip(`demo:${light}`, 0, 300), clip('audio-clip', 0, 300)]));
    expect(secs).toBe(Math.round((300 * msPerFrame(light)) / 1000));
    expect(estimateExportSec(project([clip(`demo:${light}`, 0, 30), clip(`demo:${light}`, 15, 30)]))).toBe(Math.round((60 * msPerFrame(light)) / 1000));
  });
});
