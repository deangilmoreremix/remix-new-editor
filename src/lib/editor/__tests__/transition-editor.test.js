import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TransitionEditor } from '../transitionEditor.js';

const ctx = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 0 }) : () => {}), set: () => true });
beforeEach(() => { localStorage.clear(); HTMLCanvasElement.prototype.getContext = () => ctx; });

afterEach(() => { document.body.innerHTML = ''; }); // the DOM engine resolves #ids document-wide, so keep one editor at a time

const make = (onChange = vi.fn()) => {
  const toast = vi.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  const ed = new TransitionEditor(el, onChange, undefined, { toast });
  return { ed, el, toast, onChange };
};

describe('Transitions Panel', () => {
  it('Apply tells the host the transition and duration; no alert()', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { ed, onChange } = make();
    ed.selectTransition('wipeLeft');
    ed.setDuration(1.5);
    onChange.mockClear();
    ed.applyTransition();
    expect(onChange).toHaveBeenCalledTimes(1);
    const [t, , duration] = onChange.mock.calls[0];
    expect(t.key).toBe('wipeLeft');
    expect(duration).toBe(1.5);
    expect(alertSpy).not.toHaveBeenCalled();
  });
  it('asks for a transition before applying', () => {
    const { ed, toast, onChange } = make();
    ed.applyTransition();
    expect(toast).toHaveBeenCalledWith('Pick a transition first.', 'info');
    expect(onChange).not.toHaveBeenCalled();
  });
  it('saves a named preset to localStorage and lists it', () => {
    const { ed, el, toast } = make();
    ed.selectTransition('dissolve');
    expect(ed.savePreset()).toBe(false); // no name yet
    el.querySelector('#presetName').value = 'Soft cut';
    ed.setDuration(2.5);
    expect(ed.savePreset()).toBe(true);
    const saved = JSON.parse(localStorage.getItem('remix_transition_presets'));
    expect(saved[0]).toMatchObject({ name: 'Soft cut', transition: 'dissolve', duration: 2.5 });
    expect(el.querySelector('#myPresets').textContent).toContain('Soft cut');
    expect(toast).toHaveBeenLastCalledWith('Preset "Soft cut" saved', 'success');
  });
  it('loads a saved preset back, with its duration', () => {
    localStorage.setItem('remix_transition_presets', JSON.stringify([{ name: 'Quick wipe', transition: 'wipeRight', params: {}, duration: 0.8 }]));
    const { ed, el } = make();
    const select = el.querySelector('#presetSelect');
    select.value = 'mine:Quick wipe';
    select.dispatchEvent(new Event('change'));
    expect(ed.currentTransition.key).toBe('wipeRight');
    expect(ed.duration).toBe(0.8);
  });
});
