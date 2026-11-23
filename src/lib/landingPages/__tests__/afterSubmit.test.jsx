// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.hoisted(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
import { resolveAfterSubmit, scheduleRedirect, REDIRECT_DELAY_MS, AFTER_SUBMIT_OPTIONS } from '../afterSubmit.js';
import { sanitizeConfig, defaultConfig } from '../templates.js';
import { renderLandingPage } from '../render.js';
import { PageContext, AfterSubmitContext } from '../editor/context.js';
import { LeadForm } from '../editor/components.jsx';

describe('resolveAfterSubmit', () => {
  it('defaults to the thank-you message', () => {
    expect(resolveAfterSubmit(undefined)).toMatchObject({ action: 'message' });
    expect(resolveAfterSubmit({})).toMatchObject({ action: 'message' });
    expect(resolveAfterSubmit({ afterSubmitAction: 'nope', afterSubmitUrl: 'https://a.test' })).toMatchObject({ action: 'message' });
  });
  it('needs a safe link for a button or a redirect', () => {
    expect(resolveAfterSubmit({ afterSubmitAction: 'button', afterSubmitUrl: '' }).action).toBe('message');
    expect(resolveAfterSubmit({ afterSubmitAction: 'redirect', afterSubmitUrl: 'javascript:alert(1)' }).action).toBe('message');
    expect(resolveAfterSubmit({ afterSubmitAction: 'button', afterSubmitUrl: 'data:text/html,x' }).action).toBe('message');
  });
  it('a button may link to https, mailto or tel; a redirect only to a web page', () => {
    expect(resolveAfterSubmit({ afterSubmitAction: 'button', afterSubmitUrl: 'https://a.test/book', afterSubmitButtonText: ' Book ' })).toEqual({ action: 'button', url: 'https://a.test/book', buttonText: 'Book' });
    expect(resolveAfterSubmit({ afterSubmitAction: 'button', afterSubmitUrl: 'tel:+15550100' }).action).toBe('button');
    expect(resolveAfterSubmit({ afterSubmitAction: 'redirect', afterSubmitUrl: 'mailto:a@b.co' }).action).toBe('message');
    expect(resolveAfterSubmit({ afterSubmitAction: 'redirect', afterSubmitUrl: 'https://a.test/thanks' })).toMatchObject({ action: 'redirect', url: 'https://a.test/thanks' });
  });
  it('gives the button a default label and clips a long one', () => {
    expect(resolveAfterSubmit({ afterSubmitAction: 'button', afterSubmitUrl: 'https://a.test' }).buttonText).toBe('Continue');
    expect(resolveAfterSubmit({ afterSubmitAction: 'button', afterSubmitUrl: 'https://a.test', afterSubmitButtonText: 'x'.repeat(100) }).buttonText).toHaveLength(40);
  });
  it('lists the three options', () => { expect(AFTER_SUBMIT_OPTIONS.map(([v]) => v)).toEqual(['message', 'button', 'redirect']); });
  it('scheduleRedirect waits, then navigates once, and can be cancelled', () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    scheduleRedirect('https://a.test', { navigate });
    vi.advanceTimersByTime(REDIRECT_DELAY_MS - 1); expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2); expect(navigate).toHaveBeenCalledWith('https://a.test');
    const cancel = scheduleRedirect('https://b.test', { navigate }); cancel(); vi.advanceTimersByTime(REDIRECT_DELAY_MS * 2);
    expect(navigate).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('page config', () => {
  it('keeps a valid setting and drops unsafe ones', () => {
    const c = sanitizeConfig({ form: { enabled: true, fields: [{ key: 'email', label: 'Email', type: 'email' }], afterSubmitAction: 'redirect', afterSubmitUrl: 'https://a.test/thanks', afterSubmitButtonText: 'Go' } });
    expect(c.form).toMatchObject({ afterSubmitAction: 'redirect', afterSubmitUrl: 'https://a.test/thanks', afterSubmitButtonText: 'Go' });
    const bad = sanitizeConfig({ form: { afterSubmitAction: 'explode', afterSubmitUrl: 'javascript:alert(1)' } });
    expect(bad.form).toMatchObject({ afterSubmitAction: 'message', afterSubmitUrl: '' });
    expect(defaultConfig('clean', { title: 'x' }).form.afterSubmitAction ?? 'message').toBe('message');
  });
});

describe('classic page renderer', () => {
  const page = (form) => ({ title: 'T', video_url: 'https://x.supabase.co/storage/v1/object/public/uploads/u/c.mp4', config: { form: { enabled: true, fields: [{ key: 'email', label: 'Email', type: 'email', required: true }], successMessage: 'Thanks!', ...form } } });
  const submit = async (form) => {
    const { root: container } = renderLandingPage({ page: page(form), tokens: {}, handlers: { onLead: async () => ({ stored: true }) }, preview: false });
    document.body.appendChild(container);
    container.querySelector('input[name="email"]').value = 'a@b.co';
    container.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(container.querySelector('.vp-thanks')).toBeTruthy());
    return container;
  };
  it('shows only the message by default', async () => {
    const c = await submit({});
    expect(c.querySelector('.vp-thanks').textContent).toBe('Thanks!');
    expect(c.querySelector('a.vp-cta')).toBeNull();
  });
  it('adds a button with the link after the message', async () => {
    const c = await submit({ afterSubmitAction: 'button', afterSubmitUrl: 'https://a.test/book', afterSubmitButtonText: 'Book a call' });
    const a = c.querySelector('form a.vp-cta');
    expect(a.textContent).toBe('Book a call'); expect(a.getAttribute('href')).toBe('https://a.test/book'); expect(a.getAttribute('rel')).toContain('noopener');
  });
});

describe('Editor form', () => {
  let root; let host;
  afterEach(() => { act(() => root?.unmount()); host?.remove(); vi.useRealTimers(); });
  const mount = async ({ after, preview = false }) => {
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    const handlers = { onLead: vi.fn(async () => ({ stored: true })) };
    await act(async () => {
      root.render(<PageContext.Provider value={{ page: { video_url: '' }, tokens: {}, handlers, preview }}><AfterSubmitContext.Provider value={after}><LeadForm successMessage="Thanks, friend" /></AfterSubmitContext.Provider></PageContext.Provider>);
    });
    return handlers;
  };
  const send = async () => {
    host.querySelector('input[name="name"]').value = 'Ann';
    host.querySelector('input[name="email"]').value = 'ann@x.co';
    await act(async () => { host.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); });
  };
  it('message only by default', async () => {
    await mount({ after: {} }); await send();
    expect(host.querySelector('.pk-thanks').textContent).toBe('Thanks, friend');
    expect(host.querySelector('.pk-after')).toBeNull();
  });
  it('button: shows the link under the message', async () => {
    await mount({ after: { afterSubmitAction: 'button', afterSubmitUrl: 'https://a.test/book', afterSubmitButtonText: 'Book now' } }); await send();
    const a = host.querySelector('a.pk-after');
    expect(a.textContent).toBe('Book now'); expect(a.getAttribute('href')).toBe('https://a.test/book'); expect(a.getAttribute('target')).toBe('_blank');
  });
  it('redirect: waits, then navigates once; never in the editor preview', async () => {
    const assign = vi.fn();
    const original = globalThis.location;
    Object.defineProperty(globalThis, 'location', { value: { ...original, assign }, configurable: true, writable: true });
    vi.useFakeTimers();
    await mount({ after: { afterSubmitAction: 'redirect', afterSubmitUrl: 'https://a.test/thanks' } }); await send();
    expect(assign).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(REDIRECT_DELAY_MS + 50); });
    expect(assign).toHaveBeenCalledTimes(1); expect(assign).toHaveBeenCalledWith('https://a.test/thanks');
    Object.defineProperty(globalThis, 'location', { value: original, configurable: true, writable: true });
  });
  it('an unsafe link is ignored (the message stays)', async () => {
    await mount({ after: { afterSubmitAction: 'button', afterSubmitUrl: 'javascript:alert(1)' } }); await send();
    expect(host.querySelector('.pk-after')).toBeNull();
    expect(host.querySelector('.pk-thanks')).toBeTruthy();
  });
});
