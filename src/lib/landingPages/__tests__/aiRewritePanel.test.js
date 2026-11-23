// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAiRewritePanel, buildInstruction } from '../aiRewritePanel.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; };
const flush = () => new Promise((r) => setTimeout(r, 0));
const DATA = { root: { props: {} }, content: [{ type: 'Hero', props: { id: 'h', headline: 'Welcome to our company', buttons: [{ label: 'Book now', url: '' }] } }] };
beforeEach(() => { document.body.innerHTML = ''; vi.stubGlobal('sessionStorage', memory()); });

describe('Write the page with AI (shared panel)', () => {
  it('builds the instruction from the business line and what was typed', () => {
    expect(buildInstruction('family plumber', 'friendlier')).toBe('About the business: family plumber. friendlier');
    expect(buildInstruction('', '')).toBe('');
    expect(buildInstruction('x'.repeat(900), '').length).toBe(600);
  });

  it('writes, lets you untick a change, applies the rest, and undoes', async () => {
    let data = JSON.parse(JSON.stringify(DATA));
    const propose = vi.fn(async () => ({ skipped: 0, changes: [
      { id: 't0', path: ['content', 0, 'props', 'headline'], text: 'Welcome to our company', after: 'Fast plumbing in Reno' },
      { id: 't1', path: ['content', 0, 'props', 'buttons', 0, 'label'], text: 'Book now', after: 'Call today' },
    ] }));
    const panel = createAiRewritePanel({ getData: () => data, setData: (d) => { data = d; }, context: 'Reno Plumbing', pageId: 'p1', propose });
    document.body.appendChild(panel);
    panel.querySelector('[data-ai-brief]').value = 'family plumber in Reno';
    panel.querySelector('[data-ai-instruction]').value = 'warm';
    panel.querySelector('[data-ai-run]').click(); await flush();
    expect(propose).toHaveBeenCalledWith(DATA, { section: null, instruction: 'About the business: family plumber in Reno. warm', context: 'Reno Plumbing' });
    const boxes = panel.querySelectorAll('[data-ai-out] input[type=checkbox]');
    expect(boxes).toHaveLength(2);
    boxes[1].checked = false;                                       // keep "Book now"
    panel.querySelector('[data-ai-apply]').click();
    expect(data.content[0].props.headline).toBe('Fast plumbing in Reno');
    expect(data.content[0].props.buttons[0].label).toBe('Book now');
    expect(panel.querySelector('[data-ai-undo]').hidden).toBe(false);
    panel.querySelector('[data-ai-undo]').click();
    expect(data).toEqual(DATA);
  });

  it('remembers the business line for the page', async () => {
    const propose = vi.fn(async () => ({ changes: [], skipped: 0 }));
    const first = createAiRewritePanel({ getData: () => DATA, setData: () => {}, pageId: 'p9', propose });
    first.querySelector('[data-ai-brief]').value = 'organic bakery';
    first.querySelector('[data-ai-run]').click(); await flush();
    const again = createAiRewritePanel({ getData: () => DATA, setData: () => {}, pageId: 'p9', propose });
    expect(again.querySelector('[data-ai-brief]').value).toBe('organic bakery');
    expect(createAiRewritePanel({ getData: () => DATA, setData: () => {}, pageId: 'other', propose }).querySelector('[data-ai-brief]').value).toBe('');
  });

  it('shows the service message when it fails, and nothing is changed', async () => {
    let data = JSON.parse(JSON.stringify(DATA));
    const panel = createAiRewritePanel({ getData: () => data, setData: (d) => { data = d; }, propose: async () => { throw new Error('This uses your own OpenAI key.'); } });
    panel.querySelector('[data-ai-run]').click(); await flush();
    expect(panel.querySelector('[data-ai-out]').textContent).toContain('own OpenAI key');
    expect(data).toEqual(DATA);
  });
});
