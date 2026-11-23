// @vitest-environment jsdom
// When a published Lead Generator appears: on the timeline (default), at the end, when the viewer pauses, on exit intent.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInteractivePlayer } from '../interactivePlayer.js';
import { AddonRuntime, END_GATE_LEAD } from '../../addons/runtime.js';
import { listBuilderFields, defaultOptin, leadFormToOptin, applyOptinToLeadForm, LEAD_TRIGGERS } from '../../addons/index.js';

const T = 20;
const pct = (s) => (s / T) * 100;
const lead = (extra = {}) => ({ left: pct(5), width: pct(1), id: 'lf', type: 'lead-form', heading: 'Hi', fields: [{ id: 'email', type: 'email', label: 'Email', required: true }], ctaText: 'Send', ...extra });
const projectWith = (clip, listBuilder = null) => ({
  version: 1, title: 'Demo', timelineSeconds: T, listBuilder,
  tracks: [{ id: 'v', type: 'video', items: [{ left: 0, width: 100, id: 'vid', type: 'video', src: 'https://cdn/x.mp4' }] }, { id: 't', type: 'text', items: [clip] }],
});
function fakeEngine() {
  const e = { frame: 0, playing: false, model: null, onFrame: null };
  const create = (host, o) => {
    e.model = o.model; e.onFrame = o.onFrame; e.onEnded = o.onEnded;
    return { play: () => { e.playing = true; }, pause: () => { e.playing = false; }, seekToFrame: (f) => { e.frame = f; }, update: (m) => { e.model = m; }, destroy: vi.fn() };
  };
  e.advance = (sec) => { if (e.playing) { e.frame = Math.round(sec * 30); e.onFrame(e.frame); } };
  return { e, create };
}
const formUp = (frame) => !!frame.querySelector('.addon-overlay--optin form');
let frame;
const start = (clip, opts = {}) => {
  const { e, create } = fakeEngine();
  const player = createInteractivePlayer({ project: projectWith(clip, opts.listBuilder), stage: frame, frame, createEngine: create, onLead: vi.fn(async () => ({ stored: true })) });
  return { e, player };
};
const mouseOut = (clientY, relatedTarget = null) => { const ev = new MouseEvent('mouseout', { clientY, bubbles: true, relatedTarget }); document.dispatchEvent(ev); };

beforeEach(() => { document.body.innerHTML = ''; frame = document.createElement('div'); document.body.appendChild(frame); });

describe('timeline (default)', () => {
  it('gates at its place on the timeline', () => {
    const { e, player } = start(lead());
    player.play(); e.advance(5.2);
    expect(player.playing).toBe(false); expect(formUp(frame)).toBe(true);
  });
});

describe("trigger: 'end'", () => {
  it('shows just before the last frame, not at its timeline position', () => {
    const { e, player } = start(lead({ trigger: 'end' }));
    player.play(); e.advance(5.2);
    expect(formUp(frame)).toBe(false);
    e.advance(T - END_GATE_LEAD + 0.05);
    expect(formUp(frame)).toBe(true); expect(player.playing).toBe(false);
  });
});

describe("trigger: 'pause'", () => {
  it('does not gate on the timeline; shows when the viewer pauses, once', async () => {
    const { e, player } = start(lead({ trigger: 'pause' }));
    player.play(); e.advance(5.2);
    expect(formUp(frame)).toBe(false); expect(player.playing).toBe(true);
    player.toggle(); // the viewer pauses
    expect(formUp(frame)).toBe(true); expect(player.playing).toBe(false);
    frame.querySelector('.addon-overlay--optin .skip-button')?.click();
    frame.innerHTML = ''; // form closed
    player.toggle(); player.toggle();
    expect(formUp(frame)).toBe(false); // already shown once
  });
  it('resumes after the form is submitted', async () => {
    const { e, player } = start(lead({ trigger: 'pause' }));
    player.play(); e.advance(3); player.toggle();
    const form = frame.querySelector('.addon-overlay--optin form');
    form.querySelector('input[name="EMAIL"]').value = 'a@b.co';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(player.playing).toBe(true));
    player.toggle(); expect(formUp(frame)).toBe(false); // submitted: never again
  });
});

