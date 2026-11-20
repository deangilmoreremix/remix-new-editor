// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/muapi.js', () => ({ muapi: {} }));
const keys = { has: false };
const testAndSave = vi.fn();
vi.mock('../../../lib/onboarding/keySetup.js', () => ({
  hasMuapiKey: () => keys.has,
  testAndSaveMuapiKey: (...a) => testAndSave(...a),
}));
const { mountOnboarding } = await import('../OnboardingFlow.js');

const $ = (s) => document.querySelector(s);
const tick = () => new Promise((r) => setTimeout(r, 0));
const toReady = (over = {}, extra = {}) => {
  mountOnboarding($('#host'), { initial: { step: 6, videoTypes: ['talking'], tools: ['avatar'], primaryTool: 'avatar', ...over }, ...extra });
  $('[data-onb-start]').click();
};

describe('onboarding step 6c: get ready', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="host"></div>'; keys.has = false; testAndSave.mockReset(); });

  it('names the chosen studio, offers the key field, "See plans" and Skip', () => {
    const onEvent = vi.fn();
    toReady({}, { onEvent });
    expect($('h1').textContent).toBe('Get ready for your first result');
    expect($('[data-onb-finish]').textContent).toMatch(/^Open /);
    expect($('[data-onb-key-input]').type).toBe('password');
    expect($('[data-onb-plans]')).not.toBeNull();
    expect($('[data-onb-access]').textContent).toContain('full access');
    const sub = onEvent.mock.calls.filter((c) => c[0] === 'step_view').map((c) => c[1].sub);
    expect(sub.at(-1)).toBe('ready');
  });

  it('Back returns to the studios; Skip for now finishes without a key', () => {
    const onFinish = vi.fn();
    const onEvent = vi.fn();
    toReady({}, { onFinish, onEvent });
    $('[data-onb-back]').click();
    expect($('[data-onb-group]')).not.toBeNull();
    $('[data-onb-start]').click();
    $('[data-onb-ready-skip]').click();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls.some((c) => c[0] === 'skip_step' && c[1].sub === 'ready')).toBe(true);
  });

  it('a good key shows the connected row, reports key_tested and key_saved, and removes the field', async () => {
    testAndSave.mockResolvedValue({ ok: true, status: 'valid', balance: 12 });
    const onEvent = vi.fn();
    toReady({}, { onEvent });
    $('[data-onb-key-input]').value = 'abcdefghij123456';
    $('[data-onb-key-form]').dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();
    expect(testAndSave).toHaveBeenCalledWith('abcdefghij123456');
    expect($('[data-onb-key-connected]').textContent).toContain('12 credits');
    expect($('[data-onb-key-form]')).toBeNull();
    const names = onEvent.mock.calls.map((c) => c[0]);
    expect(names).toEqual(expect.arrayContaining(['key_tested', 'key_saved']));
    expect(JSON.stringify(onEvent.mock.calls)).not.toContain('abcdefghij123456'); // the key never leaves the form
  });

  it('a rejected key shows the error, keeps the field and reports an unsuccessful test only', async () => {
    testAndSave.mockResolvedValue({ ok: false, status: 'invalid', error: 'Muapi did not accept that key. Check it and try again.' });
    const onEvent = vi.fn();
    toReady({}, { onEvent });
    $('[data-onb-key-input]').value = 'abcdefghij123456';
    $('[data-onb-key-form]').dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();
    expect($('.ob-key-status').textContent).toContain('did not accept');
    expect($('[data-onb-key-form]')).not.toBeNull();
    expect(onEvent.mock.calls.find((c) => c[0] === 'key_tested')[1].props.ok).toBe(false);
    expect(onEvent.mock.calls.some((c) => c[0] === 'key_saved')).toBe(false);
  });

  it('someone who already has a key just sees it connected', () => {
    keys.has = true;
    toReady();
    expect($('[data-onb-key-connected]')).not.toBeNull();
    expect($('[data-onb-key-form]')).toBeNull();
  });
});
