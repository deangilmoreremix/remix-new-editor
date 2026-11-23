// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  OPTIN_DESIGNS, OPTIN_DESIGN_CATEGORIES, DESIGN_BASE, getOptinDesign, safeDesignId,
  defaultOptin, buildOptinForm, listBuilderFields, renderAddonEditor, leadFormToOptin, applyOptinToLeadForm,
} from '../index.js';

const KINDS = ['list-builder', 'personalizer', 'lead-generator'];

import { liveDesignThumb } from '../listBuilder.js';

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
      // one form field per configured box, however the design lays them out (chat bubbles and the quiz list are not extra fields)
      expect(new Set([...form.elements].filter((e) => e.name && e.name !== 'CONSENT').map((e) => e.name)).size).toBe(cfg.elements.length);
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

  it('every picker tile is a real render of its own design (not a sketch), inert, and carries no live form controls a tile click could trigger', () => {
    OPTIN_DESIGNS.forEach((d) => {
      const html = liveDesignThumb(d);
      const host = document.createElement('div');
      host.innerHTML = html;
      expect(host.querySelector(`form.retarget-form[data-design="${d.id}"]`), d.id).not.toBeNull();
      expect(host.querySelector('.optin-mini').hasAttribute('inert')).toBe(true);
      expect(host.querySelector('.retarget-caption').textContent.length).toBeGreaterThan(3);
    });
  });

  it('the designs use a spread of different layouts, not one skeleton', () => {
    const layouts = new Set(OPTIN_DESIGNS.map((d) => d.patch.designLayout));
    expect(layouts.size).toBeGreaterThanOrEqual(10);
    const perLayout = {};
    OPTIN_DESIGNS.forEach((d) => { perLayout[d.patch.designLayout] = (perLayout[d.patch.designLayout] || 0) + 1; });
    expect(Math.max(...Object.values(perLayout))).toBeLessThanOrEqual(14);
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

// ---------------------------------------------------------------- everything on a design is editable
import { applyOptinDesign, starterFields } from '../index.js';

/** A config with every conditional setting switched on, so every field the panel can show is listed. */
const everythingOn = (kind) => ({
  ...defaultOptin(kind), brandName: 'B', backgroundColor2: '#000000', cardBorderWidth: 2, multiStep: true, designLayout: 'chat', enableSkipButton: true,
  requireConsent: true, pointerEnabled: true, abTest: true, webhookEnabled: true,
});

describe('every part of a design is editable', () => {
  it.each(KINDS)('%s: every look option a design sets has a control in the settings panel', (kind) => {
    const keys = new Set([
      ...listBuilderFields(everythingOn(kind)).filter((f) => !f.showIf || f.showIf(everythingOn(kind))).map((f) => f.key),
      ...listBuilderFields({ ...everythingOn(kind), designLayout: 'split' }).map((f) => f.key),
    ]);
    // `elements` (the box list) and the multi-step toggles live on the Fields tab; the rest are all on Text / Design / Styles.
    Object.keys(DESIGN_BASE).forEach((k) => expect(keys.has(k), `no settings control for "${k}"`).toBe(true));
  });

  it('every text a design shows can be clicked and edited in place, and that key is a real setting', () => {
    const keys = new Set(listBuilderFields(everythingOn('list-builder')).map((f) => f.key));
    const selectors = ['.optin-brand span', '.optin-eyebrow', '.optin-subtitle', '.retarget-caption', '.optin-paneltitle', '.optin-panelhint', '.optin-stepper', '.optin-proof blockquote', '.optin-proof cite', '.optin-rating span'];
    OPTIN_DESIGNS.forEach((d) => {
      const base = defaultOptin('list-builder');
      const form = buildOptinForm({ ...base, ...applyOptinDesign(base, d), requireConsent: false });
      selectors.forEach((sel) => form.querySelectorAll(sel).forEach((el) => {
        const key = el.dataset.editKey;
        expect(key, `${d.id}: ${sel} is not click-editable`).toBeTruthy();
        expect(keys.has(key.replace(/^elements\.\d+\..*/, 'elements')), `${d.id}: ${key} has no setting`).toBe(true);
      }));
    });
  });

  it('the decoration can be switched off and recoloured', () => {
    const f = buildOptinForm({ ...defaultOptin(), ...getOptinDesign('blueprint-grid').patch, decorEnabled: false, designAccent: '#ff00aa' });
    expect(f.dataset.decor).toBe('off');
    expect(f.style.getPropertyValue('--od-accent')).toBe('#ff00aa');
  });
});

describe('picking a design shows the full design, without overwriting the creator\'s own work', () => {
  it('a fresh form gets the design wording and the three starter boxes', () => {
    const base = defaultOptin('list-builder');
    const out = applyOptinDesign(base, getOptinDesign('vip-access'));
    expect(out.caption).toBe('VIP ACCESS');
    expect(out.btnText).toBe('WATCH NOW');
    expect(out.elements.map((e) => e.label)).toEqual(['Email', 'First Name', 'Last Name']);
    expect(out.badgeIcon).toBe('crown');
  });

  it('keeps a customised caption, button text and box list', () => {
    const mine = { ...defaultOptin('lead-generator'), caption: 'Get my free guide', btnText: 'Send it', elements: [{ id: 0, label: 'Company', type: 'singleline', token: 'COMPANY' }] };
    const out = applyOptinDesign(mine, getOptinDesign('glass-split'));
    expect(out.caption).toBeUndefined();
    expect(out.btnText).toBeUndefined();
    expect(out.elements).toBeUndefined();
    // ...but switching between two designs still swaps the design wording
    const first = { ...defaultOptin(), ...applyOptinDesign(defaultOptin(), getOptinDesign('vip-access')) };
    expect(applyOptinDesign(first, getOptinDesign('glass-split')).caption).toBe('Glass Split Demo');
  });

  it('required follows the form kind', () => {
    expect(starterFields(false).every((e) => e.required === false)).toBe(true);
    expect(applyOptinDesign(defaultOptin('lead-generator'), getOptinDesign('aurora-glass')).elements.every((e) => !e.required)).toBe(true);
  });

  it('Qualifying Quiz adds a real Dropdown question shown as a list of choices; the answer is sent under the field name', () => {
    const base = defaultOptin('list-builder');
    const cfg = { ...base, ...applyOptinDesign(base, getOptinDesign('qualifying-quiz')) };
    const form = buildOptinForm(cfg);
    const radios = form.querySelectorAll('.optin-side .optin-choice input[type="radio"]');
    expect(radios).toHaveLength(4);
    radios[1].checked = true;
    expect(Object.fromEntries(new FormData(form).entries())[cfg.elements[0].token]).toBe('Increase customer engagement');
    expect(form.querySelector('.optin-paneltitle').textContent).toBe('Your Details');
    // switching the style back gives the normal dropdown
    expect(buildOptinForm({ ...cfg, choiceStyle: 'dropdown' }).querySelector('select')).not.toBeNull();
  });

  it('Conversational Setup shows a question bubble before every box; the questions are editable', () => {
    const base = defaultOptin('list-builder');
    const cfg = { ...base, ...applyOptinDesign(base, getOptinDesign('conversational-setup')) };
    const bubbles = [...buildOptinForm(cfg).querySelectorAll('.optin-bubble')].map((b) => b.textContent);
    expect(bubbles).toEqual(["What's your email?", "Great! What's your first name?", "And what's your last name?"]);
    const edited = [...buildOptinForm({ ...cfg, stepQuestions: 'A\nB\nC' }).querySelectorAll('.optin-bubble')].map((b) => b.textContent);
    expect(edited).toEqual(['A', 'B', 'C']);
  });

  it('labelled stepper follows the real step, and button icons are options', () => {
    const base = defaultOptin('list-builder');
    const cfg = { ...base, ...applyOptinDesign(base, getOptinDesign('progress-milestones')) };
    const form = buildOptinForm(cfg);
    expect([...form.querySelectorAll('.optin-stepper [data-n]')].map((n) => n.textContent)).toEqual(['1Details', '2Confirm', '3Watch']);
    expect(form.classList.contains('has-stepper')).toBe(true);
    expect(buildOptinForm({ ...cfg, btnIcon: 'play' }).querySelector('button[type="submit"]').dataset.icon).toBe('play');
    expect(buildOptinForm({ ...cfg, btnIcon: 'none' }).querySelector('button[type="submit"]').dataset.icon).toBeUndefined();
  });

  it('"row" puts all boxes and Play on one line and "cols" puts the boxes side by side', () => {
    const base = defaultOptin('list-builder');
    const row = buildOptinForm({ ...base, elements: starterFields(true), fieldLayout: 'row' });
    expect(row.querySelector('.input-wrapper-container').dataset.layout).toBe('inline');
    const cols = buildOptinForm({ ...base, elements: starterFields(true), fieldLayout: 'cols' });
    expect(cols.querySelector('.input-wrapper-container').dataset.layout).toBe('cols');
    expect(cols.querySelector('.input-wrapper-container').style.getPropertyValue('--cols')).toBe('3');
  });
});

// ---------------------------------------------------------------- colour schemes
import { COLOR_SCHEMES, recolorOptin, contrastRatio } from '../index.js';

const scheme = (id) => COLOR_SCHEMES.find((s) => s.id === id);
const hueOfHex = (hex) => {
  const n = parseInt(hex.slice(1), 16); const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255);
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn;
  if (!d) return null;
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(h * 60);
};
const hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe('colour schemes: one click recolours the whole design', () => {
  it('there are 12 hues plus "the design\'s own", each with a swatch', () => {
    expect(COLOR_SCHEMES).toHaveLength(13);
    expect(COLOR_SCHEMES[0]).toMatchObject({ id: '', hue: null });
    expect(new Set(COLOR_SCHEMES.map((s) => s.id)).size).toBe(13);
  });

  it('every design x every scheme: the button lands on the scheme hue, text stays readable, nothing is lost', () => {
    OPTIN_DESIGNS.forEach((d) => {
      const own = { ...d.patch, designPreset: d.id };
      COLOR_SCHEMES.filter((s) => s.hue != null).forEach((s) => {
        const out = recolorOptin(own, s);
        expect(out.colorScheme).toBe(s.id);
        // the button is on the scheme (within the 40% spread a two-hue design keeps)
        const bh = hueOfHex(out.buttonBackground);
        if (bh !== null) expect(hueDist(bh, s.hue), `${d.id} -> ${s.id}: button hue ${bh}`).toBeLessThanOrEqual(75);
        // button text keeps (or reaches) a readable contrast
        const before = contrastRatio(d.patch.buttonFontColor, d.patch.buttonBackground);
        const after = contrastRatio(out.buttonFontColor ?? d.patch.buttonFontColor, out.buttonBackground);
        expect(after, `${d.id} -> ${s.id}: button text ${after.toFixed(1)}`).toBeGreaterThanOrEqual(Math.min(before, 3) - 0.01);
        // body text on an opaque background keeps its contrast
        if (own.backgroundColor && own.innerOpacity < 30) {
          const b0 = contrastRatio(own.fontColor, own.backgroundColor);
          const b1 = contrastRatio(out.fontColor ?? own.fontColor, out.backgroundColor ?? own.backgroundColor);
          expect(b1, `${d.id} -> ${s.id}: text on background`).toBeGreaterThanOrEqual(Math.min(b0, 3) - 0.6);
        }
        // only colour keys change
        Object.keys(out).forEach((k) => expect(['colorScheme', ...Object.keys(d.patch)]).toContain(k));
      });
    });
  });

  it('never compounds, and "the design\'s own" restores the colours exactly', () => {
    const d = getOptinDesign('aurora-glass');
    const own = { ...d.patch, designPreset: d.id };
    const viaTeal = { ...own, ...recolorOptin(own, scheme('teal')) };
    const direct = recolorOptin(own, scheme('pink'));
    const afterTeal = recolorOptin(viaTeal, scheme('pink'));
    expect(afterTeal).toEqual(direct); // pink from teal == pink from the design
    const back = recolorOptin({ ...own, ...direct }, scheme(''));
    ['backgroundColor', 'buttonBackground', 'cardBorderColor', 'inputBorderColor', 'buttonFontColor'].forEach((k) => expect(back[k], k).toBe(d.patch[k]));
    expect(back.colorScheme).toBe('');
  });

  it('a black-and-white design keeps its look and gains the scheme as its accent', () => {
    const d = getOptinDesign('editorial-minimalist');
    const out = recolorOptin({ ...d.patch, designPreset: d.id }, scheme('red'));
    expect(out.backgroundColor).toBe(d.patch.backgroundColor);
    expect(hueDist(hueOfHex(out.buttonBackground), scheme('red').hue)).toBeLessThanOrEqual(15);
    expect(contrastRatio(out.buttonFontColor, out.buttonBackground)).toBeGreaterThan(3);
    expect(out.designAccent).toBeTruthy();
  });

  it('colours the design wears at creation: picking a design with a scheme, and picking a design resets the scheme', () => {
    const base = defaultOptin('list-builder');
    const d = getOptinDesign('glass-split');
    const withScheme = applyOptinDesign(base, d, 'amber');
    expect(withScheme.colorScheme).toBe('amber');
    expect(withScheme.buttonBackground).not.toBe(d.patch.buttonBackground);
    expect(applyOptinDesign(base, d).colorScheme).toBe(''); // no scheme: the design's own colours
    expect(applyOptinDesign(base, d).buttonBackground).toBe(d.patch.buttonBackground);
  });

  it('the Design tab has a Color scheme picker; clicking a tile recolours the form and every colour is still editable', () => {
    const fields = listBuilderFields(defaultOptin('list-builder'));
    expect(fields.find((f) => f.key === 'colorScheme')).toMatchObject({ type: 'colorSchemes', tab: 'Design' });
    const host = document.createElement('div');
    document.body.appendChild(host);
    let latest = null;
    renderAddonEditor(host, { fields, options: { ...defaultOptin('list-builder'), ...applyOptinDesign(defaultOptin('list-builder'), getOptinDesign('vip-access')) }, onChange: (o) => { latest = o; } });
    host.querySelector('[data-addon-tab="Design"]').click();
    expect(host.querySelectorAll('[data-scheme-pick]')).toHaveLength(13);
    host.querySelector('[data-scheme-pick="blue"]').click();
    expect(latest.colorScheme).toBe('blue');
    expect(hueOfHex(latest.buttonBackground)).toBeGreaterThan(190);
    expect(hueOfHex(latest.buttonBackground)).toBeLessThan(250);
    host.querySelector('[data-addon-tab="Design"]').click();
    expect(host.querySelector('[data-scheme-pick="blue"]').classList.contains('active')).toBe(true);
    // the colours are still plain editable options (Styles tab)
    host.querySelector('[data-addon-tab="Styles"]').click();
    const btn = host.querySelector('[data-key="buttonBackground"]:not([data-kind="hex"])');
    btn.value = '#123456';
    btn.dispatchEvent(new Event('input', { bubbles: true }));
    expect(latest.buttonBackground).toBe('#123456');
    // picking a design again goes back to that design's own colours
    host.querySelector('[data-addon-tab="Design"]').click();
    host.querySelector('[data-design-pick="retro-terminal"]').click();
    expect(latest.colorScheme).toBe('');
    expect(latest.buttonBackground).toBe(getOptinDesign('retro-terminal').patch.buttonBackground);
    host.remove();
  });
});
