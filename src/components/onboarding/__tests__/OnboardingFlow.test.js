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
    expect($$('[data-onb-group]').map((s) => s.getAttribute('data-onb-group'))).toEqual(['Discover', 'Image', 'Video', 'Agents', 'My Work']);
    expect($$('[data-onb-tool]')).toHaveLength(38);
    expect($$('[data-onb-open]')).toHaveLength(38);
    expect($('[data-onb-open="avatar"]').getAttribute('href')).toBe('#/avatar');
    const video = $$('[data-onb-group="Video"] [data-onb-tool]').map((c) => c.getAttribute('data-onb-tool'));
    expect(video.slice(0, 2)).toEqual(['avatar', 'lipsync']);
    expect($('[data-onb-tool="avatar"] img')).not.toBeNull();
    expect($('[data-onb-start]').textContent).toBe('Explore all studios');
    $('[data-onb-tool="lipsync"]').click();
    $('[data-onb-tool="avatar"]').click();
    expect($('[data-onb-start]').textContent).toBe('Start');
    $('[data-onb-start]').click();
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

  it('uses the light design: .ob root, purple progress fill, two-card step 1, logo on step 1 and Back after', () => {
    mountOnboarding($('#host'), {});
    expect($('.ob')).not.toBeNull();
    expect($('.ob-bar > i').style.width).toBe(`${(1 / 6) * 100}%`);
    expect($('.ob-logo')).not.toBeNull();
    expect($('[data-onb-back]')).toBeNull();
    $('[data-onb-skip]').click();
    expect($('[data-onb-back]')).not.toBeNull();
    expect($('.ob-logo')).toBeNull();
    expect(document.body.classList.contains('ob-active')).toBe(true);
  });
});
