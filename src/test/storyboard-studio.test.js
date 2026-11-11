import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/studioChrome.js', () => ({ mountStudioChrome: vi.fn() }));
vi.mock('../lib/clerkEntitlements.js', () => ({ requireEntitlement: vi.fn(async () => true) }));
vi.mock('../lib/apiKeyManager.js', () => ({
  apiKeyManager: { hasOpenAIKey: vi.fn(() => false), hasMuapiKey: vi.fn(() => true), getOpenAIKey: vi.fn(() => '') },
}));
vi.mock('../lib/muapi.js', () => ({
  muapi: { generateImage: vi.fn(async () => ({ url: 'https://img/frame.png' })) },
}));
vi.mock('../lib/generationHistory.js', () => ({ registerGeneration: vi.fn() }));

import { StoryboardStudio } from '../components/StoryboardStudio.js';
import { muapi } from '../lib/muapi.js';

const mount = () => {
  const root = StoryboardStudio();
  document.body.appendChild(root);
  return root;
};
const cards = (root) => [...root.querySelectorAll('[data-frame-index]')];
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
});

describe('Storyboard Studio layout', () => {
  it('returns the page synchronously so the Template Studio can embed it', () => {
    const root = StoryboardStudio({ embedded: true });
    expect(root instanceof HTMLElement).toBe(true);
  });

  it('opens on the story brief, then the frames, and has no single-image prompt panel', () => {
    const root = mount();
    const form = root.querySelector('#video-intent-form');
    expect(form.classList.contains('hidden')).toBe(false);
    expect(cards(root)).toHaveLength(3);
    expect(root.querySelector('#storyboard-advanced-panel')).toBeNull();
    const order = [...root.querySelectorAll('#video-intent-form, [data-frame-index]')];
    expect(order[0]).toBe(form);
    expect(root.textContent).not.toMatch(/Advanced Options/);
    expect(root.querySelector('details').open).toBe(false); // generation settings start collapsed
  });
});

describe('how-to steps', () => {
  it('sit below the story brief, not above it', () => {
    const root = mount();
    const brief = root.querySelector('section[aria-label="Story brief"]');
    const steps = brief.nextElementSibling;
    expect(steps.classList.contains('shrink-0')).toBe(true);
    expect(steps.className).toContain('mb-4');
    // The header block (first child after the chrome) must not contain the steps wrapper.
    const header = [...root.children].find((c) => c.className.includes('pt-6'));
    expect(header.contains(steps)).toBe(false);
    expect(brief.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('frames board', () => {
  it('never lets the page column squash the frames row (every layout)', () => {
    const root = mount();
    const board = root.querySelector('[data-frame-index]').parentElement;
    const layout = root.querySelector('select[aria-label="Layout"]');
    for (const value of ['horizontal', 'grid', 'story']) {
      layout.value = value;
      layout.dispatchEvent(new Event('change'));
      expect(root.querySelector('[data-frame-index]').parentElement.classList.contains('shrink-0')).toBe(true);
    }
    expect(board).toBeTruthy();
  });

  it('keeps timeline segments in step with add, duplicate, move and delete', () => {
    const root = mount();
    const segs = () => root.querySelectorAll('[role="listitem"]').length;
    expect(segs()).toBe(3);
    click([...root.querySelectorAll('button')].find((b) => b.textContent === '+ Add frame'));
    expect(cards(root)).toHaveLength(4);
    expect(segs()).toBe(4);
    click(cards(root)[0].querySelector('[data-act="dup"]'));
    expect(segs()).toBe(5);
    click(cards(root)[0].querySelector('[data-act="del"]'));
    expect(cards(root)).toHaveLength(4);
    expect(segs()).toBe(4);
  });

  it('edits a frame duration and updates the total', () => {
    const root = mount();
    const input = cards(root)[0].querySelector('input[type="number"]');
    input.value = '9';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(root.querySelector('#board-summary').textContent).toContain('15s'); // 9 + 3 + 3
  });

  it('undo restores a deleted frame', () => {
    const root = mount();
    click(cards(root)[1].querySelector('[data-act="del"]'));
    expect(cards(root)).toHaveLength(2);
    click([...root.querySelectorAll('button')].find((b) => b.textContent.includes('Undo')));
    expect(cards(root)).toHaveLength(3);
  });
});

describe('generation', () => {
  it('Generate all frames fills each described frame and updates the right buttons', async () => {
    const root = mount();
    const textareas = cards(root).map((c) => c.querySelector('textarea'));
    textareas[0].value = 'A runner at dawn'; textareas[0].dispatchEvent(new Event('input', { bubbles: true }));
    textareas[2].value = 'A close up of laces'; textareas[2].dispatchEvent(new Event('input', { bubbles: true }));
    const genAll = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Generate all frames');
    click(genAll);
    await vi.waitFor(() => expect(genAll.textContent).toBe('Generate all frames'));
    await tick();
    expect(muapi.generateImage).toHaveBeenCalledTimes(2); // the empty frame is skipped
    const generateButtons = cards(root).map((c) => c.querySelector('[aria-label^="Generate frame"]').textContent);
    expect(generateButtons).toEqual(['Regenerate', 'Generate frame', 'Regenerate']);
    expect(cards(root)[0].querySelector('img').src).toBe('https://img/frame.png');
    expect(root.querySelector('.progress-label').textContent).toBe('2/2');
  });

  it('sends the negative prompt from Generation settings to the image call', async () => {
    const root = mount();
    const neg = [...root.querySelectorAll('details input[type="text"]')][0];
    neg.value = 'blurry'; neg.dispatchEvent(new Event('input', { bubbles: true }));
    const ta = cards(root)[0].querySelector('textarea');
    ta.value = 'A street'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    click(cards(root)[0].querySelector('[aria-label^="Generate frame"]'));
    await vi.waitFor(() => expect(muapi.generateImage).toHaveBeenCalled());
    expect(muapi.generateImage.mock.calls[0][0].negative_prompt).toBe('blurry');
  });

  it('Generate storyboard plans N frames from the brief without an OpenAI key', async () => {
    const root = mount();
    const set = (id, v) => { const el = root.querySelector(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('#vi-subject', 'Trail shoe');
    set('#vi-frameCount', '5');
    set('#vi-duration', '30');
    root.querySelector('#vi-with-images').checked = false;
    click(root.querySelector('#vi-generate-btn'));
    await vi.waitFor(() => expect(cards(root)).toHaveLength(5));
    expect(root.querySelector('#board-summary').textContent).toContain('30s');
  });
});

describe('save and load', () => {
  it('round-trips through local storage without the /api/storyboard route', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('no route')));
    globalThis.fetch = fetchSpy;
    const root = mount();
    const ta = cards(root)[0].querySelector('textarea');
    ta.value = 'Saved scene'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    const name = root.querySelector('input[aria-label="Project name"]');
    name.value = 'demo';
    click([...root.querySelectorAll('button')].find((b) => b.textContent === 'Save'));
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem('storyboard_projects_v1')).demo).toBeTruthy());

    root.remove(); // only one studio is ever on screen
    const root2 = mount();
    root2.querySelector('input[aria-label="Project name"]').value = 'demo';
    click([...root2.querySelectorAll('button')].find((b) => b.textContent === 'Load'));
    await vi.waitFor(() => expect(cards(root2)[0].querySelector('textarea').value).toBe('Saved scene'));
  });
});
