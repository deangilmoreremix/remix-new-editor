import { describe, it, expect, vi } from 'vitest';
import { ctaTarget, phoneE164, COUNTRY_CODES, CTA_LINK_DEFAULTS } from '../ctaLink.js';
import { getAddon } from '../registry.js';
import '../index.js';
import { linkBoxElement, ctaElement } from '../../publish/viewerOverlays.js';
import { createInteractivePlayer } from '../../publish/interactivePlayer.js';

describe('click-to-call links', () => {
  it('builds tel: links from a country code + number', () => {
    expect(phoneE164('1', '(234) 567-8900')).toBe('+12345678900');
    expect(phoneE164('44', '07700 900123')).toBe('+447700900123'); // national leading 0 dropped
    expect(phoneE164('1', '+44 7700 900123')).toBe('+447700900123'); // own +code wins
    expect(phoneE164('1', '123')).toBeNull();
    expect(ctaTarget({ linkMode: 'phone', phoneCountry: '1', phoneNumber: '234 567 8900' })).toEqual({ href: 'tel:+12345678900', kind: 'phone', phone: '+12345678900' });
    expect(ctaTarget({ linkMode: 'url', linkUrl: 'example.com' })).toEqual({ href: 'https://example.com/', kind: 'url' });
    expect(ctaTarget({ linkUrl: 'tel:+15551234567' })).toMatchObject({ kind: 'phone' }); // older projects
    expect(ctaTarget({ linkUrl: 'javascript:alert(1)' })).toBeNull();
    expect(COUNTRY_CODES.length).toBeGreaterThan(50);
  });

  it('Smart Text, Image and Personalized Image get the URL / PHONE switch', () => {
    ['overlay-text', 'overlay-image', 'overlay-personalized-image'].forEach((type) => {
      const a = getAddon(type);
      expect(a.defaults()).toMatchObject(CTA_LINK_DEFAULTS);
      const keys = a.fields.map((f) => f.key);
      expect(keys).toEqual(expect.arrayContaining(['linkMode', 'linkUrl', 'phoneCountry', 'phoneNumber', 'callNotifyAddress']));
      const phone = a.fields.find((f) => f.key === 'phoneNumber');
      expect(phone.showIf({ linkMode: 'phone' })).toBe(true);
      expect(phone.showIf({ linkMode: 'url' })).toBe(false);
    });
  });

  it('player: tapping a phone link records a call attempt', () => {
    const onCall = vi.fn();
    const clip = { id: 'img1', type: 'overlay-image', addon: { linkMode: 'phone', phoneCountry: '1', phoneNumber: '2345678900', callNotifyAddress: 'me@x.co', geometry: { left: 1, top: 2, width: 3, height: 4 } } };
    const a = linkBoxElement(clip, { onCall });
    expect(a.getAttribute('href')).toBe('tel:+12345678900');
    expect(a.getAttribute('aria-label')).toMatch(/^Call \+12345678900/);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onCall).toHaveBeenCalledWith({ clip, phone: '+12345678900', notify: 'me@x.co' });
    const cta = ctaElement({ id: 'c', phoneNumber: '+1 555 123 4567' }, { onCall });
    cta.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onCall).toHaveBeenCalledTimes(2);
  });

  it('player sends call attempts as leads', () => {
    const frame = document.createElement('div');
    const onLead = vi.fn(async () => ({ stored: true }));
    let onFrame;
    const createEngine = (h, o) => { onFrame = o.onFrame; return { play() {}, pause() {}, seekToFrame() {}, update() {}, destroy() {} }; };
    const project = { timelineSeconds: 10, tracks: [{ id: 't', type: 'text', items: [{ id: 'txt', type: 'overlay-text', left: 0, width: 50, addon: { text: 'Call us', linkMode: 'phone', phoneCountry: '44', phoneNumber: '7700900123' } }] }] };
    const p = createInteractivePlayer({ project, stage: frame, frame, createEngine, onLead });
    p.play();
    onFrame(30);
    frame.querySelector('.wf-linkbox').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onLead).toHaveBeenCalledWith(expect.objectContaining({ clipId: 'txt', kind: 'call-attempt', data: expect.objectContaining({ PHONE: '+447700900123' }) }));
  });
});
