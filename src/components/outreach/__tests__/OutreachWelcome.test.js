// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountOutreachWelcome } from '../OutreachWelcome.js';

const $ = (s) => document.querySelector(s);
const typeIn = (name, v) => { const i = $(`input[name="${name}"]`); i.value = v; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); };

describe('SmartVideo welcome', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="host"></div>'; });

  it('walks the five steps, saving every answer, and finishes on one click', () => {
    const onChange = vi.fn();
    const onFinish = vi.fn();
    mountOutreachWelcome($('#host'), { name: 'Sam', onChange, onFinish, onAcademy: () => {} });
    expect($('h1').textContent).toBe('Welcome, Sam. What do you want to do first?');
    expect(document.body.textContent).toContain('SmartVideo');
    expect(document.body.textContent).toContain('Step 1 of 5');
    $('[data-welcome-goal="dynamic"]').click();
    expect(onChange.mock.calls.at(-1)[0]).toMatchObject({ goal: 'dynamic', step: 2 });
    expect(document.body.textContent).toContain('Step 2 of 5');
    $('[data-welcome-team="2-5"]').click();
    $('[data-welcome-volume="100+"]').click();
    expect($('[data-welcome-skip]')).toBeNull(); // where you work has no Skip
    const go = $('[data-welcome-work] button[type="submit"]');
    expect(go.disabled).toBe(true);
    typeIn('company', 'Acme'); typeIn('website', 'acme'); typeIn('jobTitle', 'AE');
    expect(go.disabled).toBe(true);
    typeIn('website', 'https://acme.com');
    expect(go.disabled).toBe(false);
    $('[data-welcome-work]').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(document.body.textContent).toContain('how did you hear about us');
    $('[data-welcome-heard="linkedin"]').click();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0]).toMatchObject({ goal: 'dynamic', team: '2-5', volume: '100+', company: 'Acme', website: 'acme.com', jobTitle: 'AE', heard: 'linkedin' });
    expect(onFinish.mock.calls[0][0].completedAt).toBeTruthy();
    expect($('[data-outreach-welcome]')).toBeNull();
  });

  it('picks up where you left off; Back and Skip move between questions; Something else is typed', () => {
    const onFinish = vi.fn();
    mountOutreachWelcome($('#host'), { initial: { step: 3, goal: 'personal', team: 'solo' }, onFinish });
    expect(document.body.textContent).toContain('Step 3 of 5');
    $('[data-welcome-back]').click();
    expect($('[data-welcome-team="solo"]').getAttribute('aria-pressed')).toBe('true');
    $('[data-welcome-skip]').click();
    $('[data-welcome-skip]').click();
    expect(document.body.textContent).toContain('Step 4 of 5');
    typeIn('company', 'Acme'); typeIn('website', 'acme.com'); typeIn('jobTitle', 'AE');
    $('[data-welcome-work]').dispatchEvent(new Event('submit', { cancelable: true }));
    const other = $('input[aria-label="Something else"]');
    other.value = 'A billboard';
    other.closest('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(onFinish.mock.calls[0][0]).toMatchObject({ heard: 'other', heardOther: 'A billboard' });
  });

  it('greets without a name when there is none', () => {
    mountOutreachWelcome($('#host'), {});
    expect($('h1').textContent).toBe('Welcome. What do you want to do first?');
  });
});
