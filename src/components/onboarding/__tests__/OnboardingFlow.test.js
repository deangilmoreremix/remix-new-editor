// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/muapi.js', () => ({ muapi: {} }));
const { mountOnboarding } = await import('../OnboardingFlow.js');

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const typeIn = (name, v) => { const i = $(`input[name="${name}"]`); i.value = v; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); };

describe('app onboarding flow', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="host"></div>'; });

  it('walks all six steps, saves every answer, and finishes with the chosen tools', () => {
    const onChange = vi.fn();
    const onFinish = vi.fn();
    mountOnboarding($('#host'), { name: 'Sam', onChange, onFinish });
    expect($('h1').textContent).toBe('Welcome, Sam. What do you want to do first?');
    expect(document.body.textContent).toContain('Step 1 of 6');
    $('[data-onb-goal="ai-video"]').click();
    expect(onChange.mock.calls.at(-1)[0]).toMatchObject({ goal: 'ai-video', step: 2 });
    $('[data-onb-team="2-5"]').click();
    $('[data-onb-volume="100+"]').click();
    expect($('[data-onb-skip]')).toBeNull(); // where you work has no Skip
    const go = $('[data-onb-work] button[type="submit"]');
    expect(go.disabled).toBe(true);
    typeIn('company', 'Acme'); typeIn('website', 'https://acme.com'); typeIn('jobTitle', 'AE');
    expect(go.disabled).toBe(false);
    $('[data-onb-work]').dispatchEvent(new Event('submit', { cancelable: true }));
    $('[data-onb-heard="linkedin"]').click();
    // 6a: video kinds, the goal's own first
    expect(document.body.textContent).toContain('Step 6 of 6');
    expect($$('[data-onb-type]')[0].getAttribute('data-onb-type')).toBe('text-to-video');
    expect($('[data-onb-continue]').disabled).toBe(true);
    $('[data-onb-type="talking"]').click();
    expect($('[data-onb-type="talking"]').getAttribute('aria-pressed')).toBe('true');
    $('[data-onb-continue]').click();
    // 6b: tools grouped like the side menu, recommended first, with images
    expect($$('[data-onb-group]').map((s) => s.getAttribute('data-onb-group'))).toEqual(['Create', 'Enhance', 'Produce', 'Localize', 'Automate', 'Scale']);
    expect($$('[data-onb-jump-to]').map((b) => b.getAttribute('data-onb-jump-to'))).toEqual(['Create', 'Enhance', 'Produce', 'Localize', 'Automate', 'Scale']);
    expect($('[data-onb-group="Create"] .ob-gdesc').textContent).toMatch(/images, videos and characters/);
    expect($$('[data-onb-tool]')).toHaveLength(38);
    expect($$('[data-onb-open]')).toHaveLength(38);
    expect($('[data-onb-open="avatar"]').getAttribute('href')).toBe('#/avatar');
    const localize = $$('[data-onb-group="Localize"] [data-onb-tool]').map((c) => c.getAttribute('data-onb-tool'));
    expect(localize[0]).toBe('avatar'); // recommended for "talking", so first in its group
    expect(new Set(localize)).toEqual(new Set(['avatar', 'lipsync']));
    expect($('[data-onb-tool="avatar"] img')).not.toBeNull();
    expect($('[data-onb-start]').textContent).toBe('Explore all studios');
    $('[data-onb-tool="lipsync"]').click();
    $('[data-onb-tool="avatar"]').click();
    expect($('[data-onb-start]').textContent).toBe('Start');
    $('[data-onb-start]').click();
    expect(onFinish).not.toHaveBeenCalled();
    expect(document.querySelector('[data-onb-ready]')).not.toBeNull(); // 6c get ready
    $('[data-onb-finish]').click();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0]).toMatchObject({ goal: 'ai-video', team: '2-5', volume: '100+', company: 'Acme', website: 'acme.com', jobTitle: 'AE', heard: 'linkedin', videoTypes: ['talking'], tools: ['lipsync', 'avatar'], primaryTool: 'lipsync' });
    expect(onFinish.mock.calls[0][0].completedAt).toBeTruthy();
    expect($('[data-onboarding]')).toBeNull();
  });

  it('resumes where you left off; Back steps through the two parts of step 6; Skip moves on', () => {
    mountOnboarding($('#host'), { initial: { step: 6, videoTypes: ['effects'] } });
    expect($('[data-onb-group]')).not.toBeNull(); // saved video type -> straight to the tools
    $('[data-onb-back]').click();
    expect($('[data-onb-type]')).not.toBeNull();
    $('[data-onb-back]').click();
    expect(document.body.textContent).toContain('Step 5 of 6');
    $('[data-onb-skip]').click();
    expect(document.body.textContent).toContain('Step 6 of 6');
  });

  it('Open goes straight to that studio: it finishes with that studio first and keeps other picks', () => {
    const onFinish = vi.fn();
    mountOnboarding($('#host'), { initial: { step: 6, videoTypes: ['talking'], tools: ['avatar'], primaryTool: 'avatar' }, onFinish });
    $('[data-onb-open="outreach"]').click();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0]).toMatchObject({ primaryTool: 'outreach', tools: ['outreach', 'avatar'] });
    expect($('[data-onboarding]')).toBeNull();
  });

  it('a card can be picked with the keyboard (Enter) and a modified click on Open does not toggle it', () => {
    mountOnboarding($('#host'), { initial: { step: 6, videoTypes: ['talking'] } });
    const card = $('[data-onb-tool="influencer"]');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(card.getAttribute('aria-pressed')).toBe('true');
    $('[data-onb-open="library"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    expect($('[data-onb-tool="library"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('step 1 is two large cards and the orange Academy button; the Academy button leaves to #/academy', () => {
    const onDismiss = vi.fn();
    mountOnboarding($('#host'), { onDismiss });
    expect($$('[data-onb-goal]')).toHaveLength(2);
    expect($$('[data-onb-goal]').map((c) => c.getAttribute('data-onb-goal'))).toEqual(['ai-video', 'personal']);
    expect($('[data-onb-dismiss]')).toBeNull(); // no "skip onboarding" link in the design
    expect($('[data-onb-academy]').textContent).toContain('Not sure? Learn it in the SmartVideo Academy');
    $('[data-onb-academy]').click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss.mock.calls[0][1]).toBe('academy');
    expect(onDismiss.mock.calls[0][0].skippedAt).toBeTruthy();
    expect($('[data-onboarding]')).toBeNull();
  });

  it('uses the onboarding layout: .ob root, progress fill, logo on step 1 and Back after, real buttons for choices', () => {
    mountOnboarding($('#host'), {});
    expect($('.ob')).not.toBeNull();
    expect($('.ob-bar > i').style.width).toBe(`${(1 / 6) * 100}%`);
    expect($('.ob-logo')).not.toBeNull();
    expect($('[data-onb-back]')).toBeNull();
    $('[data-onb-skip]').click();
    expect($('[data-onb-back]')).not.toBeNull();
    expect($('.ob-logo')).toBeNull();
    expect(document.body.classList.contains('ob-active')).toBe(true);
    // choices are real <button>s with no fill opt-out, so the app's outline-only button design applies
    expect($('[data-onb-team]').tagName).toBe('BUTTON');
    expect($('[data-keep-fill]')).toBeNull();
  });

  it('reports the funnel events with choice ids only, never typed text', () => {
    const onEvent = vi.fn();
    mountOnboarding($('#host'), { onEvent });
    $('[data-onb-goal="personal"]').click();
    $('[data-onb-skip]').click(); // skip step 2
    $('[data-onb-back]').click();
    $('[data-onb-team="2-5"]').click();
    $('[data-onb-volume="100+"]').click();
    typeIn('company', 'Secret Co'); typeIn('website', 'https://secret.example'); typeIn('jobTitle', 'CEO');
    $('[data-onb-work]').dispatchEvent(new Event('submit', { cancelable: true }));
    $('[data-onb-heard="linkedin"]').click();
    $('[data-onb-type="talking"]').click();
    $('[data-onb-continue]').click();
    const names = onEvent.mock.calls.map((c) => c[0]);
    expect(names[0]).toBe('step_view');
    expect(names).toEqual(expect.arrayContaining(['step_answer', 'skip_step', 'back']));
    const views = onEvent.mock.calls.filter((c) => c[0] === 'step_view').map((c) => `${c[1].step}${c[1].sub ? `:${c[1].sub}` : ''}`);
    expect(views).toEqual(expect.arrayContaining(['1', '2', '3', '4', '5', '6:type', '6:tools']));
    expect(onEvent.mock.calls.find((c) => c[0] === 'step_answer' && c[1].props.field === 'goal')[1].props.value).toBe('personal');
    expect(JSON.stringify(onEvent.mock.calls)).not.toMatch(/Secret|secret\.example|CEO/);
  });

  it('a throwing event listener never breaks the flow', () => {
    mountOnboarding($('#host'), { onEvent: () => { throw new Error('boom'); } });
    expect(() => $('[data-onb-goal="personal"]').click()).not.toThrow();
    expect(document.body.textContent).toContain('Step 2 of 6');
  });

  it('the jump bar scrolls to a group and marks it current', () => {
    const calls = [];
    HTMLElement.prototype.scrollIntoView = function scroll() { calls.push(this.getAttribute('data-onb-group')); };
    mountOnboarding($('#host'), { initial: { step: 6, videoTypes: ['talking'] } });
    expect($('[data-onb-jump-to="Create"]').getAttribute('aria-current')).toBe('true');
    $('[data-onb-jump-to="Automate"]').click();
    expect(calls).toEqual(['Automate']);
    expect($('[data-onb-jump-to="Automate"]').getAttribute('aria-current')).toBe('true');
    expect($('[data-onb-jump-to="Create"]').getAttribute('aria-current')).toBeNull();
    expect($$('[data-onb-tool]')).toHaveLength(38); // the jump bar never hides a studio
  });
});
