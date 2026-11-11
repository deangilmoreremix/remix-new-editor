import { describe, it, expect } from 'vitest';
import { timelineFromRows } from '@/lib/db-converters';
import { newOverlay, isGateKind, overlayConfig, switchGateKind } from '@/lib/optin/overlay-kinds';

describe('opt-in overlay model', () => {
  it('List Builder / Personalizer are one locked gate at 0s; Lead Generator can go anywhere', () => {
    const lb = newOverlay('list-builder', 12);
    expect(isGateKind(lb.kind)).toBe(true);
    expect(lb.start).toBe(0);
    const lg = newOverlay('lead-generator', 12);
    expect(lg.start).toBe(12);
    expect(lg.end).toBeGreaterThan(lg.start);
    // never lands on top of the gate marker
    expect(newOverlay('lead-generator', 0, true).start).toBeGreaterThanOrEqual(3);
  });

  it('fills options a saved overlay predates, and switches gate kind with that kind\'s defaults', () => {
    const lb = { ...newOverlay('list-builder', 0), options: { caption: 'Join us' } };
    const cfg = overlayConfig(lb);
    expect(cfg).toMatchObject({ caption: 'Join us', pointerStyle: 'curly', backdropOpacity: 100, kind: 'list-builder' });
    const p = switchGateKind(lb, 'personalizer');
    expect(p.name).toBe('Personalizer');
    expect((p.options.elements as unknown[]).length).toBe(3);
  });

  it('overlays survive a save and reload of the timeline row', () => {
    const ov = newOverlay('lead-generator', 5);
    const row = { id: 't1', name: 'T', duration: 0, markers: '[]', overlays: JSON.stringify([ov]) };
    const tl = timelineFromRows(row, [], [], []);
    expect(tl.overlays).toEqual([ov]);
    // a project saved before overlays existed still loads
    expect(timelineFromRows({ id: 't2', name: 'T', duration: 0, markers: '[]' }, [], [], []).overlays).toEqual([]);
  });
});
