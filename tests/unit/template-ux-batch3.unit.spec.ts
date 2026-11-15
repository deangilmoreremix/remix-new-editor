import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  savePreset, listPresets, deletePreset, createPresetsControl,
  createTipStrip, isTipDismissed, formatActualCost,
} from '../../src/lib/templateUx.js';
import { createResultActions, snapshotFormInputs } from '../../src/lib/templateResultTools.js';
import { createTemplateCost } from '../../src/lib/templateCost.js';

describe('named presets', () => {
  beforeEach(() => localStorage.clear());

  it('saves, lists per template, overwrites by name and deletes', () => {
    const a = savePreset('t1', 'My brand', { name: 'Ember', cuisine: 'Italian' })!;
    savePreset('t2', 'Other', { x: 'y' });
    expect(listPresets('t1').map((p: any) => p.name)).toEqual(['My brand']);
    const again = savePreset('t1', 'my BRAND', { name: 'Oak' })!;
    expect(again.id).toBe(a.id);
    expect(listPresets('t1')).toHaveLength(1);
    expect(listPresets('t1')[0].values).toEqual({ name: 'Oak' });
    deletePreset(a.id);
    expect(listPresets('t1')).toEqual([]);
    expect(listPresets('t2')).toHaveLength(1);
  });

  it('rejects empty names / values and drops media-like values', () => {
    expect(savePreset('t1', '  ', { a: 'b' })).toBeNull();
    expect(savePreset('t1', 'x', { a: '  ' })).toBeNull();
    const p = savePreset('t1', 'x', { a: 'ok', img: 'data:image/png;base64,AAAA', blob: 'blob:http://x/1' })!;
    expect(p.values).toEqual({ a: 'ok' });
  });

  it('keeps long local values intact (only share links are limited)', () => {
    const long = 'a'.repeat(900);
    expect(savePreset('t1', 'long', { prompt: long })!.values.prompt).toBe(long);
  });

  it('refuses (rather than truncates) a value over the local limit', () => {
    expect(() => savePreset('t1', 'huge', { prompt: 'a'.repeat(5001) })).toThrow(/up to 5000 characters/);
    expect(listPresets('t1')).toEqual([]);
    expect(savePreset('t1', 'edge', { prompt: 'a'.repeat(5000) })!.values.prompt.length).toBe(5000);
  });

  it('throws a storage error when the browser will not save', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => savePreset('t1', 'x', { a: '1' })).toThrow(/storage/i);
    const notes: Array<[string, string?]> = [];
    const ctl = createPresetsControl({ templateId: 't1', getValues: () => ({ a: '1' }), applyValues: () => {}, notify: (m: string, t?: string) => notes.push([m, t]), askName: () => 'x' });
    (ctl.element.querySelector('[data-preset-save]') as HTMLElement).click();
    expect(notes[0][1]).toBe('error');
    spy.mockRestore();
  });

  it('caps presets per template and name length', () => {
    for (let i = 0; i < 25; i++) savePreset('t1', `p${i}`, { a: String(i) });
    expect(listPresets('t1')).toHaveLength(20);
    expect(savePreset('t1', 'n'.repeat(100), { a: '1' })!.name.length).toBe(40);
  });

  it('ignores corrupt storage', () => {
    localStorage.setItem('template_presets', '{oops');
    expect(listPresets('t1')).toEqual([]);
    localStorage.setItem('template_presets', JSON.stringify([{ id: 1 }, null, 'x']));
    expect(listPresets('t1')).toEqual([]);
  });

  it('control: save, load and delete through the UI', () => {
    const applied: any[] = [];
    const notes: string[] = [];
    const ctl = createPresetsControl({
      templateId: 't1',
      getValues: () => ({ name: 'Ember' }),
      applyValues: (v: any) => applied.push(v),
      notify: (m: string) => notes.push(m),
      askName: () => 'Brand A',
    });
    document.body.appendChild(ctl.element);
    (ctl.element.querySelector('[data-preset-save]') as HTMLElement).click();
    const select = ctl.element.querySelector('[data-preset-select]') as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    select.value = '';
    select.dispatchEvent(new Event('change'));
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    expect(applied).toEqual([{ name: 'Ember' }]);
    (ctl.element.querySelector('[data-preset-delete]') as HTMLElement).click();
    expect(listPresets('t1')).toEqual([]);
    expect(select.options.length).toBe(1);
  });

  it('control: refuses to save an empty form', () => {
    const notes: string[] = [];
    const ctl = createPresetsControl({ templateId: 't1', getValues: () => ({}), applyValues: () => {}, notify: (m: string) => notes.push(m), askName: () => 'x' });
    (ctl.element.querySelector('[data-preset-save]') as HTMLElement).click();
    expect(notes[0]).toMatch(/at least one field/);
    expect(listPresets('t1')).toEqual([]);
  });
});

