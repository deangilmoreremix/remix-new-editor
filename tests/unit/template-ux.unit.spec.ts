import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildExampleValues, exampleValueFor, saveTemplateInputs, loadTemplateInputs,
  missingRequiredInputs, applyValuesToForm, isGenerateShortcut, setFieldInvalid,
} from '../../src/lib/templateUx.js';
import { allTemplates } from '../../src/lib/templates.js';
import { normalizeTemplate } from '../../src/lib/templateAdapter.js';

const inputs = [
  { name: 'prompt', type: 'textarea', label: 'Prompt', placeholder: 'e.g. dancing in the rain', required: true },
  { name: 'style', type: 'select', label: 'Style', options: ['Plain', 'Cinematic', 'Retro'] },
  { name: 'image_url', type: 'image', label: 'Photo' },
];

describe('templateUx', () => {
  beforeEach(() => localStorage.clear());

  it('builds example values from placeholders and select options, skipping media', () => {
    expect(buildExampleValues(inputs)).toEqual({ prompt: 'dancing in the rain', style: 'Cinematic' });
    expect(exampleValueFor({ name: 'brand', type: 'text', label: 'Brand Name' })).toBe('Sample brand name');
  });

  it('gives every text/select input of every template an example', () => {
    const missing: string[] = [];
    allTemplates.forEach((raw: any) => {
      const t = normalizeTemplate(raw);
      (t.inputs || []).forEach((i: any) => {
        if (['text', 'textarea', 'select'].includes(i.type) && i.name && !exampleValueFor(i)) missing.push(`${t.id}:${i.name}`);
      });
    });
    expect(missing).toEqual([]);
  });

  it('remembers inputs per template and drops stale select values', () => {
    saveTemplateInputs('t1', inputs, { prompt: 'hello', style: 'Retro', image_url: 'https://x/y.png' });
    expect(loadTemplateInputs('t1', inputs)).toEqual({ prompt: 'hello', style: 'Retro' });
    expect(loadTemplateInputs('other', inputs)).toEqual({});
    const changed = [inputs[0], { ...inputs[1], options: ['Plain'] }];
    expect(loadTemplateInputs('t1', changed)).toEqual({ prompt: 'hello' });
  });

  it('clears the saved entry when everything is blank', () => {
    saveTemplateInputs('t1', inputs, { prompt: 'hello' });
    saveTemplateInputs('t1', inputs, { prompt: '  ' });
    expect(loadTemplateInputs('t1', inputs)).toEqual({});
  });

  it('finds empty required inputs', () => {
    expect(missingRequiredInputs(inputs, { prompt: ' ' }).map((i: any) => i.name)).toEqual(['prompt']);
    expect(missingRequiredInputs(inputs, { prompt: 'x' })).toEqual([]);
  });

  it('applies values to fields by data-input-name or name and fires input events', () => {
    document.body.innerHTML = '<div id="r"><input data-input-name="a"><textarea name="b"></textarea></div>';
    const root = document.getElementById('r')!;
    const seen: string[] = [];
    root.addEventListener('input', (e: any) => seen.push(e.target.value));
    expect(applyValuesToForm(root, { a: '1', b: '2', missing: '3' })).toBe(2);
    expect(seen).toEqual(['1', '2']);
  });

  it('detects Ctrl/Cmd+Enter only', () => {
    expect(isGenerateShortcut({ key: 'Enter', ctrlKey: true } as any)).toBe(true);
    expect(isGenerateShortcut({ key: 'Enter', metaKey: true } as any)).toBe(true);
    expect(isGenerateShortcut({ key: 'Enter' } as any)).toBe(false);
    expect(isGenerateShortcut({ key: 'a', ctrlKey: true } as any)).toBe(false);
  });

  it('marks fields invalid and valid again', () => {
    const el = document.createElement('input');
    setFieldInvalid(el, true);
    expect(el.getAttribute('aria-invalid')).toBe('true');
    setFieldInvalid(el, false);
    expect(el.hasAttribute('aria-invalid')).toBe(false);
  });
});
