import { describe, it, expect, vi } from 'vitest';
import { pixelIdFor, fireLeadPixel, trackersFor, fireLeadTrackers } from '../pixel.js';
import { listBuilderFields, leadFormToOptin, defaultListBuilder } from '../../addons/index.js';

const project = {
  listBuilder: { enabled: true, fbPixelId: ' 1234567890 ' },
  tracks: [{ items: [{ id: 7, type: 'lead-form', fbPixelId: '987654321' }, { id: 8, type: 'lead-form', fbPixelId: 'abc' }] }],
};

describe('published-video Facebook Pixel', () => {
  it('finds the pixel id for a lead form clip or the list builder', () => {
    expect(pixelIdFor(project, 'lead-form', '7')).toBe('987654321');
    expect(pixelIdFor(project, 'list-builder', 'list-builder')).toBe('1234567890');
    expect(pixelIdFor(project, 'personalizer', 'list-builder')).toBe('1234567890');
  });

  it('ignores missing, invalid or disabled pixel ids', () => {
    expect(pixelIdFor(project, 'lead-form', '8')).toBe('');
    expect(pixelIdFor(project, 'lead-form', '99')).toBe('');
    expect(pixelIdFor({ listBuilder: { enabled: false, fbPixelId: '1234567890' } }, 'list-builder')).toBe('');
    expect(pixelIdFor(project, 'call-attempt', '7')).toBe('');
  });

  it('fires a bare Lead (no form answers) only with full consent', () => {
    const fbq = vi.fn();
    const win = { document: { createElement: () => ({}), head: { appendChild() {} } }, fbq };
    expect(fireLeadPixel('1234567890', { win, mode: 'full' })).toBe(true);
    expect(fbq).toHaveBeenCalledWith('init', '1234567890');
    expect(fbq).toHaveBeenCalledWith('trackSingle', '1234567890', 'Lead');
    expect(fbq.mock.calls.every((c) => c.length <= 3)).toBe(true);
  });

  it('does nothing when the viewer opted out or there is no id', () => {
    const fbq = vi.fn();
    const win = { document: {}, fbq };
    expect(fireLeadPixel('1234567890', { win, mode: 'off' })).toBe(false);
    expect(fireLeadPixel('1234567890', { win, mode: 'anonymous' })).toBe(false);
    expect(fireLeadPixel('', { win, mode: 'full' })).toBe(false);
    expect(fbq).not.toHaveBeenCalled();
  });
});

const IDS = { fbPixelId: '1234567890', gaMeasurementId: ' g-ab12cd34ef ', tiktokPixelId: 'c1a2b3c4d5e6f7g8h9', gtmId: 'gtm-abc1234' };
const proj = { listBuilder: { enabled: true, ...IDS }, tracks: [{ items: [{ id: 3, type: 'lead-form', ...IDS }] }] };

// A window that records the scripts it is asked to load and every tracker call.
function fakeWin() {
  const scripts = [];
  return { scripts, document: { createElement: () => ({}), head: { appendChild: (el) => scripts.push(el.src) } } };
}

