import { describe, it, expect, vi } from 'vitest';
import '../index.js';
import {
  END_SCREENS, CONNECT_FORMS, LEAD_FORMS, applyCallSetup, TEMPLATE_LIBRARIES, templateToPreset, templateStart, templatePreviewProject, unknownTemplateTypes,
} from '../templateLibrary.js';
import { presetToClips } from '../overlayPresets.js';
import { openTemplateWindow } from '../templateWindow.js';
import { ctaTarget } from '../ctaLink.js';
import { safeHref } from '../overlayRender.js';
import { timelineToComposition } from '../../remotion/timelineToComposition.js';

const ALL = [...END_SCREENS, ...CONNECT_FORMS, ...LEAD_FORMS];

describe('End Screen and Connect Form templates', () => {
  it('ship starter sets made of registered addons', () => {
    expect(END_SCREENS.length).toBeGreaterThanOrEqual(6);
    expect(CONNECT_FORMS.length).toBeGreaterThanOrEqual(4);
    expect(unknownTemplateTypes()).toEqual([]);
    expect(new Set(ALL.map((t) => t.id)).size).toBe(ALL.length);
  });

  it('every template expands to clips inside the timeline', () => {
    ALL.forEach((tpl) => {
      const T = 60;
      const start = templateStart(tpl, 'end', { timelineSeconds: T });
      const clips = presetToClips(templateToPreset(tpl), start, T);
      expect(clips).toHaveLength(tpl.items.length);
      clips.forEach((c) => {
        expect(c.start).toBeGreaterThanOrEqual(0);
        expect(c.end).toBeLessThanOrEqual(T);
        expect(c.end).toBeGreaterThan(c.start);
      });
    });
  });

  it('flat interactive items keep their own options (and the default style)', () => {
    const tpl = LEAD_FORMS.find((t) => t.id === 'cf-book-call');
    const [form, , button] = presetToClips(templateToPreset(tpl), 10, 60);
    expect(form.type).toBe('lead-form');
    expect(form.addon).toBeUndefined();
    expect(form.fields.map((f) => f.id)).toEqual(['name', 'email', 'phone']);
    expect(form.style.buttonColor).toBe('#22d3ee');
    expect(button.type).toBe('click-to-call');
    expect(button.phoneNumber).toMatch(/555 010 0100/);
    expect(button.style).toMatchObject({ posTop: 60 });
  });

  it('connect forms make their phone numbers click-to-call', () => {
    const tpl = CONNECT_FORMS.find((t) => t.id === 'cf-contact-card');
    const texts = tpl.items.filter((i) => i.type === 'overlay-text').map((i) => ctaTarget(i.addon)).filter(Boolean);
    expect(texts.find((t) => t.kind === 'phone')).toMatchObject({ href: 'tel:+15550100100' });
    expect(texts.map((t) => t.href)).toContain('mailto:hello@example.com');
  });

  it('Connect Form is click-to-call only, and "Use" swaps in the user\'s number', () => {
    CONNECT_FORMS.forEach((t) => expect(t.items.some((i) => i.type === 'click-to-call' || i.addon?.linkMode === 'phone')).toBe(true));
    CONNECT_FORMS.forEach((t) => expect(t.items.some((i) => i.type === 'lead-form')).toBe(false));
    const tpl = applyCallSetup(CONNECT_FORMS.find((t) => t.id === 'cf-contact-card'), { phone: '212 555 0147', country: '44', buttonText: 'Ring us', notify: 'me@x.io' });
    const [button] = presetToClips(templateToPreset(applyCallSetup(CONNECT_FORMS[0], { phone: '212 555 0147', country: '44', buttonText: 'Ring us', notify: 'me@x.io' })), 0, 30).filter((c) => c.type === 'click-to-call');
    expect(button).toMatchObject({ phoneNumber: '+44 212 555 0147', buttonText: 'Ring us', callNotifyAddress: 'me@x.io' });
    const card = tpl.items.find((i) => i.addon?.linkMode === 'phone');
    expect(card.addon).toMatchObject({ phoneCountry: '44', phoneNumber: '212 555 0147' });
    expect(card.addon.text).toContain('212 555 0147');
    expect(applyCallSetup(CONNECT_FORMS[0], {})).toBe(CONNECT_FORMS[0]);
  });

  it('safeHref accepts real mailto links only', () => {
    expect(safeHref('mailto:hello@example.com')).toBe('mailto:hello@example.com');
    expect(safeHref('mailto:javascript:alert(1)')).toBeNull();
  });

  it('end screens anchor at the end, connect forms at the playhead', () => {
    const tpl = END_SCREENS[0];
    expect(templateStart(tpl, 'end', { timelineSeconds: 30 })).toBe(30 - tpl.duration);
    expect(templateStart(CONNECT_FORMS[0], 'playhead', { playheadSec: 12, timelineSeconds: 30 })).toBe(12);
    expect(templateStart(CONNECT_FORMS[0], 'playhead', { playheadSec: 29, timelineSeconds: 30 })).toBe(30 - CONNECT_FORMS[0].duration);
  });

  it('previews render through the composition (CTA drawn, form left to the UI)', () => {
    const model = timelineToComposition(templatePreviewProject(CONNECT_FORMS[0], presetToClips), { quality: '720p' });
    expect(model.layers.some((l) => l.type === 'cta-button')).toBe(true);
    expect(model.layers.some((l) => l.type === 'overlay-text')).toBe(true);
  });

  it('the window previews the selected template and inserts it on "Use template"', async () => {
    const engine = { update: vi.fn(), play: vi.fn(), seekToFrame: vi.fn(), destroy: vi.fn() };
    const createEngine = vi.fn(() => engine);
    const onUse = vi.fn();
    const buildModel = vi.fn((p) => timelineToComposition(p, { quality: '720p' }));
    const win = openTemplateWindow({ library: 'connect', onUse, buildModel, createEngine });
    await vi.waitFor(() => expect(createEngine).toHaveBeenCalled());
    expect(win.el.querySelectorAll('.tpl-win__item')).toHaveLength(CONNECT_FORMS.length);
    win.el.querySelector('[data-tpl="cf-call-bar"]').click();
    win.el.querySelector('.tpl-win__phone').value = '212 555 0147';
    win.el.querySelector('.tpl-win__use').click();
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ id: 'cf-call-bar' }), TEMPLATE_LIBRARIES.connect);
    expect(onUse.mock.calls[0][0].items[0].flat.phoneNumber).toBe('+1 212 555 0147');
    expect(document.querySelector('.tpl-win')).toBeNull();
    expect(engine.destroy).toHaveBeenCalled();
  });
});
