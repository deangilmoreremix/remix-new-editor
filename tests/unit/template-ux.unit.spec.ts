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

  it('ignores Ctrl+Enter while an IME composition is being confirmed', () => {
    expect(isGenerateShortcut({ key: 'Enter', ctrlKey: true, isComposing: true } as any)).toBe(false);
    expect(isGenerateShortcut({ key: 'Enter', ctrlKey: true, keyCode: 229 } as any)).toBe(false);
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

  it('ties an invalid field to its error message and clears it again', () => {
    const el = document.createElement('input');
    setFieldInvalid(el, true, 'err-1');
    expect(el.getAttribute('aria-describedby')).toBe('err-1');
    setFieldInvalid(el, false);
    expect(el.hasAttribute('aria-describedby')).toBe(false);
  });
});

import {
  toggleFavoriteTemplate, isFavoriteTemplate, getFavoriteTemplateIds,
  addRecentTemplate, getRecentTemplateIds,
  encodeShareValues, decodeShareValues, buildShareUrl,
} from '../../src/lib/templateUx.js';

describe('templateUx favorites, recents and share links', () => {
  beforeEach(() => localStorage.clear());

  it('toggles favorites', () => {
    expect(toggleFavoriteTemplate('a')).toBe(true);
    expect(toggleFavoriteTemplate('b')).toBe(true);
    expect(getFavoriteTemplateIds()).toEqual(['b', 'a']);
    expect(toggleFavoriteTemplate('a')).toBe(false);
    expect(isFavoriteTemplate('a')).toBe(false);
  });

  it('keeps recents most-recent-first, de-duplicated and capped', () => {
    for (let i = 0; i < 15; i++) addRecentTemplate(`t${i}`);
    addRecentTemplate('t3');
    const recent = getRecentTemplateIds();
    expect(recent[0]).toBe('t3');
    expect(recent.length).toBe(12);
    expect(new Set(recent).size).toBe(12);
  });

  it('survives corrupt stored lists', () => {
    localStorage.setItem('template_gallery_favorites', '{not json');
    localStorage.setItem('template_gallery_recent', '{"a":1}');
    expect(getFavoriteTemplateIds()).toEqual([]);
    expect(getRecentTemplateIds()).toEqual([]);
  });

  const inputs = [
    { name: 'prompt', type: 'text', label: 'Prompt' },
    { name: 'style', type: 'select', label: 'Style', options: ['Plain', 'Retro'] },
    { name: 'image_url', type: 'image', label: 'Photo' },
  ];

  it('round-trips share values, including unicode', () => {
    const enc = encodeShareValues(inputs, { prompt: 'café at 5 — “fun” 🎬', style: 'Retro', image_url: 'https://x/y.png' });
    expect(enc).not.toMatch(/[+/=]/);
    expect(decodeShareValues(enc, inputs)).toEqual({ prompt: 'café at 5 — “fun” 🎬', style: 'Retro' });
  });

  it('ignores unknown fields, bad select values, junk and oversize text', () => {
    const forged = encodeShareValues([{ name: 'evil', type: 'text' }, { name: 'style', type: 'text' }], { evil: 'x', style: 'Hacked' });
    expect(decodeShareValues(forged, inputs)).toEqual({});
    expect(decodeShareValues('not-base64!!', inputs)).toEqual({});
    expect(decodeShareValues('', inputs)).toEqual({});
    const long = encodeShareValues(inputs, { prompt: 'a'.repeat(900) });
    expect(decodeShareValues(long, inputs).prompt.length).toBe(500);
  });

  it('builds a link that points at the template', () => {
    const loc = { origin: 'https://smartvid.app', pathname: '/' } as any;
    expect(buildShareUrl('t1', inputs, {}, loc)).toBe('https://smartvid.app/#/template/t1');
    const url = buildShareUrl('t1', inputs, { prompt: 'hi' }, loc);
    expect(url).toMatch(/^https:\/\/smartvid\.app\/\?fill=[\w-]+#\/template\/t1$/);
  });
});
