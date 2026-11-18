// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.hoisted(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
import { puckConfig } from '../puck/config.jsx';
import { PageContext } from '../puck/context.js';
import { ListBuilderForm, OptinGate, PixelLoader, publicOptinConfig, pageOptinFields, leadPayload, personalizerTokens, pixelIds, answerKey, optinConfigField } from '../puck/optinForm.jsx';
import { defaultListBuilder } from '../optin/listBuilder.js';
import { collectTexts } from '../rewrite.js';
import { sanitizePuck } from '../templates.js';

const mount = (el, ctx, node) => { const root = document.createElement('div'); document.body.appendChild(root); const r = createRoot(root); act(() => r.render(<PageContext.Provider value={ctx}>{node}</PageContext.Provider>)); return { root, r }; };
const ctx = (extra = {}) => ({ page: { id: 'page1234' }, tokens: {}, handlers: {}, preview: false, ...extra });
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

describe('List Builder / Lead Generator on a page', () => {
  it('never publishes delivery targets with the page', () => {
    const raw = { ...defaultListBuilder('list-builder'), webhookEnabled: true, webhook: 'https://hooks.example.com/x', webhook2: 'https://b.example.com', emailEnabled: true, emailAddress: 'me@example.com', espProvider: 'kit', espListId: 'tag1', _localLeads: [1], caption: 'Join us', fbPixelId: '123456789' };
    const pub = publicOptinConfig(raw);
    ['webhookEnabled', 'webhook', 'webhook2', 'emailEnabled', 'emailAddress', 'espProvider', 'espListId', '_localLeads'].forEach((k) => expect(pub).not.toHaveProperty(k));
    expect(pub.caption).toBe('Join us'); expect(pub.fbPixelId).toBe('123456789');
    expect(JSON.stringify(puckConfig.components.ListBuilderForm.defaultProps)).not.toMatch(/webhook|email(Address|Enabled)|espProvider/);
  });
  it('the page editor offers the timeline schema minus the private delivery fields, with tracking ids', () => {
    const keys = pageOptinFields(defaultListBuilder('list-builder')).map((f) => f.key);
    ['caption', 'btnText', 'elements', 'fontFamily', 'buttonBackground', 'pointerEnabled', 'afterSubmitAction', 'privacyDisclaimer', 'enableSkipButton', 'enabled', 'fbPixelId', 'gtmId'].forEach((k) => expect(keys).toContain(k));
    ['webhook', 'webhookEnabled', 'emailEnabled', 'emailAddress', 'espProvider', 'espListId'].forEach((k) => expect(keys).not.toContain(k));
    expect(pageOptinFields(defaultListBuilder('lead-generator')).find((f) => f.key === 'elements').fieldTypes.map(([t]) => t)).toContain('phone');
  });
  it('the standalone sections stay registered for saved pages but are no longer offered as new designs', () => {
    expect(puckConfig.components.ListBuilderForm).toBeTruthy(); expect(puckConfig.components.LeadGeneratorForm).toBeTruthy();
    expect(puckConfig.categories.sections.components).not.toEqual(expect.arrayContaining(['ListBuilderForm']));
    expect(puckConfig.categories.sections.components).not.toEqual(expect.arrayContaining(['LeadGeneratorForm']));
    expect(puckConfig.components.LeadGeneratorForm.defaultProps.config.kind).toBe('lead-generator');
  });
  it('renders the timeline form inline and sends the answers through the page lead pipeline', async () => {
    const onLead = vi.fn(async () => ({}));
    const cfg = { ...publicOptinConfig(defaultListBuilder('list-builder')), caption: 'Get the guide', btnText: 'Send it', elements: [{ id: 0, label: 'Email', token: 'EMAIL', type: 'email', required: true }, { id: 1, label: 'First Name', token: 'FIRST NAME', type: 'singleline', required: false }] };
    const { root } = mount(null, ctx({ handlers: { onLead } }), <ListBuilderForm config={cfg} />);
    const form = root.querySelector('form'); expect(form).toBeTruthy();
    expect(root.textContent).toContain('Get the guide'); expect(root.textContent).toContain('Send it');
    const email = form.querySelector('input[type="email"]'); email.value = 'dana@example.com';
    const first = [...form.querySelectorAll('input')].find((i) => i !== email); first.value = 'Dana';
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(onLead).toHaveBeenCalledWith({ email: 'dana@example.com', first_name: 'Dana' });
  });
  it('requires required boxes and sends nothing in the editor preview', async () => {
    const onLead = vi.fn(async () => ({}));
    const cfg = publicOptinConfig(defaultListBuilder('list-builder'));
    const { root } = mount(null, ctx({ handlers: { onLead } }), <ListBuilderForm config={cfg} />);
    await act(async () => { root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(onLead).not.toHaveBeenCalled(); expect(root.textContent).toContain('Please complete all fields.');
    document.body.innerHTML = '';
    const p = mount(null, ctx({ preview: true, handlers: { onLead } }), <ListBuilderForm config={{ ...cfg, elements: [{ id: 0, label: 'Email', token: 'EMAIL', type: 'email', required: false }] }} />);
    await act(async () => { p.root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(onLead).not.toHaveBeenCalled();
  });
  it('the gate appears only on the public page, only when switched on, and not again after it is answered', async () => {
    const cfg = { ...publicOptinConfig(defaultListBuilder('list-builder')), enabled: true, enableSkipButton: true, skipText: 'Skip' };
    const m1 = mount(null, ctx({ preview: true }), <OptinGate config={cfg} />); expect(document.querySelector('[data-pk-gate]')).toBeNull(); act(() => m1.r.unmount());
    const off = mount(null, ctx(), <OptinGate config={{ ...cfg, enabled: false }} />); expect(document.querySelector('[data-pk-gate]')).toBeNull(); act(() => off.r.unmount());
    const on = mount(null, ctx(), <OptinGate config={cfg} />);
    expect(document.querySelector('[data-pk-gate]')).toBeTruthy(); expect(document.querySelector('[data-pk-gate] form')).toBeTruthy();
    document.querySelector('[data-pk-gate] .skip-button').click();
    expect(document.querySelector('[data-pk-gate]')).toBeNull();
    act(() => on.r.unmount());
    mount(null, ctx(), <OptinGate config={cfg} />); expect(document.querySelector('[data-pk-gate]')).toBeNull(); // remembered
    localStorage.clear(); document.body.innerHTML = '';
    mount(null, ctx(), <OptinGate config={{ ...cfg, askEveryVisit: true }} />); document.querySelector('[data-pk-gate] .skip-button').click();
    document.body.innerHTML = ''; mount(null, ctx(), <OptinGate config={{ ...cfg, askEveryVisit: true }} />); expect(document.querySelector('[data-pk-gate]')).toBeTruthy(); // asked every visit
  });
  it('maps answers to safe lead keys and personal tokens', () => {
    expect(answerKey('FIRST NAME')).toBe('first_name'); expect(answerKey('E-mail!')).toBe('e_mail');
    expect(leadPayload({ EMAIL: ' a@b.co ', 'FIRST NAME': 'Dana', EMPTY: '  ' })).toEqual({ email: 'a@b.co', first_name: 'Dana' });
    expect(personalizerTokens({ 'FIRST NAME': 'Dana', COMPANY: 'Acme', EMAIL: 'a@b.co' })).toEqual({ firstname: 'Dana', company: 'Acme' });
  });
  it('accepts only real tracking ids and loads nothing in the editor', () => {
    expect(pixelIds({ fbPixelId: '123456789', gaMeasurementId: 'G-ABCD1234', tiktokPixelId: 'C4ABC123DEF', gtmId: 'GTM-ABCD12' })).toEqual({ fb: '123456789', ga: 'G-ABCD1234', tiktok: 'C4ABC123DEF', gtm: 'GTM-ABCD12' });
    expect(pixelIds({ fbPixelId: '<script>', gaMeasurementId: 'x', tiktokPixelId: '"; alert(1)', gtmId: 'GTM-' })).toEqual({ fb: '', ga: '', tiktok: '', gtm: '' });
    const before = document.head.querySelectorAll('script').length;
    mount(null, ctx({ preview: true }), <PixelLoader config={{ fbPixelId: '123456789' }} />);
    expect(document.head.querySelectorAll('script').length).toBe(before);
    mount(null, ctx(), <PixelLoader config={{ gtmId: 'GTM-ABCD12' }} />);
    expect([...document.head.querySelectorAll('script')].some((s) => /googletagmanager\.com\/gtm\.js\?id=GTM-ABCD12/.test(s.src))).toBe(true);
  });
  it('the AI rewrite sees the form words only, and the settings survive saving', () => {
    const cfg = { ...publicOptinConfig(defaultListBuilder('list-builder')), caption: 'Join our list today', btnText: 'Count me in', fontFamily: 'Raleway', backgroundColor: '#112233' };
    const data = { content: [{ type: 'ListBuilderForm', props: { id: 'f1', config: cfg } }], root: { props: {} }, zones: {} };
    const texts = collectTexts(data).map((t) => t.text);
    expect(texts).toEqual(expect.arrayContaining(['Join our list today', 'Count me in']));
    ['Raleway', '#112233', 'EMAIL', 'list-builder'].forEach((t) => expect(texts).not.toContain(t));
    expect(sanitizePuck(data).content[0].props.config.caption).toBe('Join our list today');
  });
  it('the settings editor mounts the timeline panel and reports edits without delivery keys', () => {
    const f = optinConfigField('List Builder settings'); const seen = [];
    const root = document.createElement('div'); document.body.appendChild(root); const r = createRoot(root);
    const Field = f.render; // Puck renders a custom field as a component
    act(() => r.render(<div><Field value={publicOptinConfig(defaultListBuilder('list-builder'))} onChange={(v) => seen.push(v)} name="config" /></div>));
    expect(root.querySelector('.addon-tabs')).toBeTruthy();
    const caption = root.querySelector('textarea, input[type="text"]');
    expect(caption).toBeTruthy();
    expect(root.textContent).not.toMatch(/Webhook Address/);
    const tabs = [...root.querySelectorAll('.addon-tab')].map((b) => b.textContent);
    expect(tabs).toEqual(expect.arrayContaining(['Text', 'Styles', 'Fields', 'Pointer', 'Tracking'])); expect(tabs).not.toContain('Integrations');
    act(() => { caption.value = 'Hello there'; caption.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(seen.length).toBeGreaterThan(0); expect(JSON.stringify(seen.at(-1))).not.toMatch(/webhook|emailAddress|espProvider/);
  });
});
