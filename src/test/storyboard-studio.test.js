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
import { setVideoIntent } from '../lib/videoIntentStore.js';

const mount = () => {
  const root = StoryboardStudio();
  document.body.appendChild(root);
  return root;
};
const cards = (root) => [...root.querySelectorAll('[data-frame-index]')];
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const type = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
const btn = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const isHidden = (el) => el.classList.contains('hidden');

/** Board with three blank frames, built by hand. */
const mountBoard = () => {
  const root = mount();
  click(root.querySelector('#start-blank'));
  click(btn(root, '+ Add frame'));
  click(btn(root, '+ Add frame'));
  return root;
};

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  sessionStorage.clear();
  setVideoIntent({ subject: '', premise: '', frameCount: 6, duration: 60 });
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
});

describe('describe stage (first view)', () => {
  it('returns the page synchronously so the Template Studio can embed it', () => {
    expect(StoryboardStudio({ embedded: true }) instanceof HTMLElement).toBe(true);
  });

  it('shows only the description card: no toolbar, frames, timeline or settings', () => {
    const root = mount();
    expect(isHidden(root.querySelector('#brief-card'))).toBe(false);
    expect(root.querySelector('#vi-premise')).toBeTruthy();
    expect(isHidden(root.querySelector('[aria-label="Storyboard tools"]'))).toBe(true);
    expect(isHidden(root.querySelector('#board-summary').parentElement)).toBe(true);
    expect(cards(root)).toHaveLength(0);
    expect(isHidden(root.querySelector('#brief-summary'))).toBe(true);
    expect(root.querySelector('#storyboard-advanced-panel')).toBeNull();
  });

  it('keeps the optional fields behind a Customize toggle', () => {
    const root = mount();
    const form = root.querySelector('#video-intent-form');
    expect(isHidden(form)).toBe(true);
    click(root.querySelector('#video-intent-toggle'));
    expect(isHidden(form)).toBe(false);
    expect(root.querySelector('#vi-frameCount')).toBeTruthy();
  });

  it('puts the how-to steps below the brief, folded away', () => {
    const root = mount();
    const brief = root.querySelector('section[aria-label="Story brief"]');
    const howTo = brief.nextElementSibling;
    expect(howTo.tagName).toBe('DETAILS');
    expect(howTo.open).toBe(false);
    expect(brief.compareDocumentPosition(howTo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('refuses to generate an empty description and says why', async () => {
    const root = mount();
    click(root.querySelector('#vi-generate-btn'));
    await Promise.resolve();
    expect(root.querySelector('#vi-status').textContent).toMatch(/describe/i);
    expect(cards(root)).toHaveLength(0);
  });
});

describe('describe, then reveal', () => {
  const generate = async (root, text = 'A 30 second launch ad for a trail running shoe. A runner climbs a ridge at dawn.') => {
    type(root.querySelector('#vi-premise'), text);
    root.querySelector('#vi-with-images').checked = false;
    click(root.querySelector('#vi-generate-btn'));
    await vi.waitFor(() => expect(cards(root).length).toBeGreaterThan(0));
  };

  it('Generate shows the skeleton board straight away, then the planned frames', async () => {
    const root = mount();
    type(root.querySelector('#vi-premise'), 'A trail shoe ad. Runner at dawn.');
    root.querySelector('#vi-with-images').checked = false;
    click(root.querySelector('#vi-generate-btn'));
    await vi.waitFor(() => expect(root.querySelector('[data-skeleton]') || cards(root).length).toBeTruthy());
    await vi.waitFor(() => expect(cards(root)).toHaveLength(6));
    expect(isHidden(root.querySelector('[aria-label="Storyboard tools"]'))).toBe(false);
    expect(isHidden(root.querySelector('#brief-summary'))).toBe(false);
    expect(isHidden(root.querySelector('#brief-card'))).toBe(true);
    expect(root.querySelector('#brief-summary-text').textContent).toContain('A trail shoe ad');
    expect(root.querySelector('#brief-summary-meta').textContent).toContain('6 frames');
  });

  it('works from the description alone: the title comes from its first sentence', async () => {
    const root = mount();
    await generate(root);
    expect(cards(root)[0].querySelector('textarea').value).toMatch(/30 second launch ad for a trail running shoe/i);
  });

  it('reads a stated length from the description unless the length was set by hand', async () => {
    const root = mount();
    await generate(root, 'A 30 second ad for a trail shoe. Runner at dawn.');
    expect(root.querySelector('#board-summary').textContent).toContain('30s');
    root.remove();
    const root2 = mount();
    type(root2.querySelector('#vi-duration'), '40');
    await generate(root2, 'A 30 second ad for a trail shoe. Runner at dawn.');
    expect(root2.querySelector('#board-summary').textContent).toContain('40s');
  });

  it('honours frame count and length from Customize', async () => {
    const root = mount();
    type(root.querySelector('#vi-frameCount'), '4');
    type(root.querySelector('#vi-duration'), '20');
    await generate(root);
    await vi.waitFor(() => expect(cards(root)).toHaveLength(4));
    expect(root.querySelector('#board-summary').textContent).toContain('20s');
  });

  it('Edit brief reopens the description, New storyboard starts over (and Undo brings it back)', async () => {
    const root = mount();
    await generate(root);
    click(root.querySelector('#edit-brief'));
    expect(isHidden(root.querySelector('#brief-card'))).toBe(false);
    click(root.querySelector('#edit-brief'));
    expect(isHidden(root.querySelector('#brief-card'))).toBe(true);

    click(root.querySelector('#new-storyboard'));
    expect(cards(root)).toHaveLength(0);
    expect(isHidden(root.querySelector('#brief-card'))).toBe(false);
    expect(isHidden(root.querySelector('[aria-label="Storyboard tools"]'))).toBe(true);
  });

  it('stays on the describe view with the text kept when planning fails', async () => {
    const root = mount();
    const { requireEntitlement } = await import('../lib/clerkEntitlements.js');
    requireEntitlement.mockResolvedValueOnce(false);
    type(root.querySelector('#vi-premise'), 'Something to make');
    click(root.querySelector('#vi-generate-btn'));
    await new Promise((r) => setTimeout(r, 10));
    expect(cards(root)).toHaveLength(0);
    expect(isHidden(root.querySelector('#brief-card'))).toBe(false);
    expect(root.querySelector('#vi-premise').value).toBe('Something to make');
  });

  it('"build the frames by hand" opens the board with one blank frame', () => {
    const root = mount();
    click(root.querySelector('#start-blank'));
    expect(cards(root)).toHaveLength(1);
    expect(isHidden(root.querySelector('[aria-label="Storyboard tools"]'))).toBe(false);
  });

  it('prefills the description from a ?prompt= deep link', () => {
    window.history.pushState({}, '', '/?prompt=Hello%20world');
    try {
      const root = mount();
      expect(root.querySelector('#vi-premise').value).toBe('Hello world');
    } finally {
      window.history.pushState({}, '', '/');
    }
  });
});

describe('frames board', () => {
  it('never lets the page column squash the frames row (every layout)', () => {
    const root = mountBoard();
    const layout = root.querySelector('select[aria-label="Layout"]');
    for (const value of ['horizontal', 'grid', 'story']) {
      layout.value = value;
      layout.dispatchEvent(new Event('change'));
      expect(root.querySelector('[data-frame-index]').parentElement.classList.contains('shrink-0')).toBe(true);
    }
  });

  it('keeps timeline segments in step with add, duplicate, move and delete', () => {
    const root = mountBoard();
    const segs = () => root.querySelectorAll('[role="listitem"]').length;
    expect(segs()).toBe(3);
    click(btn(root, '+ Add frame'));
    expect(cards(root)).toHaveLength(4);
    expect(segs()).toBe(4);
    click(cards(root)[0].querySelector('[data-act="dup"]'));
    expect(segs()).toBe(5);
    click(cards(root)[0].querySelector('[data-act="del"]'));
    expect(cards(root)).toHaveLength(4);
    expect(segs()).toBe(4);
  });

  it('edits a frame duration and updates the total', () => {
    const root = mountBoard();
    type(cards(root)[0].querySelector('input[type="number"]'), '9');
    expect(root.querySelector('#board-summary').textContent).toContain('15s'); // 9 + 3 + 3
  });

  it('undo restores a deleted frame', () => {
    const root = mountBoard();
    click(cards(root)[1].querySelector('[data-act="del"]'));
    expect(cards(root)).toHaveLength(2);
    click([...root.querySelectorAll('button')].find((b) => b.textContent.includes('Undo')));
    expect(cards(root)).toHaveLength(3);
  });
});

describe('generation', () => {
  it('Generate all frames fills each described frame and updates the right buttons', async () => {
    const root = mountBoard();
    const textareas = cards(root).map((c) => c.querySelector('textarea'));
    type(textareas[0], 'A runner at dawn');
    type(textareas[2], 'A close up of laces');
    const genAll = btn(root, 'Generate all frames');
    click(genAll);
    await vi.waitFor(() => expect(genAll.textContent).toBe('Generate all frames'));
    await new Promise((r) => setTimeout(r, 0));
    expect(muapi.generateImage).toHaveBeenCalledTimes(2); // the empty frame is skipped
    const labels = cards(root).map((c) => c.querySelector('[aria-label^="Generate frame"]').textContent);
    expect(labels).toEqual(['Regenerate', 'Generate frame', 'Regenerate']);
    expect(cards(root)[0].querySelector('img').src).toBe('https://img/frame.png');
    expect(root.querySelector('.progress-label').textContent).toBe('2/2');
  });

  it('sends the negative prompt from Generation settings to the image call', async () => {
    const root = mountBoard();
    type([...root.querySelectorAll('details input[type="text"]')].find((i) => /blurry/.test(i.placeholder)), 'blurry');
    type(cards(root)[0].querySelector('textarea'), 'A street');
    click(cards(root)[0].querySelector('[aria-label^="Generate frame"]'));
    await vi.waitFor(() => expect(muapi.generateImage).toHaveBeenCalled());
    expect(muapi.generateImage.mock.calls[0][0].negative_prompt).toBe('blurry');
  });
});

describe('save and load', () => {
  it('round-trips through local storage and jumps straight to the board', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('no route')));
    const root = mountBoard();
    type(cards(root)[0].querySelector('textarea'), 'Saved scene');
    root.querySelector('input[aria-label="Project name"]').value = 'demo';
    click(btn(root, 'Save'));
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem('storyboard_projects_v1')).demo).toBeTruthy());

    root.remove(); // only one studio is ever on screen
    const root2 = mount();
    expect(cards(root2)).toHaveLength(0);
    // The toolbar is hidden on the describe view; loading must reveal the board.
    root2.querySelector('input[aria-label="Project name"]').value = 'demo';
    click(btn(root2, 'Load'));
    await vi.waitFor(() => expect(cards(root2)[0].querySelector('textarea').value).toBe('Saved scene'));
    expect(isHidden(root2.querySelector('[aria-label="Storyboard tools"]'))).toBe(false);
  });
});
