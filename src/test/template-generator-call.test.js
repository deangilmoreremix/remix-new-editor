// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { STEPS, createWizardState, animationRef, phoneValid, callMissing, toggleAnimation } from '../components/modals/template-generator/rules.js';
import { createTemplateStore, snapshotTemplate, restoreTemplate } from '../components/modals/template-generator/templates.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const card = { id: 'tpl:cf-call-now', kind: 'animation', source: 'endscreens', title: 'Call now', badge: 'CALL', category: 'connect', duration: 8, needsPhone: true, placeAt: 'spread', poster: '/overlay-templates/thumbs/cf-call-now.jpg' };
const plain = { id: 'tpl:es-subscribe', kind: 'animation', source: 'endscreens', title: 'Subscribe', badge: 'END SCREEN', category: 'endScreens', duration: 6, placeAt: 'end', poster: '' };

describe('Call button rules', () => {
  it('validates a phone number loosely (6 to 15 digits, any formatting)', () => {
    for (const ok of ['555 010 0100', '(555) 010-0100', '+44 20 7946 0958', '5550100']) expect(phoneValid(ok), ok).toBe(true);
    for (const bad of ['', '   ', '12345', 'call me', '1'.repeat(16)]) expect(phoneValid(bad), bad).toBe(false);
  });

  it('a Connect form is saved with its (empty) call details; other forms are not', () => {
    expect(animationRef(card)).toMatchObject({ needsPhone: true, call: { phone: '', country: '1', buttonText: '' } });
    expect(animationRef(plain).needsPhone).toBeUndefined();
    const s = createWizardState();
    toggleAnimation(s, card); toggleAnimation(s, plain);
    expect(callMissing(s).map((a) => a.id)).toEqual(['tpl:cf-call-now']);
    s.selectedAnimations[0].call.phone = '555 010 0100';
    expect(callMissing(s)).toEqual([]);
  });

  it('the number travels in saved templates', () => {
    const s = createWizardState(); toggleAnimation(s, card); s.selectedAnimations[0].call = { phone: '555 010 0100', country: '44', buttonText: 'Ring us' };
    const back = restoreTemplate(JSON.parse(JSON.stringify(snapshotTemplate(s, { name: 'T' }))), () => null);
    expect(back.selectedAnimations[0].call).toEqual({ phone: '555 010 0100', country: '44', buttonText: 'Ring us' });
  });
});

describe('Preview step — Call button panel', () => {
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });
  const open = (extra = {}) => {
    vi.stubGlobal('VideoEncoder', function VideoEncoder() {});
    const resolve = vi.fn(async (ref) => ({ templateId: ref.id.replace(/^tpl:/, ''), ...(ref.call?.phone ? { call: ref.call } : {}) }));
    const endscreens = { id: 'endscreens', label: 'End screens & forms', blurb: '', filters: [['all', 'All']], search: async () => ({ items: [card, plain], hasMore: false }), resolve };
    const onConfirm = vi.fn();
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', templateCatalog: async () => { throw new Error('offline'); }, stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()), extraSources: [endscreens], onConfirm, ...extra });
    m.open(); m.s.started = true; m.s.selectedVideos = [1, 2].map((n) => ({ id: `v${n}`, kind: 'video', source: 'x', title: `C${n}`, url: `https://x.test/${n}.mp4`, poster: '', duration: 6 }));
    m.s.script.text = 'One.\nTwo.'; m.s.step = STEPS.PREVIEW;
    toggleAnimation(m.s, card); m.paint();
    return { m, resolve, onConfirm };
  };

  it('asks for the number, validates it as you type, and keeps the field focused', () => {
    const { m } = open();
    expect(document.querySelector('.tg-call-row b').textContent).toBe('Call now');
    const hint = () => document.querySelector('[data-call-hint]');
    expect(hint().classList.contains('tg-status--warn')).toBe(true);
    const field = document.querySelector('input[data-call$="|phone"]'); field.focus();
    field.value = '555 010 0100'; field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(m.s.selectedAnimations[0].call.phone).toBe('555 010 0100');
    expect(hint().textContent).toContain('will dial'); expect(hint().classList.contains('tg-status--warn')).toBe(false);
    expect(document.activeElement).toBe(field);                       // typing never repaints the panel
    const country = document.querySelector('select[data-call$="|country"]'); country.value = '44'; country.dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.s.selectedAnimations[0].call.country).toBe('44');
    m.destroy();
  });

  it('will not add the template to the timeline (or export) until a number is given, then passes it on', async () => {
    const exportVideo = vi.fn(async () => ({ filename: 'a.mp4', fileSize: 0 }));
    const { m, resolve, onConfirm } = open({ exportVideo });
    m.paint();
    await m.addToTimeline();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.querySelector('.tg-toast, #tg-toast')?.textContent || m.ui.toast).toContain('phone number');
    document.querySelector('#tg-export').click();
    await vi.waitFor(() => expect(document.querySelector('#tg-exportstatus .tg-status--error').textContent).toContain('phone number'));
    expect(exportVideo).not.toHaveBeenCalled();
    m.s.selectedAnimations[0].call = { phone: '555 010 0100', country: '1', buttonText: 'Call us' };
    await m.addToTimeline();
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ call: { phone: '555 010 0100', country: '1', buttonText: 'Call us' } }));
    const comp = onConfirm.mock.calls[0][0].composition;
    const anim = comp.tracks.flatMap((t) => t.clips).find((c) => c.type === 'animation');
    expect(anim._overlayConfig.animation).toMatchObject({ templateId: 'cf-call-now', call: { phone: '555 010 0100' } });
  });

  it('shows no panel when no Connect form is picked', () => {
    const { m } = open();
    m.s.selectedAnimations = []; toggleAnimation(m.s, plain); m.paint();
    expect(document.querySelector('.tg-call-row')).toBeNull();
    m.destroy();
  });
});
