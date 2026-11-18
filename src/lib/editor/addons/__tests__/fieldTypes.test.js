// @vitest-environment jsdom
// New form field types (dropdown, checkbox, URL, validated phone) and the consent checkbox, for both forms.
import { describe, it, expect, vi } from 'vitest';
import {
  defaultListBuilder, listBuilderFields, ensureOverlayLayer, showOptinOverlay, renderAddonEditor, leadFormToOptin, applyOptinToLeadForm, FORM_FIELD_TYPES, LEAD_FIELD_TYPES,
} from '../index.js';
import { selectChoices } from '../addonOverlay.js';

const layerOf = () => ensureOverlayLayer(document.createElement('div'));
const flush = () => new Promise((r) => setTimeout(r, 0));
const cfg = (elements, extra = {}) => ({ ...defaultListBuilder(), elements, ...extra });
const submit = (el) => el.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
const status = (el) => el.querySelector('.addon-optin__status').textContent;

describe('field types offered', () => {
  it('both forms offer the same types, including the new ones', () => {
    const keys = FORM_FIELD_TYPES.map(([k]) => k);
    expect(keys).toEqual(expect.arrayContaining(['singleline', 'multiline', 'email', 'phone', 'url', 'number', 'date', 'select', 'checkbox']));
    expect(LEAD_FIELD_TYPES).toEqual(FORM_FIELD_TYPES);
  });
  it('the Fields tab uses them', () => {
    const f = listBuilderFields(defaultListBuilder()).find((x) => x.key === 'elements');
    expect(f.fieldTypes.map(([k]) => k)).toContain('select');
  });
});

describe('dropdown', () => {
  const dd = { id: 1, label: 'Size', token: 'SIZE', type: 'select', options: 'Small, Medium, Large, Small, ,', required: true };
  it('lists the cleaned choices after a disabled hint option', () => {
    expect(selectChoices('Small, Medium, Large, Small, ,')).toEqual(['Small', 'Medium', 'Large']);
    expect(selectChoices(undefined)).toEqual([]);
    expect(selectChoices(Array.from({ length: 30 }, (_, i) => `c${i}`).join(','))).toHaveLength(20);
    const el = showOptinOverlay(layerOf(), cfg([dd]), { onSubmit: vi.fn() });
    const sel = el.querySelector('select[name="SIZE"]');
    expect([...sel.options].slice(1).map((o) => o.textContent)).toEqual(['Small', 'Medium', 'Large']);
    expect(sel.options[0].textContent.trim()).toBe('Size');
    expect(sel.options[0].disabled).toBe(true);
    expect(sel.value).toBe('');
  });
  it('a required dropdown must be chosen, then its value is sent', async () => {
    const onSubmit = vi.fn().mockResolvedValue('');
    const el = showOptinOverlay(layerOf(), cfg([dd]), { onSubmit });
    submit(el); await flush();
    expect(onSubmit).not.toHaveBeenCalled(); expect(status(el)).toMatch(/complete all fields/i);
    el.querySelector('select').value = 'Medium';
    submit(el); await flush();
    expect(onSubmit.mock.calls[0][0]).toEqual({ SIZE: 'Medium' });
  });
});

