// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  OPTIN_DESIGNS, OPTIN_DESIGN_CATEGORIES, DESIGN_BASE, getOptinDesign, safeDesignId, designThumb,
  defaultOptin, buildOptinForm, listBuilderFields, renderAddonEditor, leadFormToOptin, applyOptinToLeadForm,
} from '../index.js';

const KINDS = ['list-builder', 'personalizer', 'lead-generator'];

describe('30 opt-in designs', () => {
  it('ships 30 uniquely named designs, each in a known category', () => {
    expect(OPTIN_DESIGNS).toHaveLength(30);
    expect(new Set(OPTIN_DESIGNS.map((d) => d.id)).size).toBe(30);
    const cats = new Set(OPTIN_DESIGN_CATEGORIES.map(([id]) => id));
    OPTIN_DESIGNS.forEach((d) => { expect(cats.has(d.category)).toBe(true); expect(d.id).toMatch(/^[a-z0-9-]+$/); });
  });

  it('only patches options that exist on the form, so every value stays editable', () => {
    const known = new Set(Object.keys(defaultOptin('list-builder')));
    OPTIN_DESIGNS.forEach((d) => {
      expect(d.patch.designPreset).toBe(d.id);
      Object.keys(d.patch).forEach((k) => expect(known.has(k), `${d.id}: ${k}`).toBe(true));
      // a design resets every look option, so picking one after another never mixes them
      Object.keys(DESIGN_BASE).forEach((k) => expect(k in d.patch, `${d.id} lacks ${k}`).toBe(true));
    });
  });

  it('never overwrites the creator\'s copy or fields', () => {
    OPTIN_DESIGNS.forEach((d) => ['caption', 'btnText', 'elements', 'privacyDisclaimer', 'successMessage'].forEach((k) => expect(k in d.patch).toBe(false)));
  });

  it.each(KINDS)('every design builds a form for %s with the design hooks and the same features', (kind) => {
    OPTIN_DESIGNS.forEach((d) => {
      const cfg = { ...defaultOptin(kind), ...d.patch, caption: 'Hello', requireConsent: true, enableSkipButton: true, multiStep: false };
      const form = buildOptinForm(cfg);
      expect(form.dataset.design).toBe(d.id);
      expect(form.querySelector('.retarget-caption').textContent).toBe('Hello');
      expect(form.querySelector('button[type="submit"]')).not.toBeNull();
      expect(form.querySelector('.skip-button')).not.toBeNull();
      expect(form.querySelector('.optin-consent input').required).toBe(true);
      expect(form.querySelectorAll('.input-wrapper > *').length).toBe(cfg.elements.length);
    });
  });

  it('split layout puts the title left and the boxes right; the testimonial design keeps the title with the form', () => {
    const split = buildOptinForm({ ...defaultOptin(), ...getOptinDesign('glass-split').patch });
    expect(split.querySelector('.optin-side .retarget-caption')).not.toBeNull();
    expect(split.querySelector('.optin-main .input-wrapper-container')).not.toBeNull();
    const proof = buildOptinForm({ ...defaultOptin(), ...getOptinDesign('social-proof').patch });
    expect(proof.querySelector('.optin-side .optin-proof blockquote')).not.toBeNull();
    expect(proof.querySelector('.optin-main .retarget-caption')).not.toBeNull();
    expect(proof.querySelectorAll('.optin-stats span')).toHaveLength(3);
    expect(proof.querySelector('.optin-stats b').textContent).toBe('50,000+');
  });

  it('design options are applied: card, gradient button, input opacity and icons', () => {
    const form = buildOptinForm({
      ...defaultOptin(), ...getOptinDesign('aurora-glass').patch,
      cardRadius: 40, cardBorderWidth: 3, cardBorderColor: '#ff0000', cardBlur: 12, buttonBackground: '#111111', buttonBackground2: '#222222', inputOpacity: 50, inputBackground: '#ffffff',
    });
    const card = form.querySelector('.form-inner');
    expect(card.style.borderRadius).toBe('40px');
    expect(card.style.border).toContain('3px solid');
    expect(form.querySelector('.buttons-inner button').style.background).toContain('linear-gradient');
    const input = form.querySelector('input');
    expect(input.style.background).toContain('rgba(255, 255, 255, 0.5)');
    expect(input.classList.contains('has-icon')).toBe(true);
    expect(buildOptinForm({ ...defaultOptin(), cardRadius: 200 }).querySelector('.form-inner').style.borderRadius).toBe('50%');
  });

  it('refuses unknown design ids and markup in colours', () => {
    expect(safeDesignId('"><script>')).toBe('');
    expect(buildOptinForm({ ...defaultOptin(), designPreset: '"><b>' }).dataset.design).toBeUndefined();
    const form = buildOptinForm({ ...defaultOptin(), inputIcons: true, inputFontColor: '"/><script>', cardGlow: '"><x>' });
    expect(form.innerHTML).not.toContain('<script');
  });

  it('the gradient background replaces the radial one when a second colour is set', () => {
    const f = buildOptinForm({ ...defaultOptin(), backgroundColor: '#112233', backgroundColor2: '#445566', bgAngle: 90 });
    expect(f.style.background).toContain('linear-gradient(90deg');
  });

  it('designs with no background let the video show through', () => {
    expect(buildOptinForm({ ...defaultOptin(), ...getOptinDesign('neon-spotlight').patch }).style.background).toBe('');
  });

  it('thumbnails render for every design', () => {
    OPTIN_DESIGNS.forEach((d) => expect(designThumb(d)).toContain('optin-thumb'));
  });
});

describe('design picker in the editor', () => {
  it('lists all 30 under a Design tab and one click applies the whole preset', () => {
    const fields = listBuilderFields(defaultOptin('list-builder'));
    expect(fields.find((f) => f.key === 'designPreset').tab).toBe('Design');
    const host = document.createElement('div');
    document.body.appendChild(host);
    let latest = null;
    renderAddonEditor(host, { fields, options: defaultOptin('list-builder'), onChange: (o) => { latest = o; } });
    host.querySelector('[data-addon-tab="Design"]').click();
    expect(host.querySelectorAll('[data-design-pick]')).toHaveLength(30);
    host.querySelector('[data-design-pick="retro-terminal"]').click();
    expect(latest.designPreset).toBe('retro-terminal');
    expect(latest.fontFamily).toBe('Share Tech Mono');
    expect(latest.inputIcons).toBe(true);
    // ...and every value is still editable afterwards
    host.querySelector('[data-addon-tab="Design"]').click();
    expect(host.querySelector('[data-key="cardRadius"]')).not.toBeNull();
    host.remove();
  });
});

describe('Lead Generator clip keeps the design', () => {
  it('round-trips a design (including an empty background) through the clip shape', () => {
    const clip = { type: 'lead-form', heading: 'Join', ctaText: 'Go', fields: [{ id: 'email', type: 'email', label: 'Email' }], style: {} };
    const design = getOptinDesign('neon-spotlight').patch;
    applyOptinToLeadForm(clip, { ...leadFormToOptin(clip), ...design });
    const back = leadFormToOptin(clip);
    expect(back.designPreset).toBe('neon-spotlight');
    expect(back.designLayout).toBe('side-card');
    expect(back.backgroundColor).toBe('');
    expect(back.buttonBackground2).toBe(design.buttonBackground2);
    expect(back.heading ?? back.caption).toBeDefined();
    expect(clip.heading).toBe(clip.heading);
  });
});
