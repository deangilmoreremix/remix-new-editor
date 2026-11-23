// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.hoisted(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
import { AiWriter, readBrief } from '../editor/tokenFields.jsx';
import { PageContext } from '../editor/context.js';

const page = { id: 'pg1', title: 'Reno Plumbing' };
let host; let root;
const mount = (props) => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  act(() => root.render(<PageContext.Provider value={{ page, tokens: {}, handlers: {}, preview: true }}><AiWriter label="Headline" value="" multiline={false} onApply={() => {}} {...props} /></PageContext.Provider>));
};
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const type = (el, v) => act(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const q = (sel) => host.querySelector(sel);

// The shared test setup stubs sessionStorage with no-ops; use a real in-memory one so the remembered line round-trips.
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; };
beforeEach(() => { document.body.innerHTML = ''; vi.stubGlobal('sessionStorage', memory()); });

describe('Write with AI under a text field', () => {
  it('shows a button; the panel opens on click', () => {
    mount({});
    expect(q('[data-ai-write]').textContent).toBe('Write with AI');
    expect(q('[data-ai-panel]')).toBeNull();
    click(q('[data-ai-write]'));
    expect(q('[data-ai-panel]')).toBeTruthy();
  });

  it('writes into an EMPTY field: sends label, instruction and context, applies the option you click', async () => {
    const writer = vi.fn(async () => ['Fast, friendly plumbing', 'Reno\'s plumber']);
    const onApply = vi.fn();
    mount({ writer, onApply, value: '' });
    click(q('[data-ai-write]'));
    type(q('[data-ai-brief]'), 'family plumber in Reno');
    type(q('[data-ai-instruction]'), 'warm and local');
    click(q('[data-ai-generate]')); await flush();
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({ label: 'Headline', current: '', instruction: 'warm and local', context: 'Reno Plumbing — family plumber in Reno', n: 3 }));
    const opts = host.querySelectorAll('[data-ai-option]');
    expect([...opts].map((o) => o.textContent)).toEqual(['Fast, friendly plumbing', 'Reno\'s plumber']);
    click(opts[0]);
    expect(onApply).toHaveBeenCalledWith('Fast, friendly plumbing');
    expect(q('[data-ai-panel]')).toBeNull();
  });

  it('Undo puts the old text back', async () => {
    const onApply = vi.fn();
    mount({ writer: async () => ['New line'], onApply, value: 'Old line' });
    click(q('[data-ai-write]')); click(q('[data-ai-generate]')); await flush();
    click(q('[data-ai-option]'));
    expect(onApply).toHaveBeenLastCalledWith('New line');
    click(q('[data-ai-undo]'));
    expect(onApply).toHaveBeenLastCalledWith('Old line');
    expect(q('[data-ai-undo]')).toBeNull();
  });

  it('shows a readable error and keeps the field alone', async () => {
    const onApply = vi.fn();
    mount({ writer: async () => { throw new Error('This uses your own OpenAI key. Add it in Settings.'); }, onApply });
    click(q('[data-ai-write]')); click(q('[data-ai-generate]')); await flush();
    expect(q('[data-ai-error]').textContent).toContain('OpenAI key');
    expect(onApply).not.toHaveBeenCalled();
  });

  it('says so when the AI returns nothing usable', async () => {
    mount({ writer: async () => [] });
    click(q('[data-ai-write]')); click(q('[data-ai-generate]')); await flush();
    expect(q('[data-ai-error]').textContent).toMatch(/anything usable/i);
  });

  it('remembers the business line for every AI button on the page', async () => {
    mount({ writer: async () => ['x'] });
    click(q('[data-ai-write]')); type(q('[data-ai-brief]'), 'organic bakery'); click(q('[data-ai-generate]')); await flush();
    expect(readBrief(page)).toBe('organic bakery');
    expect(readBrief({ id: 'other' })).toBe('');
  });
});