describe('checkbox field', () => {
  const box = { id: 1, label: 'I own the property', token: 'OWNER', type: 'checkbox', required: false };
  it('sends Yes when ticked and nothing when not', async () => {
    const onSubmit = vi.fn().mockResolvedValue('');
    const el = showOptinOverlay(layerOf(), cfg([{ id: 0, label: 'Email', token: 'EMAIL', type: 'email', required: true }, box]), { onSubmit });
    el.querySelector('input[name="EMAIL"]').value = 'a@b.co';
    submit(el); await flush();
    expect(onSubmit.mock.calls[0][0]).toEqual({ EMAIL: 'a@b.co' });
    const el2 = showOptinOverlay(layerOf(), cfg([{ id: 0, label: 'Email', token: 'EMAIL', type: 'email', required: true }, box]), { onSubmit });
    el2.querySelector('input[name="EMAIL"]').value = 'a@b.co';
    el2.querySelector('input[name="OWNER"]').checked = true;
    submit(el2); await flush();
    expect(onSubmit.mock.calls[1][0]).toEqual({ EMAIL: 'a@b.co', OWNER: 'Yes' });
  });
  it('a required checkbox must be ticked', async () => {
    const onSubmit = vi.fn().mockResolvedValue('');
    const el = showOptinOverlay(layerOf(), cfg([{ ...box, required: true }]), { onSubmit });
    submit(el); await flush();
    expect(onSubmit).not.toHaveBeenCalled();
    el.querySelector('input[name="OWNER"]').checked = true;
    submit(el); await flush();
    expect(onSubmit.mock.calls[0][0]).toEqual({ OWNER: 'Yes' });
  });
});

describe('URL and phone', () => {
  it('url uses a url input', () => {
    const el = showOptinOverlay(layerOf(), cfg([{ id: 0, label: 'Website', token: 'WEBSITE', type: 'url' }]), { onSubmit: vi.fn() });
    expect(el.querySelector('input[name="WEBSITE"]').type).toBe('url');
  });
  it('phone has a pattern that accepts real numbers and rejects words (valid under the v flag too)', () => {
    const el = showOptinOverlay(layerOf(), cfg([{ id: 0, label: 'Phone', token: 'PHONE', type: 'phone' }]), { onSubmit: vi.fn() });
    const input = el.querySelector('input[name="PHONE"]');
    expect(input.type).toBe('tel');
    const re = new RegExp(`^(?:${input.getAttribute('pattern')})$`, 'v');
    for (const ok of ['+1 (555) 010-0100', '555.010.0100', '+44 20 7946 0958']) expect(re.test(ok)).toBe(true);
    for (const bad of ['call me', '123', 'abcdefghij']) expect(re.test(bad)).toBe(false);
  });
});

describe('consent checkbox', () => {
  const email = { id: 0, label: 'Email', token: 'EMAIL', type: 'email', required: true };
  it('is off by default and has editable wording', () => {
    const el = showOptinOverlay(layerOf(), cfg([email]), { onSubmit: vi.fn() });
    expect(el.querySelector('.optin-consent')).toBeNull();
    const shown = (o) => listBuilderFields(o).filter((f) => !f.showIf || f.showIf(o)).map((f) => f.key);
    const on = { ...defaultListBuilder(), requireConsent: true };
    expect(shown(on)).toEqual(expect.arrayContaining(['requireConsent', 'consentText']));
    expect(shown(defaultListBuilder())).toContain('requireConsent');
    expect(shown(defaultListBuilder())).not.toContain('consentText'); // the wording box appears once the checkbox is on
  });
  it('blocks the submit until ticked, then stores the wording with the lead', async () => {
    const onSubmit = vi.fn().mockResolvedValue('');
    const el = showOptinOverlay(layerOf(), cfg([email], { requireConsent: true, consentText: 'I agree to be emailed.' }), { onSubmit });
    expect(el.querySelector('.optin-consent span').textContent).toBe('I agree to be emailed.');
    el.querySelector('input[name="EMAIL"]').value = 'a@b.co';
    submit(el); await flush();
    expect(onSubmit).not.toHaveBeenCalled();
    el.querySelector('input[name="CONSENT"]').checked = true;
    submit(el); await flush();
    expect(onSubmit.mock.calls[0][0]).toEqual({ EMAIL: 'a@b.co', CONSENT: 'I agree to be emailed.' });
  });
});

