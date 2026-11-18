// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountFirstVideo, STAGES } from '../OutreachFirstVideo.js';

const $ = (s) => document.querySelector(s);
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Your first video', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="host"></div>'; vi.useRealTimers(); });

  it('shows your details and what you get, then makes the video stage by stage and shows it ready', async () => {
    let finish;
    const make = vi.fn((d, onStage) => new Promise((res) => { finish = () => { STAGES.forEach((s) => onStage(s.id)); onStage('done'); res({ ok: true, link: 'https://x.test/watch/abc?c=1', embed: 'https://x.test/watch/abc?c=1&embed=1', pageLink: 'https://x.test/p/pg1?c=1' }); }; }));
    const onProspects = vi.fn();
    mountFirstVideo($('#host'), { name: 'Sam', company: 'Acme', website: 'acme.com', make, onProspects });
    expect($('h1').textContent).toBe('See a personalized video made for you');
    expect(document.body.textContent).toContain('Hi Sam!');
    expect(document.body.textContent).toContain('acme.com');
    $('[data-first-details]').dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();
    expect($('[data-first-making]')).not.toBeNull();
    expect(make.mock.calls[0][0]).toEqual({ firstName: 'Sam', company: 'Acme', website: 'acme.com' });
    expect([...document.querySelectorAll('[data-first-stage]')].map((n) => n.textContent)).toEqual(STAGES.map((s) => s.label));
    // The stages follow the real work: none has started until Generate reports it.
    expect($('[data-first-stage="site"]').dataset.state).toBe('waiting');
    expect($('[data-first-percent]').textContent).toBe('Starting\u2026');
    const onStage = make.mock.calls[0][1];
    onStage('site', 1); onStage('voice', 0.5);
    expect($('[data-first-stage="site"]').dataset.state).toBe('done');
    expect($('[data-first-stage="voice"]').dataset.state).toBe('working');
    expect($('[data-first-stage="render"]').dataset.state).toBe('waiting');
    expect($('[data-first-percent]').textContent).toBe('38% done');
    onStage('site', 0); // never goes back
    expect($('[data-first-stage="site"]').dataset.state).toBe('done');
    finish();
    await new Promise((r) => setTimeout(r, 700));
    expect($('[data-first-ready]')).not.toBeNull();
    expect($('h1').textContent).toBe('Sam, your video is ready');
    expect($('iframe').src).toContain('embed=1');
    expect($('[data-first-watch]').href).toBe('https://x.test/p/pg1?c=1');
    $('[data-first-prospects]').click();
    expect(onProspects).toHaveBeenCalled();
    expect($('[data-outreach-first-video]')).toBeNull();
  });

  it('needs a name, company and web address; a failure goes back to your details with the reason', async () => {
    const make = vi.fn(async () => ({ ok: false, error: 'Add your MuAPI key first.' }));
    mountFirstVideo($('#host'), { name: '', company: 'Acme', website: 'acme', make });
    expect($('[data-first-make]').disabled).toBe(true);
    const set = (n, v) => { const i = $(`input[name="${n}"]`); i.value = v; i.dispatchEvent(new Event('input')); };
    set('firstName', 'Sam'); set('website', 'acme.com');
    expect($('[data-first-make]').disabled).toBe(false);
    $('[data-first-details]').dispatchEvent(new Event('submit', { cancelable: true }));
    await tick(); await tick();
    expect($('[data-first-error]').textContent).toBe('Add your MuAPI key first.');
  });

  it('Do this later closes it', () => {
    const onLater = vi.fn();
    mountFirstVideo($('#host'), { onLater, make: vi.fn() });
    $('[data-first-later]').click();
    expect(onLater).toHaveBeenCalled();
    expect($('[data-outreach-first-video]')).toBeNull();
  });
});
