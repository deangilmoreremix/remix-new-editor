// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { samplePromptFor, samplePromptRoutes, stageSamplePrompt, applyStagedSample } from '../samplePrompt.js';
import { consumeStudioPrefill } from '../../studioPrefill.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

describe('sample prompts', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

  it('mentions the company, falls back to "your business", and has none for studios without a prompt box', () => {
    expect(samplePromptFor('image', { company: '  Acme   Inc ' })).toContain('Acme Inc');
    expect(samplePromptFor('video', {})).toContain('your business');
    expect(samplePromptFor('outreach', { company: 'Acme' })).toBe('');
    expect(samplePromptRoutes().length).toBeGreaterThan(5);
  });

  it('image and video go through the shared studio prefill', () => {
    expect(stageSamplePrompt('image', { company: 'Acme' })).toBe(true);
    expect(consumeStudioPrefill('image').prompt).toContain('Acme');
    expect(stageSamplePrompt('outreach', { company: 'Acme' })).toBe(false);
  });

  it('other studios get a one-shot note that fills an empty prompt box when it appears, and never overwrites typing', async () => {
    const st = mem();
    stageSamplePrompt('cinema', { company: 'Acme' }, st);
    const cancel = applyStagedSample('cinema', { storage: st, interval: 5 });
    const ta = document.createElement('textarea');
    ta.setAttribute('data-studio-prompt', '');
    setTimeout(() => document.body.appendChild(ta), 12);
    await new Promise((r) => setTimeout(r, 60));
    cancel();
    expect(ta.value).toContain('Acme');
    expect(st.getItem('smartvideo-onboarding-sample')).toBeNull();

    stageSamplePrompt('cinema', { company: 'Acme' }, st);
    const typed = document.createElement('textarea');
    typed.setAttribute('data-studio-prompt', ''); typed.value = 'my own words';
    document.body.replaceChildren(typed);
    applyStagedSample('cinema', { storage: st });
    expect(typed.value).toBe('my own words');
  });

  it('ignores a note for another studio and an old one', () => {
    const st = mem();
    stageSamplePrompt('cinema', { company: 'Acme' }, st);
    applyStagedSample('image', { storage: st });
    expect(st.getItem('smartvideo-onboarding-sample')).not.toBeNull();
    st.setItem('smartvideo-onboarding-sample', JSON.stringify({ route: 'cinema', prompt: 'x', at: Date.now() - 3600_000 }));
    applyStagedSample('cinema', { storage: st });
    expect(st.getItem('smartvideo-onboarding-sample')).toBeNull();
  });
});