describe('editor and Lead Generator clip', () => {
  it('a dropdown row gets a choices box, and the choices are kept', () => {
    const box = document.createElement('div');
    const onChange = vi.fn();
    renderAddonEditor(box, { options: defaultListBuilder(), fieldsFor: listBuilderFields, onChange });
    box.querySelector('[data-addon-tab="Fields"]').click();
    expect(box.querySelector('.addon-fieldlist__options')).toBeNull();
    const type = box.querySelector('.addon-fieldlist__type');
    type.value = 'select'; type.dispatchEvent(new Event('change', { bubbles: true }));
    const choices = box.querySelector('.addon-fieldlist__options');
    expect(choices).toBeTruthy();
    choices.value = 'Red, Blue'; choices.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange.mock.calls.at(-1)[0].elements[0]).toMatchObject({ type: 'select', options: 'Red, Blue' });
  });
  it('the Lead Generator keeps choices and the consent options through the clip', () => {
    const clip = { fields: [] };
    applyOptinToLeadForm(clip, { elements: [{ id: 'size', type: 'select', label: 'Size', options: 'S, M', required: true }], requireConsent: true, consentText: 'OK to email?' });
    expect(clip.fields[0]).toMatchObject({ type: 'select', options: 'S, M' });
    const back = leadFormToOptin(clip);
    expect(back.elements[0]).toMatchObject({ type: 'select', options: 'S, M' });
    expect(back).toMatchObject({ requireConsent: true, consentText: 'OK to email?' });
  });
});

describe('auto-reply settings', () => {
  it('are offered on the Integrations tab once switched on, and kept on the Lead Generator clip', async () => {
    const { listBuilderFields: fields, defaultListBuilder: dflt, applyOptinToLeadForm: apply, leadFormToOptin: back } = await import('../index.js');
    const shown = (o) => fields(o).filter((f) => !f.showIf || f.showIf(o)).map((f) => f.key);
    expect(shown(dflt())).toContain('autoReplyEnabled');
    expect(shown(dflt())).not.toContain('autoReplyBody');
    expect(shown({ ...dflt(), autoReplyEnabled: true })).toEqual(expect.arrayContaining(['autoReplySubject', 'autoReplyBody']));
    const clip = { fields: [] };
    apply(clip, { elements: [{ id: 'e', type: 'email', label: 'Email' }], autoReplyEnabled: true, autoReplySubject: 'Thanks', autoReplyBody: 'Hi {{first_name}}' });
    expect(clip).toMatchObject({ autoReplyEnabled: true, autoReplySubject: 'Thanks', autoReplyBody: 'Hi {{first_name}}' }); // flat on the clip, where the server reads it
    expect(back(clip)).toMatchObject({ autoReplyEnabled: true });
  });
});

describe('form ids for view counting', () => {
  it('the wall counts as "list-builder"; a Lead Generator uses its clip id; the editor preview is not counted', () => {
    const wall = showOptinOverlay(layerOf(), cfg([{ id: 0, label: 'Email', token: 'EMAIL', type: 'email' }]), { onSubmit: vi.fn() });
    expect(wall.querySelector('form').dataset.ctaId).toBe('list-builder');
    const lg = showOptinOverlay(layerOf(), cfg([{ id: 0, label: 'Email', token: 'EMAIL', type: 'email' }]), { onSubmit: vi.fn(), name: 'lead-form', ctaId: 'ov-123' });
    expect(lg.querySelector('form').dataset.ctaId).toBe('ov-123');
    const bare = showOptinOverlay(layerOf(), cfg([{ id: 0, label: 'Email', token: 'EMAIL', type: 'email' }]), { onSubmit: vi.fn(), name: 'lead-form' });
    expect(bare.querySelector('form').dataset.ctaId).toBeUndefined();
    const preview = showOptinOverlay(layerOf(), cfg([{ id: 0, label: 'Email', token: 'EMAIL', type: 'email' }]), { onSubmit: vi.fn(), preview: true });
    expect(preview.querySelector('form').dataset.ctaId).toBeUndefined();
  });
});
