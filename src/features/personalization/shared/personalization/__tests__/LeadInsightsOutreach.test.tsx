// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { LeadInsightsPanel } from '../LeadInsightsPanel';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { document.body.innerHTML = ''; });

const biz = { id: '1', name: "Joe's Pizza", city: 'Tampa', category: 'restaurant', email: 'hi@joes.com' } as never;
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

function mount(props: Record<string, unknown> = {}) {
  const el = document.createElement('div'); document.body.appendChild(el);
  act(() => { createRoot(el).render(<LeadInsightsPanel business={biz} results={[]} {...props} />); });
  return el;
}

describe('LeadInsightsPanel outreach draft', () => {
  it('is off by default', () => {
    expect(mount().querySelector('[data-testid="outreach"]')).toBeNull();
  });
  it('opens an editable draft with its facts and copies subject + edited text', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const el = mount({ showOutreach: true, enrichment: { siteSignals: { quality: { https: true, mobileViewport: true } } } });
    act(() => { q(el, 'outreach-toggle')!.click(); });
    expect(q(el, 'outreach-facts')!.textContent).toContain('No online booking link');
    const ta = q(el, 'outreach-text') as HTMLTextAreaElement;
    expect(ta.value).toContain("Joe's Pizza");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(ta, 'My edited note');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => { q(el, 'outreach-copy')!.click(); });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('My edited note'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Subject: A short video idea for Joe'));
  });
});
