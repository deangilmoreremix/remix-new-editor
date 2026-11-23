// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { findHelp, place } from '../tooltipLayer.js';
import { resolveStudioHelp, helpKey, STUDIO_HELP } from '../../../lib/help/studioHelp.js';

describe('studioHelp', () => {
  it('normalizes labels (case, shortcut suffix, trailing ellipsis)', () => {
    expect(helpKey('Generate (Ctrl+Enter)')).toBe('generate');
    expect(helpKey('  Advanced… ')).toBe('advanced');
    expect(resolveStudioHelp('Aspect  Ratio')?.name).toBe('Aspect Ratio');
  });
  it('returns null for unknown labels', () => {
    expect(resolveStudioHelp('Totally unknown control')).toBeNull();
  });
  it('every entry has a name and keys are already normalized', () => {
    for (const [key, entry] of Object.entries(STUDIO_HELP)) {
      expect(entry.name, key).toBeTruthy();
      expect(helpKey(key), key).toBe(key);
    }
  });
});

describe('findHelp', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('resolves copy from aria-label', () => {
    document.body.innerHTML = '<button aria-label="Seed"><svg></svg></button>';
    const hit = findHelp(document.querySelector('svg')?.parentElement);
    expect(hit?.entry.name).toBe('Seed');
  });

  it('prefers data-help over other attributes', () => {
    document.body.innerHTML = '<button data-help="negative prompt" title="x">?</button>';
    expect(findHelp(document.querySelector('button'))?.entry.name).toBe('Negative Prompt');
  });

  it('themes a plain data-tooltip / title when there is no copy', () => {
    document.body.innerHTML = '<button data-tooltip="Custom hint">?</button>';
    expect(findHelp(document.querySelector('button'))?.entry).toEqual({ name: 'Custom hint' });
  });

  it('does not use aria-label alone as a plain tooltip', () => {
    document.body.innerHTML = '<button aria-label="Close dialog">x</button>';
    expect(findHelp(document.querySelector('button'))).toBeNull();
  });

  it('skips the Timeline Editor, which has its own help layer', () => {
    document.body.innerHTML = '<div class="cinegen-root"><button aria-label="Seed">s</button></div>';
    expect(findHelp(document.querySelector('button'))).toBeNull();
  });
});

describe('place', () => {
  const rect = (o) => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, ...o });
  it('opens below a wide control when there is room', () => {
    const p = place(rect({ left: 100, right: 300, top: 50, bottom: 90, width: 200, height: 40 }), 200, 60, 1000, 800);
    expect(p.top).toBe(100);
  });
  it('flips above near the bottom edge', () => {
    const p = place(rect({ left: 100, right: 300, top: 740, bottom: 780, width: 200, height: 40 }), 200, 60, 1000, 800);
    expect(p.top).toBe(670);
  });
  it('opens beside small icon controls', () => {
    const p = place(rect({ left: 10, right: 42, top: 100, bottom: 132, width: 32, height: 32 }), 200, 60, 1000, 800);
    expect(p.left).toBe(52);
  });
  it('clamps inside the viewport horizontally', () => {
    const p = place(rect({ left: 950, right: 1000, top: 50, bottom: 90, width: 50, height: 40 }), 300, 60, 1000, 800);
    expect(p.left + 300).toBeLessThanOrEqual(990);
  });
});

// ── Coverage regressions found while auditing the live studios ────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ALIASES, idLabels } from '../../../lib/help/studioHelp.js';
import { STUDIO_TIP_ACCENTS, getStudioTipAccent } from '../../../lib/config/openaiConfig.js';
import { STUDIO_ROUTES } from '../../../lib/studioRoutes.js';

describe('label normalization and aliases', () => {
  it('drops icons, emoji and count badges', () => {
    expect(helpKey('Generate ✨')).toBe('generate');
    expect(helpKey('↻ Regenerate')).toBe('regenerate');
    expect(helpKey('Image Effects (18)')).toBe('image effects');
    expect(helpKey('🖼 Thumbnail')).toBe('thumbnail');
  });
  it('resolves descriptive sentences to the entry they describe', () => {
    expect(resolveStudioHelp('Show advanced options')?.name).toBe('Advanced');
    expect(resolveStudioHelp('Change aspect ratio')?.name).toBe('Aspect Ratio');
    expect(resolveStudioHelp('Select AI generation model')?.name).toBe('Model');
    expect(resolveStudioHelp('Browse reference scene from Pexels')?.name).toBe('Stock photos');
    expect(resolveStudioHelp('Show all 272 image prompts')?.name).toBe('Prompt gallery');
    expect(resolveStudioHelp('Describe the motion or effect (optional)')?.name).toBe('Motion prompt');
  });
  it('every alias points at a real entry', () => {
    for (const [from, to] of Object.entries(ALIASES)) expect(STUDIO_HELP[to], `${from} -> ${to}`).toBeTruthy();
  });
  it('derives labels from control ids, with and without the prefix and suffix', () => {
    expect(idLabels('v-duration-btn')).toContain('duration');
    expect(idLabels('v-motion-style-btn')).toContain('motion style');
    expect(idLabels('viral-lang-toggle')).toContain('viral lang toggle');
    expect(idLabels('')).toEqual([]);
  });
});

