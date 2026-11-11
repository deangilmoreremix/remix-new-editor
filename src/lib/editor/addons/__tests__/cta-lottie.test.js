import { describe, it, expect } from 'vitest';
import { buildCtaLottie, CTA_ANIMATIONS, ctaBox, CTA_ASPECT, CTA_COLOR_THEMES, ctaColorParts } from '../ctaLottie.js';
import { timelineToComposition } from '../../remotion/timelineToComposition.js';
import { exportWarnings } from '../../remotion/exportWarnings.js';
import { getAddon } from '../registry.js';
import '../index.js';

describe('animated CTA buttons', () => {
  it('builds a valid looping Lottie for every style, with the button text', () => {
    const styles = CTA_ANIMATIONS.map(([id]) => id).filter((id) => id !== 'none');
    expect(styles.length).toBeGreaterThanOrEqual(8);
    styles.forEach((id) => {
      const a = buildCtaLottie({ animation: id, buttonText: 'Book a call', buttonColor: '#123456', textColor: '#ffffff' });
      expect(a).toMatchObject({ w: 600, h: 200, fr: 30, ip: 0, op: 60 });
      expect(a.fonts.list[0].fName).toBe('CTABold');
      const txt = a.layers.find((l) => l.ty === 5);
      expect(txt.t.d.k[0].s.t).toBe('Book a call');
      a.layers.forEach((l) => { expect(l.op).toBe(60); expect(typeof l.ind).toBe('number'); });
      expect(JSON.stringify(a)).toContain('[0.07058823529411765,0.20392156862745098,0.33725490196078434,1]'); // button colour
    });
    expect(buildCtaLottie({ animation: 'none' })).toBeNull();
    expect(buildCtaLottie({ animation: 'shine' }).layers.some((l) => l.td === 1)).toBe(true); // sheen clipped by a matte
  });

  it('keeps the 3:1 button box and scales long labels down', () => {
    const box = ctaBox({ posLeft: 50, posTop: 50, posWidth: 30 }, 16 / 9);
    const h = (30 * 16) / 9 / CTA_ASPECT;
    expect(box.left).toBeCloseTo(35);
    expect(box.width).toBeCloseTo(30);
    expect(box.height).toBeCloseTo(h);
    expect(box.top).toBeCloseTo(50 - h / 2);
    const short = buildCtaLottie({ animation: 'pulse', buttonText: 'Go' }).layers[0].t.d.k[0].s.s;
    const long = buildCtaLottie({ animation: 'pulse', buttonText: 'Schedule your free consultation' }).layers[0].t.d.k[0].s.s;
    expect(long).toBeLessThan(short);
  });

  it('new CTAs are animated; the composition draws them and warns they are not clickable in files', () => {
    expect(getAddon('click-to-call').defaults()).toMatchObject({ animation: 'pulse', fontFamily: 'Montserrat' });
    const state = { timelineSeconds: 10, tracks: [{ id: 't', type: 'text', items: [
      { id: 'c1', type: 'click-to-call', left: 10, width: 30, buttonText: 'Hi {{firstname}}', animation: 'arrow', phoneNumber: '+15551234567', style: { buttonColor: '#00ff00', posWidth: 30 } },
      { id: 'c2', type: 'click-to-call', left: 50, width: 30, buttonText: 'Plain', style: {} },
    ] }] };
    const m = timelineToComposition(state, { profile: { variables: { firstname: 'Ann' } } });
    const [a, b] = m.layers;
    expect(a).toMatchObject({ kind: 'overlay', type: 'cta-button', options: { buttonText: 'Hi Ann', animation: 'arrow', posWidth: 30 } });
    expect(a.options.lottie.layers.length).toBeGreaterThan(1);
    expect(b.options).toMatchObject({ animation: 'none', lottie: null });
    expect(m.skipped).toEqual([]);
    expect(m.fonts).toContain('Montserrat');
    expect(exportWarnings(m).join(' ')).toMatch(/CTA buttons appear in the exported video/);
  });
});

describe('CTA colors', () => {
  it('icon and effect colours are used when set, with sensible defaults', () => {
    const phone = buildCtaLottie({ animation: 'phone', buttonColor: '#112233', textColor: '#ffffff', iconColor: '#00ff00' });
    const phoneLayer = phone.layers.find((l) => l.nm === 'phone');
    expect(JSON.stringify(phoneLayer)).toContain('[0,1,0');
    const ripple = buildCtaLottie({ animation: 'ripple', buttonColor: '#112233', accentColor: '#ff0000' });
    expect(JSON.stringify(ripple.layers.find((l) => /ripple/.test(l.nm)))).toContain('[1,0,0');
    const pulseDefault = buildCtaLottie({ animation: 'pulse', buttonColor: '#ff0000' });
    expect(JSON.stringify(pulseDefault.layers.find((l) => l.nm === 'ring'))).toContain('[1,0,0');
    const sheen = (o) => JSON.stringify(buildCtaLottie({ animation: 'shine', buttonColor: '#123456', ...o }).layers.find((l) => l.nm === 'sheen'));
    expect(sheen({})).toContain('[1,1,1');
    expect(sheen({ accentColor: '#0000ff' })).toContain('[0,0,1');
  });

  it('reports which colour parts a style has, and ships themes', () => {
    expect(ctaColorParts('phone')).toEqual({ icon: true, effect: false });
    expect(ctaColorParts('ripple')).toEqual({ icon: false, effect: true });
    expect(ctaColorParts('none')).toEqual({ icon: false, effect: false });
    CTA_COLOR_THEMES.forEach((t) => ['buttonColor', 'textColor', 'iconColor', 'accentColor'].forEach((k) => expect(t[k]).toMatch(/^#[0-9a-f]{6}$/i)));
  });

  it('the composition passes icon and effect colours through', () => {
    const model = timelineToComposition({ timelineSeconds: 10, tracks: [{ type: 'text', name: 'T', items: [{ id: 1, type: 'click-to-call', left: 0, width: 50, buttonText: 'Go', animation: 'phone', iconColor: '#00ff00', style: { buttonColor: '#111111' } }] }] }, { quality: '720p' });
    const layer = model.layers.find((l) => l.type === 'cta-button');
    expect(layer.options.iconColor).toBe('#00ff00');
    expect(JSON.stringify(layer.options.lottie)).toContain('[0,1,0');
  });
});
