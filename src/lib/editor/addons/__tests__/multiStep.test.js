// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { defaultListBuilder, listBuilderFields, ensureOverlayLayer, showOptinOverlay, leadFormToOptin, applyOptinToLeadForm } from '../index.js';

const layerOf = () => ensureOverlayLayer(document.createElement('div'));
const flush = () => new Promise((r) => setTimeout(r, 0));
const boxes = [
  { id: 0, label: 'Email', token: 'EMAIL', type: 'email', required: true },
  { id: 1, label: 'First name', token: 'FIRST NAME', type: 'singleline', required: true },
  { id: 2, label: 'Phone', token: 'PHONE', type: 'phone', required: false },
];
const make = (extra = {}, onSubmit = vi.fn().mockResolvedValue('')) => {
  const el = showOptinOverlay(layerOf(), { ...defaultListBuilder(), elements: boxes, multiStep: true, stepSize: 1, ...extra }, { onSubmit });
  return { el, onSubmit, form: el.querySelector('form') };
};
const go = (form) => form.dispatchEvent(new Event('submit', { cancelable: true }));
const visible = (form) => [...form.querySelectorAll('input[name], select[name]')].filter((i) => !i.closest('[hidden]') && !i.hidden).map((i) => i.name);
const btn = (form) => form.querySelector('button[type="submit"]').textContent;
const status = (form) => form.querySelector('.addon-optin__status').textContent;

describe('multi-step form', () => {
  it('is a single step by default', () => {
    const el = showOptinOverlay(layerOf(), { ...defaultListBuilder(), elements: boxes }, { onSubmit: vi.fn() });
    expect(el.querySelector('form').dataset.steps).toBeUndefined();
    expect(el.querySelector('.optin-steps')).toBeNull();
    expect(el.querySelector('.optin-back')).toBeNull();
  });
  it('shows one group at a time with progress dots and a Back link', () => {
    const { form } = make();
    expect(form.dataset.steps).toBe('3');
    expect(visible(form)).toEqual(['EMAIL']);
    expect(form.querySelectorAll('.optin-steps span')).toHaveLength(3);
    expect(btn(form)).toBe('Next');
    expect(form.querySelector('.optin-back').hidden).toBe(true);
  });
  it('Next validates the step before moving on', async () => {
    const { form, onSubmit } = make();
    go(form); await flush();
    expect(visible(form)).toEqual(['EMAIL']); expect(status(form)).toMatch(/complete this step/i);
    form.querySelector('input[name="EMAIL"]').value = 'not-an-email';
    go(form); await flush();
    expect(visible(form)).toEqual(['EMAIL']);
    form.querySelector('input[name="EMAIL"]').value = 'a@b.co';
    go(form); await flush();
    expect(visible(form)).toEqual(['FIRST NAME']); expect(onSubmit).not.toHaveBeenCalled();
    expect(form.querySelector('.optin-back').hidden).toBe(false);
  });
  it('the last step shows the real button, and everything is sent once', async () => {
    const { form, onSubmit } = make({ btnText: 'Play now' });
    form.querySelector('input[name="EMAIL"]').value = 'a@b.co'; go(form); await flush();
    form.querySelector('input[name="FIRST NAME"]').value = 'Ann'; go(form); await flush();
    expect(visible(form)).toEqual(['PHONE']); expect(btn(form)).toBe('Play now');
    go(form); await flush();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({ EMAIL: 'a@b.co', 'FIRST NAME': 'Ann', PHONE: '' }); // an empty optional box is sent empty (the server drops it)
  });
  it('Back returns to the earlier step and keeps the answers', async () => {
    const { form } = make();
    form.querySelector('input[name="EMAIL"]').value = 'a@b.co'; go(form); await flush();
    form.querySelector('.optin-back').click();
    expect(visible(form)).toEqual(['EMAIL']);
    expect(form.querySelector('input[name="EMAIL"]').value).toBe('a@b.co');
  });
  it('two boxes per step, and a custom Next label', () => {
    const { form } = make({ stepSize: 2, nextText: 'Continue' });
    expect(form.dataset.steps).toBe('2');
    expect(visible(form)).toEqual(['EMAIL', 'FIRST NAME']);
    expect(btn(form)).toBe('Continue');
  });
  it('the consent checkbox is on the last step', async () => {
    const { form, onSubmit } = make({ requireConsent: true, consentText: 'OK to email me' });
    expect(form.querySelector('.optin-consent').hidden).toBe(true);
    form.querySelector('input[name="EMAIL"]').value = 'a@b.co'; go(form); await flush();
    form.querySelector('input[name="FIRST NAME"]').value = 'Ann'; go(form); await flush();
    expect(form.querySelector('.optin-consent').hidden).toBe(false);
    go(form); await flush(); expect(onSubmit).not.toHaveBeenCalled(); // untick blocks
    form.querySelector('input[name="CONSENT"]').checked = true; go(form); await flush();
    expect(onSubmit.mock.calls[0][0].CONSENT).toBe('OK to email me');
  });
  it('the settings are offered and survive the Lead Generator clip', () => {
    const on = { ...defaultListBuilder(), multiStep: true };
    const shown = (o) => listBuilderFields(o).filter((f) => !f.showIf || f.showIf(o)).map((f) => f.key);
    expect(shown(on)).toEqual(expect.arrayContaining(['multiStep', 'stepSize', 'nextText']));
    expect(shown(defaultListBuilder())).not.toContain('stepSize');
    const clip = { fields: [] };
    applyOptinToLeadForm(clip, { elements: boxes, multiStep: true, stepSize: 2, nextText: 'Go' });
    expect(leadFormToOptin(clip)).toMatchObject({ multiStep: true, stepSize: 2, nextText: 'Go' });
  });
});