describe('findHelp resolution order and inheritance', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('a long tooltip sentence does not shadow the visible name that has copy', () => {
    document.body.innerHTML = '<button data-tooltip="Show advanced options">Advanced</button>';
    expect(findHelp(document.querySelector('button'))?.entry.name).toBe('Advanced');
  });
  it('names a value-showing button from its id ("5s" -> Duration)', () => {
    document.body.innerHTML = '<button id="v-duration-btn" data-tooltip="Set video duration">5s</button>';
    expect(findHelp(document.querySelector('button'))?.entry.name).toBe('Duration');
  });
  it('options inherit the copy of a data-help on their list container', () => {
    document.body.innerHTML = '<div data-help="model"><div><button>Some Model v3</button></div></div>';
    expect(findHelp(document.querySelector('button'))?.entry.name).toBe('Model');
  });
  it('a button keeps its own copy over its container\'s', () => {
    document.body.innerHTML = '<div data-help="model"><button>Generate</button></div>';
    expect(findHelp(document.querySelector('button'))?.entry.name).toBe('Generate');
  });
  it('names a bare select from the caption beside it', () => {
    document.body.innerHTML = '<label><span>Duration</span><select><option>3s</option></select></label>';
    expect(findHelp(document.querySelector('select'))?.entry.name).toBe('Duration');
  });
});

describe('tooltip colors match this repo (lime), never the other repo (cyan / purple)', () => {
  const OTHER_REPO = ['#22d3ee', '#06b6d4', '#a855f7', '#9333ea', '#29d3f2'];
  const css = readFileSync(join(process.cwd(), 'src/styles/studio-tooltip.css'), 'utf8').toLowerCase();

  it('every studio route resolves to the brand lime', () => {
    for (const route of Object.keys(STUDIO_ROUTES)) expect(getStudioTipAccent(route), route).toBe('#d9ff00');
  });
  it('the accent table has no overrides, and none could be a color from the other repo', () => {
    for (const hex of Object.values(STUDIO_TIP_ACCENTS)) expect(OTHER_REPO).not.toContain(hex.toLowerCase());
    expect(getStudioTipAccent(undefined)).toBe('#d9ff00');
  });
  it('the tooltip stylesheet uses the lime brand token and none of the other repo\'s colors', () => {
    expect(css).toContain('var(--color-primary, #d9ff00)');
    for (const hex of OTHER_REPO) expect(css, hex).not.toContain(hex);
  });
  it('a plain title / data-tooltip card gets the light text style, not the accent title', () => {
    expect(css).toMatch(/\.studio-tip--plain \.studio-tip__name\s*\{[^}]*var\(--tip-text\)/);
  });
});

describe('data-help keys written in the source', () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === '__tests__' || n === 'node_modules' ? [] : walk(p)) : /\.(js|jsx)$/.test(n) ? [p] : [];
  });
  it('every literal key resolves to copy (dynamic keys are checked by the live audit)', () => {
    const root = join(process.cwd(), 'src');
    const bad = [];
    for (const file of walk(root)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/(?:dataset\.help\s*=|\bhelp:)\s*'([^'$]+)'/g)) if (!resolveStudioHelp(m[1])) bad.push(`${file.replace(root, 'src')}: ${m[1]}`);
    }
    expect(bad).toEqual([]);
  });
});

// ── Studio-level tooltips (sidebar items, Apps hub cards) ───────────────────────────────────────────────────────────────
import { studioEntry } from '../../../lib/help/studioHelp.js';
import { STUDIO_DESCRIPTIONS } from '../../../lib/studioDescriptions.js';
import { NAV_GROUPS } from '../../../lib/studioRoutes.js';

