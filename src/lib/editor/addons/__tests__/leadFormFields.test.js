import { describe, it, expect } from 'vitest';
import { leadFieldTokens, defaultOptin, buildOptinForm, leadFormToOptin, applyOptinToLeadForm } from '../index.js';

describe('Lead Generator fields (upstream form.js parity)', () => {
  it('keys answers by the upper-cased label token, suffixing duplicates', () => {
    expect(leadFieldTokens([
      { id: 'email', label: 'Email' },
      { id: 'field_2', label: 'Phone number' },
      { id: 'field_3', label: 'email' },
      { id: 'x', label: '' },
    ])).toEqual(['EMAIL', 'PHONE NUMBER', 'EMAIL_2', 'X']);
  });

  // The Lead Generator preview now uses the shared opt-in renderer (the same
  // one as the List Builder), so the upstream field rules are asserted there.
  it('caps single-line at 80 and multiline at 250, with digit-only Number', () => {
    const cfg = {
      ...defaultOptin('lead-generator'),
      elements: [
        { id: 'a', label: 'A', type: 'singleline', token: 'A' },
        { id: 'b', label: 'B', type: 'multiline', token: 'B' },
        { id: 'c', label: 'C', type: 'number', token: 'C' },
        { id: 'd', label: 'D', type: 'phone', token: 'D' },
      ],
    };
    const form = buildOptinForm(cfg);
    expect(form.querySelector('[name="A"]').getAttribute('maxlength')).toBe('80');
    expect(form.querySelector('textarea[name="B"]').getAttribute('maxlength')).toBe('250');
    expect(form.querySelector('[name="D"]').type).toBe('tel');
    const num = form.querySelector('[name="C"]');
    num.value = 'a1b2-3';
    num.dispatchEvent(new Event('input'));
    expect(num.value).toBe('123');
  });

  it('fields are optional unless marked required (Lead Generator default: optional)', () => {
    const form = buildOptinForm(leadFormToOptin({
      id: 1, fields: [{ id: 'email', type: 'email', label: 'Email' }, { id: 'name', type: 'text', label: 'Name', required: true }],
    }));
    expect(form.querySelector('[name="EMAIL"]').required).toBe(false);
    expect(form.querySelector('[name="NAME"]').required).toBe(true);
  });
});

describe('Lead Generator clip <-> shared opt-in schema', () => {
  it('maps the stored clip onto the shared options (and back)', () => {
    const clip = {
      id: 5, heading: 'Hi', ctaText: 'Go', privacyText: 'P', skipButtonEnabled: true, brandLogoUrl: 'https://x/l.png',
      webhookEnabled: true, webhookUrl: 'https://a', emailNotificationEnabled: true, notificationEmail: 'o@x.y',
      fields: [{ id: 'email', type: 'email', label: 'Email', required: true }, { id: 'n', type: 'text', label: 'Full name' }],
      style: { buttonColor: '#00ff00', backgroundColor: '#101010', transition: 'fade', widthPercent: 70 },
    };
    const cfg = leadFormToOptin(clip);
    expect(cfg).toMatchObject({
      kind: 'lead-generator', caption: 'Hi', btnText: 'Go', privacyDisclaimer: 'P', enableSkipButton: true,
      brandLogoSrc: 'https://x/l.png', webhookEnabled: true, webhook: 'https://a', emailEnabled: true, emailAddress: 'o@x.y',
      buttonBackground: '#00ff00', backgroundColor: '#101010', transition: 'popcorn-fade', width: 70,
    });
    expect(cfg.elements.map((e) => [e.type, e.token, e.required])).toEqual([['email', 'EMAIL', true], ['singleline', 'FULL NAME', false]]);

    // Editing any design option writes back without touching the stored shape.
    const next = { ...cfg, buttonBackground: '#123456', pointerStyle: 'cursor', caption: 'Yo', elements: [...cfg.elements, { id: 'p', label: 'Phone', type: 'phone', required: false }] };
    applyOptinToLeadForm(clip, next);
    expect(clip.style.buttonColor).toBe('#123456');
    expect(clip.heading).toBe('Yo');
    expect(clip.design.pointerStyle).toBe('cursor');
    expect(clip.fields.map((f) => f.type)).toEqual(['email', 'text', 'phone']);
    expect(leadFormToOptin(clip).pointerStyle).toBe('cursor');
  });
});
