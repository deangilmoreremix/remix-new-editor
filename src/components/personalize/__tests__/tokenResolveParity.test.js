import { describe, it, expect } from 'vitest';
import { resolveTokenText } from '../tokenSchema.js';
import { resolveOverlayText } from '../../../lib/editor/addons/overlayRender.js';
import { replaceTokensInPrompt } from '../personalizePopover.js';

const A = { variables: { firstName: 'John', company: 'Smith Roofing' } };
const B = { variables: { firstName: 'Sarah', company: 'Johnson Construction' } };
const text = 'Hello {{FIRSTNAME}}, welcome to {{up COMPANY}}. {{d CITY "your area"}}';

describe('token resolution parity (overlay, prompt, viewer)', () => {
  it('overlay text and prompts resolve identically, including up/d syntax', () => {
    const expectA = 'Hello John, welcome to SMITH ROOFING. your area';
    expect(resolveOverlayText(text, A)).toBe(expectA);
    expect(replaceTokensInPrompt(text, A)).toBe(expectA);
  });

  it('one master text gives each recipient only their own values', () => {
    expect(resolveTokenText(text, B)).toContain('Sarah');
    expect(resolveTokenText(text, B)).not.toContain('John');
    expect(resolveTokenText(text, A)).not.toContain('Johnson');
  });

  it('keeps unresolved tokens for editors but strips them for viewers', () => {
    expect(resolveTokenText('Hi {{FIRSTNAME}} {{unknownThing}}', {})).toBe('Hi {{FIRSTNAME}} {{unknownThing}}');
    expect(resolveTokenText('Hi {{FIRSTNAME}} {{unknownThing}}', {}, { strip: true })).toBe('Hi  ');
  });

  it('does not mutate the master text', () => {
    const master = 'Hello {{FIRSTNAME}}';
    resolveTokenText(master, A);
    expect(master).toBe('Hello {{FIRSTNAME}}');
  });
});

describe('businessPhone is only ever a phone number', () => {
  it('never falls back to the contact email or the website', async () => {
    const { resolveToken } = await import('../tokenSchema.js');
    const p = { contact: { email: 'ann@acme.test' }, website: { url: 'https://acme.test' }, social: { website: 'https://acme.test' } };
    expect(resolveToken(p, 'businessPhone')).toBeNull();
    expect(resolveToken(p, 'phone')).toBeNull();
    expect(resolveToken({ ...p, contact: { ...p.contact, phone: '+15550001' } }, 'phone')).toBe('+15550001');
  });
});
