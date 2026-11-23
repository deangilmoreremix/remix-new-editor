// @vitest-environment jsdom
// The Lead Generator clip is saved flat (heading / ctaText / style / design). These tests run the 30 designs through the
// SAME functions the editor panel (cinegen overlay-settings-panel) and the published player use.
import { describe, it, expect } from 'vitest';
import {
  OPTIN_DESIGNS, applyOptinDesign, leadFormToOptin, applyOptinToLeadForm, listBuilderFields, renderAddonEditor, defaultOptin, DESIGN_BASE,
} from '../index.js';
import { showLeadForm } from '../../publish/viewerOverlays.js';

const freshClip = () => ({
  id: 'lf1', type: 'lead-form', heading: 'Please enter your details to find out more', ctaText: 'Play',
  fields: [{ id: 'email', type: 'email', label: 'Email' }], style: {},
});

/** What the panel does when a design tile is clicked: read the clip, apply the design, write it back. */
const pick = (clip, design) => {
  const next = { ...leadFormToOptin(clip), ...applyOptinDesign(leadFormToOptin(clip), design) };
  applyOptinToLeadForm(clip, next);
  return next;
};

describe('Lead Generator preview and keyboard focus', () => {
  it('the editor preview never takes keyboard focus (it would steal it from the settings panel while typing); a live form does', async () => {
    const panelInput = document.createElement('input');
    document.body.appendChild(panelInput);
    panelInput.focus();
    const layer = document.createElement('div');
    document.body.appendChild(layer);
    showLeadForm(layer, freshClip(), { preview: true });
    await new Promise((r) => setTimeout(r, 120));
    expect(document.activeElement).toBe(panelInput);
    const live = document.createElement('div');
    document.body.appendChild(live);
    showLeadForm(live, freshClip(), { preview: false });
    await new Promise((r) => setTimeout(r, 120));
    expect(live.contains(document.activeElement)).toBe(true);
  });
});

describe('Lead Generator + the 30 designs', () => {
  it('the panel lists the Design tab with all 30 designs for a Lead Generator', () => {
    const fields = listBuilderFields({ ...leadFormToOptin(freshClip()), kind: 'lead-generator' });
    const picker = fields.find((f) => f.key === 'designPreset');
    expect(picker.tab).toBe('Design');
    expect(picker.designs).toHaveLength(30);
    const host = document.createElement('div');
    renderAddonEditor(host, { fieldsFor: (o) => listBuilderFields({ ...o, kind: 'lead-generator' }), options: leadFormToOptin(freshClip()) });
    expect([...host.querySelectorAll('[data-addon-tab]')].map((b) => b.textContent)).toEqual(['Text', 'Design', 'Styles', 'Fields', 'Pointer', 'Integrations']);
  });

  it.each(OPTIN_DESIGNS.map((d) => [d.id, d]))('%s: saved on the clip, read back, and drawn by the published player', (id, design) => {
    const clip = freshClip();
    const next = pick(clip, design);
    // saved flat on the clip: the design id and its design-only options live in clip.design, the shared ones in the clip's own keys
    expect(clip.design.designPreset).toBe(id);
    const back = leadFormToOptin(clip);
    Object.entries(design.patch).forEach(([k, v]) => {
      if (k === 'transition') return; // normalised to a popcorn-* name on read
      expect(back[k], `${id}: ${k}`).toEqual(next[k]);
    });
    expect(back.elements.map((e) => e.label)).toEqual(next.elements.map((e) => e.label));
    // published player
    const layer = document.createElement('div');
    layer.style.width = '800px';
    const wrap = showLeadForm(layer, clip, { onSubmit: async () => ({ ok: true }) });
    const form = wrap.querySelector('form');
    expect(form.dataset.design).toBe(id);
    expect(form.querySelector('.retarget-caption').textContent).toBe(back.caption);
    // a multi-step design shows its "Next" label until the last step
    expect(form.querySelector('button[type="submit"]').textContent).toBe(Number(form.dataset.steps || 0) > 1 ? back.nextText : back.btnText);
    expect(new Set([...form.elements].filter((e) => e.name && e.name !== 'CONSENT' && !e.dataset.trap).map((e) => e.name)).size).toBe(back.elements.length);
  });

  it('switching from one design to another leaves nothing of the first behind', () => {
    const clip = freshClip();
    pick(clip, OPTIN_DESIGNS.find((d) => d.id === 'retro-terminal'));
    pick(clip, OPTIN_DESIGNS.find((d) => d.id === 'aurora-glass'));
    const back = leadFormToOptin(clip);
    expect(back.designPreset).toBe('aurora-glass');
    expect(back.fontFamily).toBe('Poppins');
    expect(back.caption).toBe('Get Your Personalized Video');
    const layer = document.createElement('div');
    expect(showLeadForm(layer, clip, {}).querySelector('form').dataset.design).toBe('aurora-glass');
  });

  it('keeps a customised caption, button text and boxes when a design is picked', () => {
    const clip = { ...freshClip(), heading: 'Get my free guide', ctaText: 'Send it', fields: [{ id: 'company', type: 'text', label: 'Company' }] };
    pick(clip, OPTIN_DESIGNS.find((d) => d.id === 'glass-split'));
    expect(clip.heading).toBe('Get my free guide');
    expect(clip.ctaText).toBe('Send it');
    expect(clip.fields.map((f) => f.label)).toEqual(['Company']);
  });

  it('every design option edits and round-trips through the clip (nothing is lost on save)', () => {
    const clip = freshClip();
    const base = pick(clip, OPTIN_DESIGNS.find((d) => d.id === 'social-proof'));
    const edited = { ...base };
    const sample = { string: 'edited', number: 7, boolean: false };
    Object.entries(DESIGN_BASE).forEach(([k, v]) => {
      if (k === 'designPreset') return;
      if (k === 'designLayout') edited[k] = 'sheet';
      else if (k === 'fieldLayout') edited[k] = 'cols';
      else if (k === 'badgeIcon') edited[k] = 'star';
      else if (k === 'btnIcon') edited[k] = 'arrow';
      else if (k === 'choiceStyle') edited[k] = 'list';
      else if (k === 'fieldAlign') edited[k] = 'left';
      else if (k === 'buttonWidth') edited[k] = 'auto';
      else if (k === 'captionAlignment') edited[k] = 'right';
      else if (typeof v === 'boolean') edited[k] = !v;
      else if (typeof v === 'number') edited[k] = v === 7 ? 8 : sample.number;
      else if (/color|background|border|glow|accent|inner|font|placeholder/i.test(k) && /^#/.test(v || '#')) edited[k] = '#12ab34';
      else edited[k] = `${sample.string}-${k}`;
    });
    applyOptinToLeadForm(clip, edited);
    const back = leadFormToOptin(clip);
    Object.keys(DESIGN_BASE).forEach((k) => expect(back[k], k).toEqual(edited[k]));
  });
});
