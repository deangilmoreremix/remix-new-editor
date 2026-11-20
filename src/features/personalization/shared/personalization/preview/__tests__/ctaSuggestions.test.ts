import { describe, expect, it } from 'vitest';
import { buildCtaSuggestions, instagramHandle } from '../ctaSuggestions';

describe('instagramHandle', () => {
  it('extracts a handle from a profile URL', () => {
    expect(instagramHandle('https://www.instagram.com/joes_pizza/')).toBe('joes_pizza');
    expect(instagramHandle('instagram.com/joes.pizza?hl=en')).toBe('joes.pizza');
    expect(instagramHandle('@joes_pizza')).toBe('joes_pizza');
  });
  it('rejects non-profile paths and junk', () => {
    expect(instagramHandle('https://instagram.com/p/AbC123/')).toBeNull();
    expect(instagramHandle('https://instagram.com/explore/')).toBeNull();
    expect(instagramHandle('not a url with spaces')).toBeNull();
    expect(instagramHandle('')).toBeNull();
    expect(instagramHandle(undefined)).toBeNull();
  });
});

describe('buildCtaSuggestions', () => {
  it('returns nothing when no contact data exists (never invents)', () => {
    expect(buildCtaSuggestions({})).toEqual([]);
  });
  it('builds one suggestion per real field with its source', () => {
    const s = buildCtaSuggestions({
      phone: '(813) 555-0100',
      website: 'https://www.joes.com/',
      email: 'hi@joes.com',
      instagram: 'https://instagram.com/joes_pizza',
      openingHours: 'Mo-Sa 09:00-17:00',
    });
    const byId = Object.fromEntries(s.map((x) => [x.id, x]));
    expect(byId.call.text).toBe('Call (813) 555-0100');
    expect(byId.visit.text).toBe('Visit joes.com');
    expect(byId.email.text).toBe('Email hi@joes.com');
    expect(byId.instagram.text).toBe('Follow @joes_pizza');
    expect(byId.hours.text).toBe('Open Mon–Sat 9 am–5 pm');
    expect(s.every((x) => x.source.length > 0)).toBe(true);
  });
  it('puts the strongest local-business call first', () => {
    const s = buildCtaSuggestions({ website: 'joes.com', phone: '555-0100' });
    expect(s[0].id).toBe('call');
  });
  it('drops overlong or script-like values', () => {
    const s = buildCtaSuggestions({
      email: 'a'.repeat(80) + '@x.com',
      openingHours: 'x'.repeat(200),
      phone: 'call me maybe',
    });
    expect(s).toEqual([]);
  });
});

import { endCardExtraLine } from '../ctaSuggestions';
describe('endCardExtraLine', () => {
  it('joins a valid email and handle, drops junk, and is empty with nothing', () => {
    expect(endCardExtraLine({ email: 'hi@joes.com', instagram: 'https://instagram.com/joes_pizza' })).toBe('hi@joes.com   ·   @joes_pizza');
    expect(endCardExtraLine({ email: 'nope', instagram: 'https://instagram.com/p/xyz' })).toBe('');
    expect(endCardExtraLine({})).toBe('');
  });
});

import { describeHours } from '../../../../../../../netlify/functions/_personalization/src/server/businessEnrichment/openingHours';
describe('describeHours', () => {
  it('summarises simple hours and refuses complex ones', () => {
    expect(describeHours('Mo-Sa 09:00-17:00')).toBe('Mon–Sat 9 am–5 pm');
    expect(describeHours('24/7')).toBe('open 24/7');
    expect(describeHours('Mo-Fr 08:30-12:00; Sa 10:00-14:00')).toBe('Mon–Fri 8:30 am–12 pm, Sat 10 am–2 pm');
    expect(describeHours('Mo-Su 09:00-17:00')).toBe('daily 9 am–5 pm');
    expect(describeHours('Mo-Fr 09:00-12:00,13:00-17:00')).toBeNull();
    expect(describeHours('Mo-Su sunrise-sunset')).toBeNull();
    expect(describeHours('')).toBeNull();
  });
});

import { ratingLine } from '../ctaSuggestions';
describe('ratingLine', () => {
  it('formats on a 5-star scale and refuses bad data', () => {
    expect(ratingLine({ value: 4.8, count: 120, best: 5 })).toBe('4.8 ★ · 120 reviews');
    expect(ratingLine({ value: 9, count: 1, best: 10 })).toBe('4.5 ★ · 1 review');
    expect(ratingLine({ value: 6, count: 10, best: 5 })).toBe('');
    expect(ratingLine({ value: 4, count: 0, best: 5 })).toBe('');
    expect(ratingLine(null)).toBe('');
  });
});

describe('endCardExtraLine does not repeat the call to action', () => {
  it('drops the email / handle the CTA already shows', () => {
    const input = { email: 'hi@joes.com', instagram: '@joes_pizza' };
    expect(endCardExtraLine({ ...input, cta: 'Email hi@joes.com' })).toBe('@joes_pizza');
    expect(endCardExtraLine({ ...input, cta: 'Follow @JOES_PIZZA' })).toBe('hi@joes.com');
    expect(endCardExtraLine({ ...input, cta: 'Email hi@joes.com Follow @joes_pizza' })).toBe('');
    expect(endCardExtraLine({ ...input, cta: 'Call 555-0100' })).toBe('hi@joes.com   ·   @joes_pizza');
  });
});