describe('GA4 / TikTok / GTM trackers', () => {
  it('reads and validates every tracker id for a lead form and the list builder', () => {
    const expected = { fb: '1234567890', ga: 'G-AB12CD34EF', tiktok: 'C1A2B3C4D5E6F7G8H9', gtm: 'GTM-ABC1234' };
    expect(trackersFor(proj, 'lead-form', '3')).toEqual(expected);
    expect(trackersFor(proj, 'list-builder', 'list-builder')).toEqual(expected);
    expect(trackersFor(proj, 'personalizer', 'list-builder')).toEqual(expected);
  });

  it('ignores missing, disabled and unsafe ids (they never reach a script URL)', () => {
    const bad = { enabled: true, gaMeasurementId: 'G-1&x=1', tiktokPixelId: '"><script>', gtmId: 'GTM-', fbPixelId: 'abc' };
    expect(trackersFor({ listBuilder: bad }, 'list-builder')).toEqual({});
    expect(trackersFor({ listBuilder: { ...bad, enabled: false, gtmId: 'GTM-ABC1234' } }, 'list-builder')).toEqual({});
    expect(trackersFor(proj, 'lead-form', '99')).toEqual({});
    expect(trackersFor(proj, 'call-attempt', '3')).toEqual({});
    expect(trackersFor(null, 'lead-form', '3')).toEqual({});
  });

  it('GA4: loads gtag.js once, then sends generate_lead with no form data', () => {
    const win = fakeWin();
    expect(fireLeadTrackers({ ga: 'G-AB12CD34EF' }, { win, mode: 'full' })).toEqual(['ga']);
    expect(fireLeadTrackers({ ga: 'G-AB12CD34EF' }, { win, mode: 'full' })).toEqual(['ga']);
    expect(win.scripts).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-AB12CD34EF']);
    const calls = win.dataLayer.map((a) => Array.from(a));
    expect(calls.filter((c) => c[0] === 'config')).toEqual([['config', 'G-AB12CD34EF', { send_page_view: false }]]);
    expect(calls.filter((c) => c[0] === 'event')).toEqual([
      ['event', 'generate_lead', { send_to: 'G-AB12CD34EF' }], ['event', 'generate_lead', { send_to: 'G-AB12CD34EF' }],
    ]);
  });

  it('GTM: loads the container once and pushes a generate_lead event', () => {
    const win = fakeWin();
    fireLeadTrackers({ gtm: 'GTM-ABC1234' }, { win, mode: 'full' });
    fireLeadTrackers({ gtm: 'GTM-ABC1234' }, { win, mode: 'full' });
    expect(win.scripts).toEqual(['https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234']);
    expect(win.dataLayer.filter((e) => e.event === 'generate_lead')).toHaveLength(2);
    expect(win.dataLayer[0]).toMatchObject({ event: 'gtm.js' });
  });

  it('TikTok: loads the pixel once and queues a SubmitForm event for that pixel', () => {
    const win = fakeWin();
    expect(fireLeadTrackers({ tiktok: 'C1A2B3C4D5E6F7G8H9' }, { win, mode: 'full' })).toEqual(['tiktok']);
    fireLeadTrackers({ tiktok: 'C1A2B3C4D5E6F7G8H9' }, { win, mode: 'full' });
    expect(win.scripts).toEqual(['https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=C1A2B3C4D5E6F7G8H9&lib=ttq']);
    const queued = win.ttq._i.C1A2B3C4D5E6F7G8H9;
    expect(queued.filter((c) => c[0] === 'track')).toEqual([['track', 'SubmitForm'], ['track', 'SubmitForm']]);
  });

  it('Facebook: sets up fbq itself when the page has none and queues init + Lead (regression: the stub used to throw)', () => {
    const win = fakeWin();
    expect(fireLeadPixel('1234567890', { win, mode: 'full' })).toBe(true);
    expect(win.scripts).toEqual(['https://connect.facebook.net/en_US/fbevents.js']);
    expect(win.fbq.queue.map((a) => Array.from(a))).toEqual([['init', '1234567890'], ['trackSingle', '1234567890', 'Lead']]);
  });

  it('fires every configured tracker and reports which ones', () => {
    const win = fakeWin();
    win.fbq = undefined;
    const fired = fireLeadTrackers(trackersFor(proj, 'lead-form', '3'), { win, mode: 'full' });
    expect(fired).toEqual(['fb', 'ga', 'tiktok', 'gtm']);
    expect(win.scripts).toHaveLength(4);
  });

  it('never sends form answers or personal data to any tracker', () => {
    const win = fakeWin();
    fireLeadTrackers(trackersFor(proj, 'lead-form', '3'), { win, mode: 'full' });
    const everything = JSON.stringify([win.dataLayer, win.ttq, win.scripts, win.fbq?.queue]);
    expect(everything).not.toMatch(/@|EMAIL|NAME|PHONE/);
  });

  it('does nothing for an opted-out or anonymous viewer, or with no trackers', () => {
    for (const mode of ['off', 'anonymous']) {
      const win = fakeWin();
      expect(fireLeadTrackers(trackersFor(proj, 'lead-form', '3'), { win, mode })).toEqual([]);
      expect(win.scripts).toEqual([]);
      expect(win.dataLayer).toBeUndefined();
      expect(win.ttq).toBeUndefined();
    }
    expect(fireLeadTrackers({}, { win: fakeWin(), mode: 'full' })).toEqual([]);
    expect(fireLeadTrackers({ ga: 'G-AB12CD34EF' }, { win: {}, mode: 'full' })).toEqual([]); // no document
  });

  it('one broken tracker does not stop the others', () => {
    const win = fakeWin();
    win.document.head.appendChild = (el) => { if (/gtag/.test(el.src)) throw new Error('blocked'); win.scripts.push(el.src); };
    expect(fireLeadTrackers({ ga: 'G-AB12CD34EF', gtm: 'GTM-ABC1234' }, { win, mode: 'full' })).toEqual(['gtm']);
  });

  it('is offered on the List Builder Integrations tab (not Personalizer) and carries over from a Lead Generator clip', () => {
    const keys = (cfg) => listBuilderFields(cfg).filter((f) => f.tab === 'Integrations').map((f) => f.key);
    expect(keys({ kind: 'list-builder' })).toEqual(expect.arrayContaining(['fbPixelId', 'gaMeasurementId', 'tiktokPixelId', 'gtmId']));
    expect(keys({ kind: 'personalizer' })).toEqual([]);
    expect(defaultListBuilder()).toMatchObject({ gaMeasurementId: '', tiktokPixelId: '', gtmId: '' });
    expect(leadFormToOptin({ ...IDS, fields: [] })).toMatchObject({ gaMeasurementId: IDS.gaMeasurementId, tiktokPixelId: IDS.tiktokPixelId, gtmId: IDS.gtmId });
  });
});
