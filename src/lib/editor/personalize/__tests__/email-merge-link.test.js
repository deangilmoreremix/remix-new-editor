import { describe, it, expect } from 'vitest';
import { EMAIL_PROVIDERS, emailProviderByKey, mergeTagFor, mergeTagLink, isUnreplacedMergeTag } from '../emailMergeLink.js';
import { profileFromQuery } from '../../publish/publishClient.js';

const BASE = 'https://watch.example/v/abc';

describe('email merge-tag links', () => {
  it('builds provider-specific tags from canonical tokens', () => {
    expect(mergeTagLink(BASE, ['firstName', 'email'], 'mailchimp').link)
      .toBe(`${BASE}?firstName=*|FNAME|*&email=*|EMAIL|*`);
    expect(mergeTagLink(BASE, ['firstName'], 'klaviyo').link).toBe(`${BASE}?firstName={{ first_name }}`);
    expect(mergeTagLink(BASE, ['company'], 'hubspot').link).toBe(`${BASE}?company={{contact.company}}`);
    expect(mergeTagLink(BASE, ['firstName'], 'activecampaign').link).toBe(`${BASE}?firstName=%FIRSTNAME%`);
  });

  it('accepts token aliases and de-duplicates', () => {
    const { link } = mergeTagLink(BASE, ['First Name', 'firstName'], 'mailchimp');
    expect(link).toBe(`${BASE}?firstName=*|FNAME|*`);
  });

  it('reports tokens with no built-in provider field and uses the custom-field name', () => {
    const r = mergeTagLink(BASE, ['painPoint'], 'mailchimp');
    expect(r.unmapped).toEqual(['painPoint']);
    expect(r.link).toBe(`${BASE}?painPoint=*|PAINPOINT|*`);
  });

  it('skips image tokens, adds preload=none, and keeps an existing query', () => {
    const r = mergeTagLink(`${BASE}?x=1`, ['firstName', 'logoUrl'], 'custom', { preload: false });
    expect(r.skipped).toEqual(['logoUrl']);
    expect(r.link).toBe(`${BASE}?x=1&preload=none&firstName={{firstName}}`);
  });

  it('returns the plain link when there is nothing to merge; rejects unknown providers', () => {
    expect(mergeTagLink(BASE, [], 'kit').link).toBe(BASE);
    expect(() => mergeTagLink(BASE, ['firstName'], 'nope')).toThrow();
  });

  it('every provider produces a tag for every token', () => {
    EMAIL_PROVIDERS.forEach((p) => expect(mergeTagFor(p, 'firstName').tag.length).toBeGreaterThan(2));
    expect(emailProviderByKey('kit').label).toMatch(/Kit/);
  });

  it('recognises unreplaced tags from any provider but not ordinary values', () => {
    ['*|FNAME|*', '{{ first_name }}', '%FIRSTNAME%', '%%FirstName%%', '[[FirstName]]', '{$name}', '[firstname,fallback=]']
      .forEach((t) => expect(isUnreplacedMergeTag(t)).toBe(true));
    ['Ann', '50%', 'Acme & Sons', '', null, '%']
      .forEach((t) => expect(isUnreplacedMergeTag(t)).toBe(false));
  });

  it('the player ignores unreplaced tags and keeps real values', () => {
    const p = profileFromQuery('?firstName=*|FNAME|*&company=Acme');
    expect(p.variables).toEqual({ company: 'Acme' });
    expect(profileFromQuery('?firstName=%25FIRSTNAME%25')).toBeNull();
  });
});
