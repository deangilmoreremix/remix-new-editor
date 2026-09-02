/**
 * Social identity normalization for Maigret discovery results.
 *
 * Converts raw Maigret platform entries into a stable SocialIdentity shape
 * that the personalizer profile/token system can consume.
 *
 * Terminology:
 *   - Maigret discovers public profile candidates; it does not prove legal
 *     identity ownership. Labels in the UI should prefer wording such as
 *     "Discovered Profile" rather than "Verified Account".
 */

// ---------------------------------------------------------------------------
// Platform normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a platform/site name to a stable lowercase slug.
 *
 * Examples:
 *   'Instagram'           -> 'instagram'
 *   'INSTAGRAM'           -> 'instagram'
 *   'X / Twitter'         -> 'twitter'
 *   'x.com'               -> 'x'
 *   'My Cool Network'     -> 'my-cool-network'
 */
export function normalizePlatformName(raw) {
  if (raw == null) return '';
  const str = String(raw).trim();
  if (!str) return '';

  // Specific aliases that should map to a canonical legacy token name.
  const aliases = {
    'x': 'twitter',
    'x.com': 'x',
    'twitter': 'twitter',
    'twitter.com': 'twitter',
  };

  // Direct alias match before collapsing.
  const direct = aliases[str.toLowerCase()];
  if (direct) return direct;

  // Lowercase and collapse whitespace/separators.
  const collapsed = str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return aliases[collapsed] || collapsed;
}

// ---------------------------------------------------------------------------
// SocialIdentity shape
// ---------------------------------------------------------------------------

/**
 * Canonical social identity record.
 *
 * Fields:
 *   - platform:     normalized platform slug (required)
 *   - username:     discovered username, when available
 *   - profileUrl:   discovered profile URL (required for persisted records)
 *   - source:       'maigret' | 'manual' | 'import'
 *   - identifiers:  bounded scalar metadata from ids_data
 *   - tags:         optional category tags
 */
export function createSocialIdentity({
  platform,
  username,
  profileUrl,
  source = 'maigret',
  identifiers = {},
  tags = [],
} = {}) {
  const normalizedPlatform = normalizePlatformName(platform);

  // Bound identifiers to a safe small set of scalar fields.
  const safeIdentifiers = {};
  if (identifiers && typeof identifiers === 'object') {
    const allowed = ['name', 'bio', 'company', 'location', 'avatar_url', 'title'];
    for (const key of allowed) {
      const value = identifiers[key];
      if (value != null && typeof value === 'string' && value.trim().length > 0) {
        safeIdentifiers[key] = value.trim().slice(0, 400);
      }
    }
  }

  // Bound tags.
  const safeTags = Array.isArray(tags)
    ? tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10)
    : [];

  return {
    platform: normalizedPlatform,
    username: username ? String(username).trim() : undefined,
    profileUrl: profileUrl ? String(profileUrl).trim() : undefined,
    source: source === 'manual' || source === 'import' ? source : 'maigret',
    identifiers: safeIdentifiers,
    tags: safeTags,
  };
}

// ---------------------------------------------------------------------------
// Normalization from raw Maigret platform entries
// ---------------------------------------------------------------------------

/**
 * Normalize a single raw Maigret platform dict into a SocialIdentity.
 *
 * Expected raw shape (from scanner.py / worker API):
 *   {
 *     platform: string,
 *     url: string,
 *     username: string,
 *     status: 'found',
 *     ids_data: { name, bio, company, location, avatar_url, ... }
 *   }
 */
export function normalizeSocialIdentity(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const platform = raw.platform || raw.site || '';
  const profileUrl = raw.url || raw.url_user || raw.profileUrl || '';
  const username = raw.username || raw.user || '';

  if (!platform && !profileUrl) return null;

  return createSocialIdentity({
    platform,
    username,
    profileUrl,
    source: 'maigret',
    identifiers: raw.ids_data || raw.ids || {},
    tags: raw.tags || [],
  });
}

/**
 * Normalize an array of raw Maigret platform entries.
 *
 * Deduplicates by profileUrl first, then by platform + username.
 */
export function normalizeSocialIdentities(platforms) {
  if (!Array.isArray(platforms)) return [];

  const seen = new Map();
  const result = [];

  for (const raw of platforms) {
    const identity = normalizeSocialIdentity(raw);
    if (!identity) continue;

    // Skip if we have no profileUrl and no username.
    if (!identity.profileUrl && !identity.username) continue;

    const dedupKey = identity.profileUrl || `${identity.platform}:${identity.username || ''}`;
    if (seen.has(dedupKey)) continue;
    seen.set(dedupKey, true);

    result.push(identity);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------------------

/**
 * Extract socialProfiles from a profile, normalizing any legacy entries.
 */
export function getSocialProfiles(profile) {
  if (!profile || typeof profile !== 'object') return [];
  const existing = profile.socialProfiles;
  if (!Array.isArray(existing)) return [];

  // Ensure every entry has at least a platform slug.
  return existing
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      if (!entry.platform) return null;
      return {
        ...entry,
        platform: normalizePlatformName(entry.platform),
      };
    })
    .filter(Boolean);
}

/**
 * Build a legacy social URL map from socialProfiles.
 *
 * Preserves backward compatibility with tokens like {{linkedin}}, {{twitter}},
 * {{github}} that read from `profile.social.<platform>`.
 */
export function buildLegacySocialMap(socialProfiles = []) {
  const map = {};
  for (const identity of socialProfiles) {
    if (!identity || !identity.platform) continue;
    const platform = normalizePlatformName(identity.platform);
    if (!platform) continue;

    // Prefer explicit profileUrl; fall back to constructing from username.
    const url = identity.profileUrl || (identity.username ? `https://${platform}.com/${identity.username}` : '');
    if (url) {
      map[platform] = url;
    }
  }
  return map;
}

/**
 * Resolve a dynamic social token from a profile.
 *
 * Supports:
 *   {{social.<platform>.username}}
 *   {{social.<platform>.url}}
 *   {{social.primary.username}}
 *   {{social.primary.url}}
 *
 * @returns {string|null}
 */
export function resolveSocialToken(profile = {}, rawToken) {
  if (!profile || !rawToken) return null;

  const socialProfiles = getSocialProfiles(profile);
  if (!socialProfiles.length) return null;

  // Primary fallback: first social identity.
  const primary = socialProfiles[0];

  // Match social.<platform>.<field>
  const match = String(rawToken).match(/^social\.([^.]+)\.([^.]+)$/);
  if (!match) return null;

  const [, platformPart, field] = match;

  // Resolve primary pseudo-platform.
  if (platformPart === 'primary') {
    if (field === 'username') return primary.username || null;
    if (field === 'url') return primary.profileUrl || null;
    return null;
  }

  const platform = normalizePlatformName(platformPart);
  const identity = socialProfiles.find((s) => normalizePlatformName(s.platform) === platform);
  if (!identity) return null;

  if (field === 'username') return identity.username || null;
  if (field === 'url') return identity.profileUrl || null;
  return null;
}