describe("trigger: 'exit'", () => {
  it('shows when the pointer leaves through the top of the window, not elsewhere', () => {
    const { e, player } = start(lead({ trigger: 'exit' }));
    player.play(); e.advance(3);
    mouseOut(300); expect(formUp(frame)).toBe(false); // left through the side/bottom
    mouseOut(0, document.body); expect(formUp(frame)).toBe(false); // moved onto another element
    mouseOut(0); expect(formUp(frame)).toBe(true); expect(player.playing).toBe(false);
  });
  it('never while a wall is up, and stops listening when destroyed', () => {
    const wall = { enabled: true, kind: 'list-builder', elements: [{ id: 0, label: 'Email', token: 'EMAIL', type: 'email', required: true }] };
    const a = start(lead({ trigger: 'exit' }), { listBuilder: wall });
    mouseOut(0);
    expect(frame.querySelector('[data-overlay="lead-form"]')).toBeNull();
    a.player.destroy();
    document.body.innerHTML = ''; frame = document.createElement('div'); document.body.appendChild(frame);
    const { player } = start(lead({ trigger: 'exit' }));
    player.destroy(); mouseOut(0);
    expect(frame.querySelector('.addon-overlay--optin')).toBeNull();
  });
});

describe('runtime', () => {
  it("only 'time' and 'end' gate on the playhead", () => {
    for (const trigger of ['pause', 'exit']) {
      const rt = new AddonRuntime();
      const actions = rt.tick(4.9, 5.2, { clips: [{ ...lead({ trigger }), start: 5, end: 6 }], timelineSeconds: T });
      expect(actions.some((a) => a.type === 'show')).toBe(false);
    }
  });
});

describe('settings', () => {
  it('the trigger is a Lead Generator option, kept on the clip', () => {
    const shown = (o) => listBuilderFields(o).filter((f) => !f.showIf || f.showIf(o)).map((f) => f.key);
    expect(shown(defaultOptin('lead-generator'))).toContain('trigger');
    expect(shown(defaultOptin('list-builder'))).not.toContain('trigger');
    expect(LEAD_TRIGGERS.map(([k]) => k)).toEqual(['time', 'end', 'pause', 'exit']);
    const clip = { fields: [] };
    applyOptinToLeadForm(clip, { elements: [{ id: 'e', type: 'email', label: 'Email' }], trigger: 'pause' });
    expect(clip.trigger).toBe('pause');
    expect(leadFormToOptin(clip).trigger).toBe('pause');
  });
});

describe('A/B test in the player', () => {
  const setup = (clip, listBuilder = null, rand) => {
    const { e, create } = fakeEngine();
    const onLead = vi.fn(async () => ({ stored: true }));
    const storage = new Map();
    Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) }, configurable: true });
    const player = createInteractivePlayer({ project: projectWith(clip, listBuilder), stage: frame, frame, createEngine: create, onLead, rememberKey: 'vid-ab' });
    return { e, player, onLead, storage };
  };
  it('shows version B text and sends the version with the lead (Lead Generator)', async () => {
    const mathRandom = vi.spyOn(Math, 'random').mockReturnValue(0.9); // -> B
    const { e, player, onLead } = setup(lead({ design: { abTest: true, variantBCaption: 'Version B caption' } }));
    player.play(); e.advance(5.2);
    expect(frame.querySelector('.retarget-caption').textContent).toBe('Version B caption');
    const form = frame.querySelector('.addon-overlay--optin form');
    form.querySelector('input[name="EMAIL"]').value = 'a@b.co';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(onLead).toHaveBeenCalled());
    expect(onLead.mock.calls[0][0].variant).toBe('B');
    mathRandom.mockRestore();
  });
  it('version A keeps the original text; a form that is not tested sends no version at all', async () => {
    const mathRandom = vi.spyOn(Math, 'random').mockReturnValue(0.1); // -> A
    const a = setup(lead({ design: { abTest: true, variantBCaption: 'Version B caption' } }));
    a.player.play(); a.e.advance(5.2);
    expect(frame.querySelector('.retarget-caption').textContent).toBe('Hi');
    mathRandom.mockRestore();
    document.body.innerHTML = ''; frame = document.createElement('div'); document.body.appendChild(frame);
    const plain = setup(lead());
    plain.player.play(); plain.e.advance(5.2);
    const form = frame.querySelector('.addon-overlay--optin form');
    form.querySelector('input[name="EMAIL"]').value = 'a@b.co';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(plain.onLead).toHaveBeenCalled());
    expect(plain.onLead.mock.calls[0][0]).not.toHaveProperty('variant');
  });
});
