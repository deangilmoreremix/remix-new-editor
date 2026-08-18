import { muapi } from './muapi';

// ---------------------------------------------------------------------------
// Social Publishing service
//
// Thin wrapper around the muapi "Publishing to your users' accounts" flow
// (https://muapi.ai/docs/social-publishing). Everything is routed through the
// existing Supabase `muapi-proxy` edge function (which attaches the server's
// MUAPI_API_KEY), so the browser never sees a muapi key.
//
// Flow:
//   1. getConnectUrl(platform, externalUserId, redirectTo) -> OAuth popup URL
//   2. listAccounts(externalUserId)                        -> connected accounts
//   3. publish(platform, payload)                          -> { request_id }
//   4. getResult(requestId) / publishAndPoll(...)          -> final post URL
//
// `external_user_id` is OUR identifier for the end user (e.g. the Clerk user
// id). muapi stores the OAuth token against it; we look accounts up by it.
// ---------------------------------------------------------------------------

export const SOCIAL_PLATFORMS = [
  {
    id: 'youtube',
    label: 'YouTube',
    mediaKinds: ['video'],
    color: '#FF0000',
    note: 'Video only',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    mediaKinds: ['video'],
    color: '#00F2EA',
    note: 'Video only',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    mediaKinds: ['image', 'video'],
    color: '#E1306C',
    note: 'Image (feed) or video (Reel)',
  },
];

export const YOUTUBE_CATEGORIES = [
  { id: '1', label: 'Film & Animation' },
  { id: '2', label: 'Autos & Vehicles' },
  { id: '10', label: 'Music' },
  { id: '15', label: 'Pets & Animals' },
  { id: '17', label: 'Sports' },
  { id: '19', label: 'Travel & Events' },
  { id: '20', label: 'Gaming' },
  { id: '22', label: 'People & Blogs' },
  { id: '23', label: 'Comedy' },
  { id: '24', label: 'Entertainment' },
  { id: '25', label: 'News & Politics' },
  { id: '26', label: 'Howto & Style' },
  { id: '27', label: 'Education' },
  { id: '28', label: 'Science & Technology' },
  { id: '29', label: 'Nonprofits & Activism' },
];

// --- external user id resolution ------------------------------------------
let _externalUserId = null;

export function setExternalUserId(id) {
  _externalUserId = id || null;
}

export function getExternalUserId(override) {
  if (override) return override;
  if (_externalUserId) return _externalUserId;
  if (typeof window !== 'undefined') {
    if (window.__muapiExternalUserId) return window.__muapiExternalUserId;
    try {
      const stored = window.localStorage.getItem('social_publishing_uid');
      if (stored) return stored;
      const anon = `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      window.localStorage.setItem('social_publishing_uid', anon);
      return anon;
    } catch {
      /* localStorage may be unavailable */
    }
  }
  return 'default_user';
}

// --- low level proxy calls -------------------------------------------------
function getConnectUrl(platform, externalUserId, redirectTo) {
  return muapi.proxyJson(`social/${platform}/connect-url`, {
    method: 'POST',
    params: { external_user_id: externalUserId, redirect_to: redirectTo },
    generationType: 'social',
  });
}

function listAccounts(externalUserId) {
  return muapi.proxyJson(
    `social/ext/accounts?external_user_id=${encodeURIComponent(externalUserId)}`,
    { method: 'GET', generationType: 'list' },
  );
}

function disconnectAccount(accountId) {
  return muapi.proxyJson(`social/ext/accounts/${accountId}/disconnect`, {
    method: 'POST',
    generationType: 'social',
  });
}

// Rename a connected account (PATCH social/ext/accounts/{id} with {account_name}).
function renameAccount(accountId, accountName) {
  return muapi.proxyJson(`social/ext/accounts/${accountId}`, {
    params: { account_name: accountName },
    generationType: 'social',
    apiMethod: 'PATCH',
  });
}

// Permanently remove a connected account (DELETE social/ext/accounts/{id}).
// Unlike the reversible disconnect, this fully removes the account and revokes
// access on the platform side.
function permanentDisconnect(accountId) {
  return muapi.proxyJson(`social/ext/accounts/${accountId}`, {
    params: {},
    generationType: 'social',
    apiMethod: 'DELETE',
  });
}

function publish(platform, payload, signal) {
  return muapi.proxyJson(
    `${platform}-publish`,
    {
      method: 'POST',
      params: payload,
      generationType: 'social',
    },
    signal,
  );
}

function getResult(requestId, signal) {
  return muapi.proxyJson(
    `predictions/${requestId}/result`,
    {
      method: 'GET',
      generationType: 'poll',
    },
    signal,
  );
}

// --- high level helpers ----------------------------------------------------
async function publishAndPoll(platform, payload, { onStatus, signal, intervalMs = 2000, maxAttempts = 90 } = {}) {
  const submit = await publish(platform, payload, signal);
  const requestId = submit?.request_id || submit?.id;
  if (!requestId) {
    throw new Error('Publish did not return a request_id');
  }

  let attempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) throw new Error('Request cancelled by user');
    // First poll slightly sooner so quick publishes feel responsive.
    await new Promise((r) => setTimeout(r, attempts === 0 ? 800 : intervalMs));
    const res = await getResult(requestId, signal);
    const status = res?.status;
    if (onStatus) onStatus(status, res);

    if (status === 'completed' || status === 'succeeded') return res;
    if (status === 'failed' || status === 'error') {
      throw new Error(res?.error || res?.message || 'Publishing failed on the platform.');
    }
    attempts += 1;
    if (attempts >= maxAttempts) {
      throw new Error('Publishing is taking longer than expected. Check the platform shortly.');
    }
  }
}

const socialPublishing = {
  SOCIAL_PLATFORMS,
  YOUTUBE_CATEGORIES,
  setExternalUserId,
  getExternalUserId,
  getConnectUrl,
  listAccounts,
  disconnectAccount,
  renameAccount,
  permanentDisconnect,
  publish,
  getResult,
  publishAndPoll,
};

export default socialPublishing;
