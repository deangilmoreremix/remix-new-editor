// @vitest-environment jsdom
// A Lead Generator with a design, played the way a viewer plays a published video (interactive player + lead form):
// the design is drawn, the form holds the video until it is sent, and the answers reach the lead handler under the field names.
import { describe, it, expect, vi } from 'vitest';
import { createInteractivePlayer } from '../interactivePlayer.js';
import { OPTIN_DESIGNS, applyOptinDesign, leadFormToOptin, applyOptinToLeadForm } from '../../addons/index.js';

const T = 20;
const pct = (sec) => (sec / T) * 100;
const clipAt = (start, end, extra) => ({ left: pct(start), width: pct(end - start), ...extra });

function fakeEngine() {
  const e = { frame: 0, playing: false, model: null, onFrame: null };
  const create = (host, o) => {
    e.model = o.model; e.onFrame = o.onFrame; e.onEnded = o.onEnded;
    return { play: () => { e.playing = true; }, pause: () => { e.playing = false; }, seekToFrame: (f) => { e.frame = f; }, update: (m) => { e.model = m; }, destroy: vi.fn() };
  };
  e.advance = (sec) => { if (e.playing) { e.frame = Math.round(sec * 30); e.onFrame(e.frame); } };
  return { e, create };
}

/** A Lead Generator clip as the editor saves it after the design is picked in the panel. */
function savedClip(design, scheme = '') {
  const clip = { id: 'lf', type: 'lead-form', heading: 'Please enter your details to find out more', ctaText: 'Play', fields: [{ id: 'email', type: 'email', label: 'Email' }], style: {} };
  const base = leadFormToOptin(clip);
  applyOptinToLeadForm(clip, { ...base, ...applyOptinDesign(base, design, scheme) });
  return JSON.parse(JSON.stringify(clip)); // saved and published: plain JSON
}

describe('published video: Lead Generator designs', () => {
  it.each(OPTIN_DESIGNS.map((d) => [d.id, d]))('%s: drawn, holds the video, and sends the answers', async (id, design) => {
    document.body.innerHTML = '';
    const frame = document.createElement('div');
    document.body.appendChild(frame);
    const { e, create } = fakeEngine();
    const clip = savedClip(design);
    const project = {
      version: 1, title: 'Demo', timelineSeconds: T, listBuilder: null,
      tracks: [{ id: 'v', type: 'video', items: [clipAt(0, 20, { id: 'vid', type: 'video', src: 'https://cdn/x.mp4' })] }, { id: 't', type: 'text', items: [clipAt(5, 6, clip)] }],
    };
    const onLead = vi.fn(async () => ({ stored: true, error: null }));
    const player = createInteractivePlayer({ project, stage: frame, frame, createEngine: create, onLead });
    player.play();
    e.advance(5.5);
    const form = frame.querySelector('.addon-overlay--optin form');
    expect(form, 'form is shown at its time').not.toBeNull();
    expect(form.dataset.design).toBe(id);
    expect(player.playing).toBe(false); // the video is held until the form is sent
    // fill every box (a stepped design is walked through; a quiz question is answered)
    const steps = Number(form.dataset.steps || 1);
    for (let s = 0; s < steps; s += 1) {
      form.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([data-trap]), select').forEach((el) => {
        if (el.closest('[hidden]') || el.tagName === 'SELECT') return;
        el.value = el.type === 'email' ? 'ann@example.com' : 'Ann';
      });
      const radio = form.querySelector('.optin-choice input[type="radio"]');
      if (radio) radio.checked = true;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await new Promise((r) => setTimeout(r, 0));
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(onLead).toHaveBeenCalledTimes(1);
    const sent = onLead.mock.calls[0][0];
    expect(sent).toMatchObject({ clipId: 'lf', kind: 'lead-form' });
    expect(sent.data.EMAIL).toBe('ann@example.com');
    // one answer per box, keyed by the box's field name
    const names = leadFormToOptin(clip).elements.map((x) => x.token);
    names.forEach((n) => expect(sent.data[n], `${id}: ${n}`).toBeTruthy());
    expect(player.playing).toBe(true); // released
    expect(frame.querySelector('.addon-overlay--optin')).toBeNull();
    player.destroy();
  });
});

describe('published video: a design in a colour scheme', () => {
  it.each(['amber', 'cyan', 'pink'])('%s: the recoloured design is what the viewer sees (and it still sends the lead)', async (scheme) => {
    for (const id of ['aurora-glass', 'vip-access', 'editorial-minimalist', 'cosmic-portal']) {
      document.body.innerHTML = '';
      const frame = document.createElement('div');
      document.body.appendChild(frame);
      const { e, create } = fakeEngine();
      const design = OPTIN_DESIGNS.find((d) => d.id === id);
      const clip = savedClip(design, scheme);
      const own = savedClip(design);
      expect(leadFormToOptin(clip).colorScheme, id).toBe(scheme);
      const project = { version: 1, title: 'Demo', timelineSeconds: T, listBuilder: null, tracks: [{ id: 'v', type: 'video', items: [clipAt(0, 20, { id: 'vid', type: 'video', src: 'https://cdn/x.mp4' })] }, { id: 't', type: 'text', items: [clipAt(5, 6, clip)] }] };
      const onLead = vi.fn(async () => ({ stored: true }));
      const player = createInteractivePlayer({ project, stage: frame, frame, createEngine: create, onLead });
      player.play();
      e.advance(5.5);
      const form = frame.querySelector('.addon-overlay--optin form');
      expect(form.dataset.design).toBe(id);
      // the Play button wears the scheme's colour, not the design's own
      const own1 = leadFormToOptin(own).buttonBackground;
      const now = leadFormToOptin(clip).buttonBackground;
      expect(now, id).not.toBe(own1);
      expect(form.querySelector('button[type="submit"]').style.background, id).toContain('rgb');
      form.querySelectorAll('input:not([type="radio"]):not([data-trap])').forEach((el) => { el.value = el.type === 'email' ? 'ann@example.com' : 'Ann'; });
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await new Promise((r) => setTimeout(r, 0));
      expect(onLead, id).toHaveBeenCalledTimes(1);
      player.destroy();
    }
  });
});
