// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.hoisted(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
import { LeadForm } from '../puck/components.jsx';
import { PageContext } from '../puck/context.js';
import { puckConfig } from '../puck/config.jsx';
import { normalizeOptions, afterSubmitPlan, personalizePage, formOptionsField, FORM_OPTION_DEFAULTS } from '../puck/formOptions.jsx';
import { collectTexts } from '../rewrite.js';
import { PUCK_TEMPLATES } from '../puck/designs.js';

const ctx = (extra = {}) => ({ page: { id: 'page1234' }, tokens: {}, handlers: {}, preview: false, ...extra });
const roots = [];
const mount = (c, node) => { const root = document.createElement('div'); document.body.appendChild(root); const r = createRoot(root); roots.push(r); act(() => r.render(<PageContext.Provider value={c}>{node}</PageContext.Provider>)); return { root, r }; };
const FIELDS = [{ key: 'name', label: 'Name', type: 'text', required: false }, { key: 'email', label: 'Email', type: 'email', required: false }, { key: 'phone', label: 'Phone', type: 'tel' }];
const submit = async (root) => { await act(async () => { root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); };
beforeEach(() => { roots.splice(0).forEach((r) => { try { act(() => r.unmount()); } catch { /* already unmounted */ } }); document.body.innerHTML = ''; localStorage.clear(); });

describe('List Builder / Lead Generator options on the design\'s own form', () => {
  it('an untouched form behaves exactly as before', async () => {
    const onLead = vi.fn(async () => ({}));
    const { root } = mount(ctx({ handlers: { onLead } }), <LeadForm title="T" submitLabel="Send" fields={FIELDS} />);
    expect(root.querySelectorAll('input[required]').length).toBe(0); expect(document.querySelector('[data-pk-gate]')).toBeNull(); expect(root.querySelector('.pk-pointer')).toBeNull();
    root.querySelector('input[name=name]').value = 'Dana';
    await submit(root); expect(onLead).toHaveBeenCalledWith({ NAME: 'Dana' }, { kind: 'lead-form' });
  });
  it('saves leads the way the timeline does: answers keyed by box tokens, with the form kind', async () => {
    const calls = [];
    const onLead = async (d, meta) => { calls.push([d, meta]); return {}; };
    const f = [{ key: 'first', label: 'First Name', type: 'text' }, { key: 'mail', label: 'Email', type: 'email' }, { key: 'mail2', label: 'Email', type: 'email' }];
    const fill = (root) => { root.querySelector('input[name=first]').value = 'Dana'; root.querySelector('input[name=mail]').value = 'dana@example.com'; root.querySelector('input[name=mail2]').value = 'd2@example.com'; };
    for (const [type, kind] of [['lead-generator', 'lead-form'], ['list-builder', 'list-builder'], ['personalizer', 'personalizer']]) {
      document.body.innerHTML = '';
      const { root } = mount(ctx({ handlers: { onLead } }), <LeadForm fields={f} options={{ kind: type }} />);
      fill(root); await submit(root);
      expect(calls.at(-1)[0]).toEqual({ 'FIRST NAME': 'Dana', EMAIL: 'dana@example.com', EMAIL_2: 'd2@example.com' });
      expect(calls.at(-1)[1]).toEqual({ kind });
    }
  });
  it('List Builder makes every box required; Lead Generator keeps each box\'s own setting', () => {
    const lb = mount(ctx(), <LeadForm fields={FIELDS} options={{ kind: 'list-builder' }} />);
    expect(lb.root.querySelectorAll('input[required]').length).toBe(3);
    document.body.innerHTML = '';
    const lg = mount(ctx(), <LeadForm fields={[{ ...FIELDS[0], required: true }, FIELDS[1]]} options={{ kind: 'lead-generator' }} />);
    expect(lg.root.querySelectorAll('input[required]').length).toBe(1);
  });
  it('supports phone, number, date and dropdown boxes in the design\'s own look', () => {
    const { root } = mount(ctx(), <LeadForm fields={[{ key: 'p', label: 'Phone', type: 'tel' }, { key: 'n', label: 'Age', type: 'number' }, { key: 'd', label: 'When', type: 'date' }, { key: 's', label: 'Topic', type: 'select', options: 'A\nB' }]} />);
    expect(root.querySelector('input[type=tel]')).toBeTruthy(); expect(root.querySelector('input[type=number]')).toBeTruthy(); expect(root.querySelector('input[type=date]')).toBeTruthy(); expect(root.querySelectorAll('option').length).toBe(3);
    expect(root.querySelector('form').className).toBe('pk-form');
  });
  it('shows a thank-you button after sending when that is chosen, and only for https links', async () => {
    const onLead = vi.fn(async () => ({}));
    const { root } = mount(ctx({ handlers: { onLead } }), <LeadForm fields={FIELDS} successMessage="Thanks!" options={{ afterAction: 'button', afterUrl: 'https://example.com/guide', afterButtonText: 'Get the guide' }} />);
    await submit(root);
    const a = root.querySelector('a.pk-btn'); expect(a.textContent).toBe('Get the guide'); expect(a.href).toBe('https://example.com/guide'); expect(a.rel).toContain('noopener');
    expect(afterSubmitPlan(normalizeOptions({ afterAction: 'button', afterUrl: 'javascript:alert(1)' })).action).toBe('message');
    expect(afterSubmitPlan(normalizeOptions({ afterAction: 'redirect', afterUrl: 'http://insecure.test' })).action).toBe('message');
    expect(afterSubmitPlan(normalizeOptions({ afterAction: 'redirect', afterUrl: 'https://example.com/ty' }))).toMatchObject({ action: 'redirect', url: 'https://example.com/ty' });
  });
  it('adds a privacy link, a pointer, tracking and look overrides only when asked', () => {
    const { root } = mount(ctx(), <LeadForm fields={FIELDS} privacy="We never share your details." options={{ privacyLink: 'https://example.com/privacy', privacyLinkText: 'Our policy', pointer: true, pointerText: 'Start here', buttonColor: '#0b6e4f', boxRadius: 20, gtmId: 'GTM-ABCD12' }} />);
    expect(root.querySelector('.pk-privacy a').textContent).toBe('Our policy'); expect(root.querySelector('.pk-privacy').textContent).toContain('never share');
    expect(root.querySelector('.pk-pointer').textContent).toContain('Start here');
    expect(root.querySelector('button[type=submit]').style.background).toMatch(/rgb\(11, 110, 79\)|#0b6e4f/i); expect(root.querySelector('input').style.borderRadius).toBe('20px');
    expect([...document.head.querySelectorAll('script')].some((s) => /gtm\.js\?id=GTM-ABCD12/.test(s.src))).toBe(true);
    document.body.innerHTML = ''; const prev = mount(ctx({ preview: true }), <LeadForm fields={FIELDS} options={{ pointer: true }} />); expect(prev.root.querySelector('.pk-pointer')).toBeNull();
  });
  it('the gate shows the design\'s own form full screen once, can be skipped, and never shows in the editor', async () => {
    const themed = document.createElement('div'); themed.className = 'pk-page pk-d-pd-dental'; themed.style.cssText = '--pk-accent:#1f5fe0'; document.body.appendChild(themed);
    const opts = { gate: true, skip: true, skipText: 'No thanks' };
    const p = mount(ctx({ preview: true }), <LeadForm fields={FIELDS} options={opts} />); expect(document.querySelector('[data-pk-gate]')).toBeNull(); act(() => p.r.unmount());
    const g = mount(ctx(), <LeadForm fields={FIELDS} options={opts} />);
    const gate = document.querySelector('[data-pk-gate]'); expect(gate).toBeTruthy();
    expect(gate.className).toContain('pk-d-pd-dental'); expect(gate.querySelector('form.pk-form')).toBeTruthy(); expect(gate.querySelector('.pk-gate-skip').textContent).toBe('No thanks');
    act(() => { gate.querySelector('.pk-gate-skip').click(); }); expect(document.querySelector('[data-pk-gate]')).toBeNull();
    act(() => g.r.unmount()); mount(ctx(), <LeadForm fields={FIELDS} options={opts} />); expect(document.querySelector('[data-pk-gate]')).toBeNull();
    localStorage.clear(); mount(ctx(), <LeadForm fields={FIELDS} options={{ ...opts, askEveryVisit: true }} />); expect(document.querySelector('[data-pk-gate]')).toBeTruthy();
  });
  it('only one gate opens when several forms have it on', () => {
    mount(ctx(), <><LeadForm fields={FIELDS} options={{ gate: true }} /><LeadForm fields={FIELDS} options={{ gate: true }} /></>);
    expect(document.querySelectorAll('[data-pk-gate]').length).toBe(1);
  });
  it('Personalizer sends the visitor to the same page with their answers as tokens', async () => {
    const assign = vi.fn();
    expect(personalizePage({ first_name: 'Dana', company: 'Acme', email: 'a@b.co' }, { assign, href: 'https://x.test/p/abc?c=k' })).toBe(true);
    expect(assign).toHaveBeenCalledWith('https://x.test/p/abc?c=k&firstname=Dana&company=Acme');
    expect(personalizePage({ email: 'a@b.co' }, { assign, href: 'https://x.test/p/abc' })).toBe(false);
  });
  it('makes unsafe or odd stored options safe', () => {
    const o = normalizeOptions({ kind: 'evil', afterUrl: 'javascript:alert(1)', privacyLink: 'http://x', buttonColor: 'red; x', boxRadius: 999, pointerSeconds: -4, skipText: ' '.repeat(5), gtmId: 'x'.repeat(50) });
    expect(o).toMatchObject({ kind: 'lead-generator', afterUrl: '', privacyLink: '', buttonColor: '', boxRadius: 40, pointerSeconds: 0, skipText: 'Skip' }); expect(o.gtmId.length).toBe(12);
    expect(normalizeOptions(null)).toMatchObject({ gate: false, pointer: false, boxRadius: null });
    expect(Object.keys(FORM_OPTION_DEFAULTS)).toEqual(expect.arrayContaining(['kind', 'gate', 'skip', 'afterAction', 'pointer', 'gtmId']));
  });
  it('every design form carries the options field and the full box list', () => {
    const withForm = [];
    for (const [name, c] of Object.entries(puckConfig.components)) if (c.fields?.formFields || name === 'ContactBand') withForm.push(name);
    expect(withForm).toEqual(expect.arrayContaining(['Hero', 'ContactBand', 'PersonaHero', 'SparkHero', 'MonoHero', 'NeonHero', 'RealtorHero', 'DreamhomeHero']));
    for (const n of withForm) expect(puckConfig.components[n].fields.formOptions?.type, n).toBe('object');
    const types = puckConfig.components.SparkHero.fields.formFields.arrayFields.type.options.map((o) => o.value);
    expect(types).toEqual(expect.arrayContaining(['tel', 'number', 'date', 'select', 'textarea']));
    expect(Object.keys(formOptionsField().objectFields)).toEqual(expect.arrayContaining(['kind', 'gate', 'skip', 'afterAction', 'privacyLink', 'pointer', 'fbPixelId', 'buttonColor', 'boxRadius']));
  });
  it('existing designs are unchanged: none stores form options yet, and their copy is the same', () => {
    for (const t of PUCK_TEMPLATES) expect(JSON.stringify(t.puckData)).not.toContain('"formOptions"');
    const t = PUCK_TEMPLATES.find((x) => x.id === 'puck-pd-dental');
    expect(collectTexts(t.puckData).length).toBeGreaterThan(20);
  });
});

describe('the AI rewrite and the form options', () => {
  it('rewrites the form words only, never tracking ids, links or colours', () => {
    const data = { content: [{ type: 'ContactBand', props: { id: 'c1', title: 'Get started', fields: [], formOptions: { kind: 'list-builder', gtmId: 'GTM-ABCD12', fbPixelId: '123456789', afterUrl: 'https://example.com/x', buttonColor: '#0b6e4f', pointerText: 'Start here to begin', skipText: 'No thanks', afterButtonText: 'Get the guide', privacyLinkText: 'Our privacy policy' } } }], root: { props: {} }, zones: {} };
    const texts = collectTexts(data).map((t) => t.text);
    ['Start here to begin', 'No thanks', 'Get the guide', 'Our privacy policy'].forEach((w) => expect(texts).toContain(w));
    ['GTM-ABCD12', '123456789', 'https://example.com/x', '#0b6e4f', 'list-builder'].forEach((w) => expect(texts).not.toContain(w));
  });
});
