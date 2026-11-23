// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { demosHidden, setDemosHidden, DEMOS_HIDDEN_KEY, DEMOS_CHANGED_EVENT } from '../demo/demoPrefs.js';

const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };

afterEach(() => { setDemosHidden(false, { storage: store() }); });

describe('removing the demo videos', () => {
  it('starts with the demos shown', () => { expect(demosHidden(store())).toBe(false); });

  it('remembers the removal across reloads, and showing them again clears it', () => {
    const s = store();
    setDemosHidden(true, { storage: s });
    expect(s.getItem(DEMOS_HIDDEN_KEY)).toBe('1');
    expect(demosHidden(s)).toBe(true);
    setDemosHidden(false, { storage: s });
    expect(s.getItem(DEMOS_HIDDEN_KEY)).toBeNull();
    expect(demosHidden(s)).toBe(false);
  });

  it('tells the page, so every place that shows the demos updates', () => {
    const onChange = vi.fn();
    window.addEventListener(DEMOS_CHANGED_EVENT, onChange);
    setDemosHidden(true, { storage: store() });
    setDemosHidden(false, { storage: store() });
    expect(onChange).toHaveBeenCalledTimes(2);
    window.removeEventListener(DEMOS_CHANGED_EVENT, onChange);
  });

  it('still works for the visit when browser storage is blocked', () => {
    setDemosHidden(true, { storage: blocked });
    expect(demosHidden(blocked)).toBe(true);
    setDemosHidden(false, { storage: blocked });
    expect(demosHidden(blocked)).toBe(false);
  });
});