describe('first-run tip strip', () => {
  beforeEach(() => localStorage.clear());
  it('shows once and stays dismissed', () => {
    const strip = createTipStrip()!;
    document.body.appendChild(strip);
    expect(strip.textContent).toMatch(/Try an example/);
    (strip.querySelector('[data-tip-dismiss]') as HTMLElement).click();
    expect(document.body.contains(strip)).toBe(false);
    expect(isTipDismissed()).toBe(true);
    expect(createTipStrip()).toBeNull();
  });
});

describe('history: use these inputs', () => {
  it('snapshotFormInputs drops media, private keys and functions', () => {
    const snap = snapshotFormInputs({
      fields: { a: 'x', img: 'data:image/png;base64,AA', b: 'blob:http://x/1', _secret: 's' },
      tiles: { style: 'bold' },
      fn: () => 1,
    });
    expect(snap).toEqual({ fields: { a: 'x' }, tiles: { style: 'bold' } });
    expect(snapshotFormInputs(null)).toBeNull();
    expect(snapshotFormInputs({})).toBeNull();
  });

  it('shows the button only for entries that saved inputs, and calls onReuse', () => {
    const onReuse = vi.fn();
    const actions = createResultActions({ onRegenerate: () => {}, onReuse });
    document.body.appendChild(actions.element);
    const btn = actions.element.querySelector('[data-action="reuse"]') as HTMLElement;
    actions.setEntry({ url: 'u1', model: 'm' } as any);
    expect(btn.classList.contains('hidden')).toBe(true);
    const entry = { url: 'u2', model: 'm', inputs: { fields: { a: 'x' } } } as any;
    actions.setEntry(entry);
    expect(btn.classList.contains('hidden')).toBe(false);
    btn.click();
    expect(onReuse).toHaveBeenCalledWith(entry);
  });

  it('keeps Regenerate and hides reuse when no handler is given', () => {
    const regen = vi.fn();
    const actions = createResultActions({ onRegenerate: regen });
    actions.setEntry({ url: 'u', inputs: { fields: { a: 'x' } } } as any);
    expect((actions.element.querySelector('[data-action="reuse"]') as HTMLElement).classList.contains('hidden')).toBe(true);
    (actions.element.querySelector('[data-action="regenerate"]') as HTMLElement).click();
    expect(regen).toHaveBeenCalled();
  });
});

describe('cost estimate', () => {
  it('prices the model with the settings Generate would send', async () => {
    vi.useFakeTimers();
    const estimate = vi.fn().mockResolvedValue({ cost: 0.45, currency: 'usd' });
    const cost = createTemplateCost({ getRequest: () => ({ model: 'kling-v2.6-pro-i2v', settings: { duration: 5, resolution: '1080p', native_audio: true } }), estimate });
    cost.refresh();
    await vi.advanceTimersByTimeAsync(500);
    expect(estimate).toHaveBeenCalledWith({ model: 'kling-v2.6-pro-i2v', prompt: 'estimate', sound: true, duration: 5, resolution: '1080p' });
    expect(cost.element.textContent).toBe('≈ 0.45 USD');
    vi.useRealTimers();
  });

  it('hides when there is no model or the estimate fails', async () => {
    vi.useFakeTimers();
    const estimate = vi.fn().mockRejectedValue(new Error('400'));
    const cost = createTemplateCost({ getRequest: () => ({ model: 'x', settings: {} }), estimate });
    cost.refresh();
    await vi.advanceTimersByTimeAsync(500);
    expect(cost.element.classList.contains('hidden')).toBe(true);
    const none = createTemplateCost({ getRequest: () => null, estimate });
    none.refresh();
    await vi.advanceTimersByTimeAsync(500);
    expect(none.element.classList.contains('hidden')).toBe(true);
    vi.useRealTimers();
  });

  it('formats the actual cost only when reported', () => {
    expect(formatActualCost({ cost: { amount_usd: 0.45 } })).toBe('Cost: $0.45');
    expect(formatActualCost({ cost: { amount_usd: 0.065 } })).toBe('Cost: $0.065');
    expect(formatActualCost({ cost: { amount_usd: 0 } })).toBe('');
    expect(formatActualCost({})).toBe('');
    expect(formatActualCost(null)).toBe('');
  });
});

import { TemplateInputBuilder } from '../../src/lib/cinematicTemplates.js';

describe('Cinema required-field validation', () => {
  const builder = new TemplateInputBuilder({ quickInputs: [
    { name: 'premise', type: 'text', label: 'Premise', required: true },
    { name: 'tone', type: 'text', label: 'Tone' },
  ] }, 'quick');

  it('treats a whitespace-only required value as missing', () => {
    expect(builder.validateInputs({ premise: '   ' }).map((e: any) => e.field)).toEqual(['premise']);
    expect(builder.validateInputs({ premise: '\n\t' }).map((e: any) => e.field)).toEqual(['premise']);
  });

  it('accepts real values and ignores blank optional ones', () => {
    expect(builder.validateInputs({ premise: 'A story', tone: '  ' })).toEqual([]);
  });

  it('still flags empty and missing values', () => {
    expect(builder.validateInputs({ premise: '' })).toHaveLength(1);
    expect(builder.validateInputs({})).toHaveLength(1);
    expect(builder.validateInputs(undefined)).toHaveLength(1);
  });
});
