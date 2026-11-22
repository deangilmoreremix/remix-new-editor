import { describe, it, expect } from 'vitest';
import { EMAIL_PROVIDERS, emailProviderByKey, mergeTagFor, mergeTagLink, isUnreplacedMergeTag, recipientIdTagFor, previewLink, emailSnippet, tokensWithoutDefault } from '../emailMergeLink.js';
import { profileFromQuery } from '../../publish/publishClient.js';

const BASE = 'https://watch.example/v/abc';

describe('email merge-tag links', () => {
  it('builds provider-specific tags from canonical tokens', () => {
    expect(mergeTagLink(BASE, ['firstName', 'email'], 'mailchimp', { includePrivate: true }).link)
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

describe('campaign options: privacy, recipient id, UTM, preview, snippet, fallbacks', () => {
  it('leaves email and phone out of the URL by default and says so', () => {
    const r = mergeTagLink(BASE, ['firstName', 'email', 'phone'], 'mailchimp');
    expect(r.link).toBe(`${BASE}?firstName=*|FNAME|*`);
    expect(r.excluded).toEqual(['email', 'businessPhone']); // 'phone' is an alias of businessPhone here
    expect(mergeTagLink(BASE, ['email'], 'mailchimp', { includePrivate: true }).link).toBe(`${BASE}?email=*|EMAIL|*`);
  });

  it('adds a recipient id as ?c= so views can be told apart per recipient', () => {
    const mc = emailProviderByKey('mailchimp');
    expect(recipientIdTagFor(mc)).toBe('*|UNIQID|*');
    expect(recipientIdTagFor(emailProviderByKey('klaviyo'))).toBe('');
    expect(mergeTagLink(BASE, ['firstName'], mc, { recipientId: recipientIdTagFor(mc) }).link).toBe(`${BASE}?c=*|UNIQID|*&firstName=*|FNAME|*`);
    expect(mergeTagLink(BASE, ['firstName'], 'klaviyo', { recipientId: '{{ person.id }}', preload: false }).link)
      .toBe(`${BASE}?preload=none&c={{ person.id }}&firstName={{ first_name }}`);
  });

  it('appends UTM tags with the campaign name encoded', () => {
    expect(mergeTagLink(BASE, ['firstName'], 'custom', { utmCampaign: 'Black Friday & more' }).link)
      .toBe(`${BASE}?firstName={{firstName}}&utm_source=email&utm_medium=email&utm_campaign=Black%20Friday%20%26%20more`);
  });

  it('the player ignores preload, utm_* and an unreplaced recipient-id tag', () => {
    const p = profileFromQuery('?preload=none&utm_source=email&utm_campaign=x&c=*|UNIQID|*&firstName=Ann');
    expect(p).toEqual({ variables: { firstName: 'Ann' } });
    expect(profileFromQuery('?c=abc123DEF0&firstName=Ann').id).toBe('abc123DEF0');
  });

  it('builds a preview link with sample values and no images', () => {
    const link = previewLink(BASE, ['firstName', 'company', 'logoUrl', 'painPoint']);
    expect(link).toBe(`${BASE}?firstName=Alex&company=Acme+Co&painPoint=Sample+painPoint`);
  });

  it('builds an email snippet: poster image link, or a button; escapes attributes', () => {
    const withPoster = emailSnippet({ link: `${BASE}?a=1&b=*|X|*`, posterUrl: 'https://img.example/p.png', alt: 'Hi "you"' });
    expect(withPoster).toContain('href="https://watch.example/v/abc?a=1&amp;b=*|X|*"');
    expect(withPoster).toContain('<img src="https://img.example/p.png" alt="Hi &quot;you&quot;"');
    const button = emailSnippet({ link: BASE, posterUrl: 'javascript:alert(1)' });
    expect(button).not.toContain('<img');
    expect(button).toContain('Watch your video</a>');
  });

  it('finds tokens that have no fallback', () => {
    expect(tokensWithoutDefault('Hi {{firstName}} at {{d company "your company"}} {{up title}}')).toEqual(['firstName', 'title']);
    expect(tokensWithoutDefault('')).toEqual([]);
    expect(tokensWithoutDefault('{{firstName}} {{logoUrl}}')).toEqual(['firstName']); // images have their own fallback image
  });

  it('valuesInLink:false carries only the recipient id (no personal values, no warnings about them)', () => {
    const mc = emailProviderByKey('mailchimp');
    const r = mergeTagLink(BASE, ['firstName', 'company', 'logoUrl'], mc, { recipientId: recipientIdTagFor(mc), valuesInLink: false, utmCampaign: 'x' });
    expect(r.link).toBe(`${BASE}?c=*|UNIQID|*&utm_source=email&utm_medium=email&utm_campaign=x`);
    expect(r.unmapped).toEqual([]);
    expect(r.skipped).toEqual([]);
  });
});