describe('studio-level tooltips', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  // Sidebar studios that have no owner-written description yet. Listed on purpose: a NEW studio without a description fails the test below,
  // and filling one of these in fails it too until the list is updated, so the gap cannot grow or linger unnoticed.
  const AWAITING_DESCRIPTION = [];

  it('the descriptions are the Apps hub cards\' own words (no drift between the two)', () => {
    const hub = readFileSync(join(process.cwd(), 'src/components/AppsHub.js'), 'utf8');
    const cards = [...hub.matchAll(/\{\s*id:\s*'([a-z-]+)',\s*name:\s*'([^']+)',\s*description:\s*'([^']+)'/g)];
    expect(cards.length).toBeGreaterThan(20);
    for (const [, id, name, text] of cards) expect(STUDIO_DESCRIPTIONS[id], id).toEqual({ name, text });
  });
  it('every sidebar studio has a description, except the documented ones', () => {
    const ids = [...new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)))];
    const missing = ids.filter((id) => !STUDIO_DESCRIPTIONS[id]);
    expect(missing).toEqual(AWAITING_DESCRIPTION);
  });
  it('a sidebar icon button resolves to its studio (the label lives in a sibling span, not on the button)', () => {
    document.body.innerHTML = '<div data-sidebar-item="video"><button><svg></svg></button><span>VIDEO</span></div>';
    expect(findHelp(document.querySelector('button'))?.entry).toEqual({ name: 'Video Studio', summary: 'Create AI videos from text and images' });
  });
  it('an Apps hub card resolves to its studio, and an unknown id falls back to normal lookup', () => {
    document.body.innerHTML = '<div data-studio="cinema" title="x"><h3>Cinema Studio</h3></div><div data-studio="nope" title="Fallback"><h3>t</h3></div>';
    const [a, b] = document.querySelectorAll('div[data-studio]');
    expect(findHelp(a)?.entry.name).toBe('Cinema Studio');
    expect(findHelp(b)?.entry).toEqual({ name: 'Fallback' });
  });
  it('studioEntry returns null for a studio with no description instead of guessing', () => {
    expect(studioEntry('zackd')?.name).toBe('Zack D Studio');
    expect(studioEntry('not-a-studio')).toBeNull();
  });
  it('data-help-text carries copy supplied at render time, and long placeholders still match by prefix', () => {
    document.body.innerHTML = '<input placeholder="Persona ID" data-help-text="The voice to apply.">';
    expect(findHelp(document.querySelector('input'))?.entry).toEqual({ name: 'Persona ID', summary: 'The voice to apply.' });
  });
});

describe('patterns for the feature pages found by the all-routes audit', () => {
  it('the motion-graphics prompt resolves to Prompt, not the Animate "motion prompt" (rule order)', () => {
    expect(resolveStudioHelp("Describe the motion graphic \u2014 'Animated sales dashboard'")?.name).toBe('Prompt');
    expect(resolveStudioHelp('Describe the motion or effect (optional)')?.name).toBe('Motion prompt');
  });
  it('generic search is last, so the viral search keeps its own copy', () => {
    expect(resolveStudioHelp('Search prompts, tags, or authors\u2026')?.name).toBe('Search');
    expect(resolveStudioHelp('Search by prompt or model...')?.name).toBe('Search');
    expect(resolveStudioHelp('Search saved content...')?.summary).toMatch(/filter/i);
  });
  it('Director, Photo Studio and Library controls resolve', () => {
    expect(resolveStudioHelp("Type your command (e.g., 'Summarize this video')")?.name).toBe('Command');
    expect(resolveStudioHelp('Describe the look, mood, or specific details...')?.name).toBe('Direction');
    document.body.innerHTML = '<button id="send-command-btn">Send</button><button id="clear-chat-btn">Clear Chat</button><button data-photo-preset="x" data-help-name="Studio white" data-help-text="A clean white studio shot.">Studio white \u00b7 1:1</button>';
    const [send, clear, style] = document.querySelectorAll('button');
    expect(findHelp(send)?.entry.name).toBe('Send');
    expect(findHelp(clear)?.entry.name).toBe('Clear Chat');
    expect(findHelp(style)?.entry).toEqual({ name: 'Studio white', summary: 'A clean white studio shot.' });
  });
});

describe('plain titles vs ancestor copy', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  it('an inner element\'s own title does not hide copy an ancestor has', () => {
    document.body.innerHTML = '<div data-sidebar-item="video"><span title="inner title">VIDEO</span></div>';
    expect(findHelp(document.querySelector('span'))?.entry.name).toBe('Video Studio');
  });
  it('with no copy anywhere, the nearest plain title still wins', () => {
    document.body.innerHTML = '<div title="Outer"><span title="Inner">x</span></div>';
    expect(findHelp(document.querySelector('span'))?.entry).toEqual({ name: 'Inner' });
  });
});
