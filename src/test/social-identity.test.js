import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizePlatformName,
  createSocialIdentity,
  normalizeSocialIdentity,
  normalizeSocialIdentities,
  getSocialProfiles,
  buildLegacySocialMap,
  resolveSocialToken,
} from '../lib/socialIdentity.js';

describe('normalizePlatformName', () => {
  it('lowercases simple platform names', () => {
    expect(normalizePlatformName('Instagram')).toBe('instagram');
    expect(normalizePlatformName('INSTAGRAM')).toBe('instagram');
  });

  it('collapses separators', () => {
    expect(normalizePlatformName('My Cool Network')).toBe('my-cool-network');
  });

  it('normalizes X/Twitter aliases', () => {
    expect(normalizePlatformName('X')).toBe('twitter');
    expect(normalizePlatformName('x.com')).toBe('x');
    expect(normalizePlatformName('Twitter')).toBe('twitter');
  });

  it('handles empty input', () => {
    expect(normalizePlatformName('')).toBe('');
    expect(normalizePlatformName(null)).toBe('');
    expect(normalizePlatformName(undefined)).toBe('');
  });
});

describe('createSocialIdentity', () => {
  it('creates a minimal identity', () => {
    const identity = createSocialIdentity({ platform: 'instagram', profileUrl: 'https://instagram.com/john' });
    expect(identity.platform).toBe('instagram');
    expect(identity.profileUrl).toBe('https://instagram.com/john');
    expect(identity.source).toBe('maigret');
  });

  it('defaults source to maigret', () => {
    const identity = createSocialIdentity({ platform: 'youtube', profileUrl: 'https://youtube.com/@john' });
    expect(identity.source).toBe('maigret');
  });

  it('accepts manual source', () => {
    const identity = createSocialIdentity({ platform: 'linkedin', profileUrl: 'https://linkedin.com/in/john', source: 'manual' });
    expect(identity.source).toBe('manual');
  });

  it('bounds identifiers to safe fields', () => {
    const identity = createSocialIdentity({
      platform: 'github',
      profileUrl: 'https://github.com/john',
      identifiers: { name: 'John', bio: 'Developer', huge: 'x'.repeat(500), nested: { bad: true } },
    });
    expect(identity.identifiers).toEqual({ name: 'John', bio: 'Developer' });
    expect(identity.identifiers.huge).toBeUndefined();
    expect(identity.identifiers.nested).toBeUndefined();
  });

  it('bounds tags', () => {
    const identity = createSocialIdentity({
      platform: 'tiktok',
      profileUrl: 'https://tiktok.com/@john',
      tags: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(identity.tags).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});

describe('normalizeSocialIdentity', () => {
  it('normalizes a Maigret-style platform entry', () => {
    const raw = { platform: 'Instagram', url: 'https://instagram.com/john', username: 'john', status: 'found', ids_data: { bio: 'Hello' } };
    const identity = normalizeSocialIdentity(raw);
    expect(identity).not.toBeNull();
    expect(identity.platform).toBe('instagram');
    expect(identity.profileUrl).toBe('https://instagram.com/john');
    expect(identity.username).toBe('john');
    expect(identity.source).toBe('maigret');
    expect(identity.identifiers.bio).toBe('Hello');
  });

  it('returns null for null input', () => {
    expect(normalizeSocialIdentity(null)).toBeNull();
    expect(normalizeSocialIdentity({})).toBeNull();
  });

  it('returns null when no platform or url', () => {
    expect(normalizeSocialIdentity({ platform: '', url: '' })).toBeNull();
  });

  it('handles alternate field names', () => {
    const raw = { platform: 'YouTube', url_user: 'https://youtube.com/@john', user: 'john' };
    const identity = normalizeSocialIdentity(raw);
    expect(identity).not.toBeNull();
    expect(identity.profileUrl).toBe('https://youtube.com/@john');
    expect(identity.username).toBe('john');
  });
});

describe('normalizeSocialIdentities', () => {
  it('deduplicates by profileUrl', () => {
    const platforms = [
      { platform: 'Instagram', url: 'https://instagram.com/john', username: 'john' },
      { platform: 'instagram', url: 'https://instagram.com/john', username: 'john' },
    ];
    const result = normalizeSocialIdentities(platforms);
    expect(result).toHaveLength(1);
  });

  it('deduplicates by platform+username when url is missing', () => {
    const platforms = [
      { platform: 'mastodon', username: 'john' },
      { platform: 'MASTODON', username: 'john' },
    ];
    const result = normalizeSocialIdentities(platforms);
    expect(result).toHaveLength(1);
  });

  it('keeps separate accounts on same platform', () => {
    const platforms = [
      { platform: 'instagram', url: 'https://instagram.com/john', username: 'john' },
      { platform: 'instagram', url: 'https://instagram.com/johnsmith', username: 'johnsmith' },
    ];
    const result = normalizeSocialIdentities(platforms);
    expect(result).toHaveLength(2);
  });

  it('skips entries without url or username', () => {
    const platforms = [
      { platform: 'unknown', status: 'error' },
      { platform: 'good', url: 'https://example.com/u' },
    ];
    const result = normalizeSocialIdentities(platforms);
    expect(result).toHaveLength(1);
  });
});

describe('getSocialProfiles', () => {
  it('returns empty array for null/undefined', () => {
    expect(getSocialProfiles(null)).toEqual([]);
    expect(getSocialProfiles(undefined)).toEqual([]);
  });

  it('normalizes platform slugs', () => {
    const profiles = getSocialProfiles({ socialProfiles: [{ platform: 'Instagram', username: 'john', profileUrl: 'https://instagram.com/john' }] });
    expect(profiles[0].platform).toBe('instagram');
  });
});

describe('buildLegacySocialMap', () => {
  it('builds a URL map from socialProfiles', () => {
    const map = buildLegacySocialMap([
      { platform: 'linkedin', profileUrl: 'https://linkedin.com/in/john' },
      { platform: 'twitter', profileUrl: 'https://x.com/john' },
    ]);
    expect(map.linkedin).toBe('https://linkedin.com/in/john');
    expect(map.twitter).toBe('https://x.com/john');
  });

  it('constructs URL from username when profileUrl missing', () => {
    const map = buildLegacySocialMap([{ platform: 'github', username: 'john' }]);
    expect(map.github).toBe('https://github.com/john');
  });
});

describe('resolveSocialToken', () => {
  const profile = {
    socialProfiles: [
      { platform: 'instagram', username: 'johnsmith', profileUrl: 'https://instagram.com/johnsmith' },
      { platform: 'youtube', username: 'johnsmith', profileUrl: 'https://youtube.com/@johnsmith' },
    ],
  };

  it('resolves social.<platform>.username', () => {
    expect(resolveSocialToken(profile, 'social.instagram.username')).toBe('johnsmith');
  });

  it('resolves social.<platform>.url', () => {
    expect(resolveSocialToken(profile, 'social.instagram.url')).toBe('https://instagram.com/johnsmith');
  });

  it('resolves arbitrary platforms', () => {
    expect(resolveSocialToken(profile, 'social.youtube.username')).toBe('johnsmith');
    expect(resolveSocialToken(profile, 'social.youtube.url')).toBe('https://youtube.com/@johnsmith');
  });

  it('resolves social.primary.username and .url', () => {
    expect(resolveSocialToken(profile, 'social.primary.username')).toBe('johnsmith');
    expect(resolveSocialToken(profile, 'social.primary.url')).toBe('https://instagram.com/johnsmith');
  });

  it('returns null for missing platform', () => {
    expect(resolveSocialToken(profile, 'social.tiktok.username')).toBeNull();
  });

  it('returns null for unknown field', () => {
    expect(resolveSocialToken(profile, 'social.instagram.unknown')).toBeNull();
  });

  it('returns null for null profile', () => {
    expect(resolveSocialToken(null, 'social.instagram.username')).toBeNull();
  });
});
