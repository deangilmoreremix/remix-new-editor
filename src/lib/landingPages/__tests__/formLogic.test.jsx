// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

vi.hoisted(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
import { LeadForm } from '../puck/components.jsx';
import { PageContext, FormSettingsContext } from '../puck/context.js';
import { parseChoices, choicesField } from '../puck/choicesField.jsx';

const ctx = (extra = {}) => ({ page: { id: 'p1' }, tokens: {}, handlers: {}, preview: false, ...extra });
const fields = [{ key: 'topic', label: 'Topic', type: 'select', required: true, options: 'Roof\nHVAC\nPlumbing', placeholder: 'Pick one' }, { key: 'age', label: 'Age', type: 'number' }, { key: 'when', label: 'When', type: 'date' }];
const html = (props, extra) => renderToString(<PageContext.Provider value={ctx(extra)}><LeadForm title="T" fields={props.fields} submitLabel="Send" /></PageContext.Provider>);

describe('form logic', () => {
  it('parses dropdown choices from lines or the older comma list', () => {
    expect(parseChoices('A\nB\n\n C ')).toEqual(['A', 'B', 'C']);
    expect(parseChoices('A, B,C')).toEqual(['A', 'B', 'C']);
    expect(parseChoices('')).toEqual([]);
    expect(parseChoices(Array.from({ length: 40 }, (_, i) => `c${i}`).join('\n'))).toHaveLength(30);
  });
  it('renders a dropdown with a placeholder and its choices, plus number and date boxes', () => {
    const out = html({ fields });
    expect(out).toContain('<select'); expect(out).toContain('Pick one');
    ['Roof', 'HVAC', 'Plumbing'].forEach((c) => expect(out).toContain(`>${c}</option>`));
    expect(out).toContain('type="number"'); expect(out).toContain('type="date"');
  });
  it('the choices field adds, edits, moves and removes choices', () => {
    const f = choicesField('Dropdown choices'); const seen = [];
    const root = document.createElement('div'); document.body.appendChild(root); const r = createRoot(root);
    let value = 'A\nB';
    const draw = () => act(() => { r.render(<div>{f.render({ value, onChange: (v) => { seen.push(v); value = v; }, name: 'options' })}</div>); });
    draw();
    act(() => { root.querySelector('button[aria-label="Move choice 2 up"]').click(); }); expect(seen.at(-1)).toBe('B\nA');
    draw(); act(() => { root.querySelector('button[aria-label="Remove choice 1"]').click(); }); expect(seen.at(-1)).toBe('A');
    draw(); act(() => { [...root.querySelectorAll('button')].find((b) => /Add a choice/.test(b.textContent)).click(); }); expect(seen.at(-1)).toBe('A\n');
    act(() => r.unmount());
  });
  it('after a form is sent it can open an https page, never another kind of link', async () => {
    vi.useFakeTimers();
    const assign = vi.fn(); const orig = window.location;
    Object.defineProperty(window, 'location', { value: { ...orig, assign }, writable: true, configurable: true });
    const run = async (url) => {
      const root = document.createElement('div'); document.body.appendChild(root); const r = createRoot(root);
      await act(async () => { r.render(<PageContext.Provider value={ctx({ handlers: { onLead: async () => ({}) } })}><FormSettingsContext.Provider value={{ action: 'redirect', url }}><LeadForm title="T" fields={[{ key: 'name', label: 'Name', type: 'text' }]} submitLabel="Send" /></FormSettingsContext.Provider></PageContext.Provider>); });
      await act(async () => { root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
      await act(async () => { vi.advanceTimersByTime(2000); });
      act(() => r.unmount());
    };
    await run('https://example.com/thanks'); expect(assign).toHaveBeenCalledWith('https://example.com/thanks');
    assign.mockClear(); await run('javascript:alert(1)'); expect(assign).not.toHaveBeenCalled();
    assign.mockClear(); await run('http://example.com/x'); expect(assign).not.toHaveBeenCalled();
    Object.defineProperty(window, 'location', { value: orig, writable: true, configurable: true }); vi.useRealTimers();
  });
});
