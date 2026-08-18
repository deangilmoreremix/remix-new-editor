import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import socialPublishing, {
  SOCIAL_PLATFORMS,
  YOUTUBE_CATEGORIES,
  getExternalUserId,
} from '../../lib/socialPublishing';

import { enhanceSocialPostText, TONALITIES } from '../../lib/socialPostEnhancer';

// ---------------------------------------------------------------------------
// SocialPublishModal
//
// Reusable publisher for generated image/video media. Drop it into any image
// or video studio and open it with:
//
//   window.openModal(SOCIAL_PUBLISH_MODAL, {
//     mediaUrl: '<public url of the generated asset>',
//     mediaType: 'image' | 'video',     // optional, inferred from URL
//     title, description, tags,          // optional prefilled metadata
//     externalUserId,                    // optional, else resolved from session
//     onPublished: ({ platform, url }) => {},
//   });
//
// It walks the user through: connect account (OAuth popup) -> pick destination
// -> fill platform fields -> publish + poll for the final post URL.
// ---------------------------------------------------------------------------

const PLATFORM_BY_ID = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.id, p]));

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  color: '#fff',
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.55)',
  margin: '14px 0 6px',
};

const sectionStyle = {
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
  background: 'rgba(255,255,255,0.02)',
};

const primaryBtn = (disabled) => ({
  background: disabled ? 'rgba(120,120,255,0.25)' : 'linear-gradient(90deg,#6d5efc,#a855f7)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '11px 18px',
  fontSize: 14,
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const ghostBtn = {
  background: 'transparent',
  color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  padding: '10px 16px',
  fontSize: 14,
  cursor: 'pointer',
};

function inferMediaType(url) {
  if (!url) return 'video';
  const u = url.split('?')[0].toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|bmp)$/.test(u)) return 'image';
  if (/\.(mp4|mov|webm|m4v|avi)$/.test(u)) return 'video';
  return 'video';
}

function statusLabel(status) {
  switch (status) {
    case 'processing':
    case 'pending':
    case 'in_progress':
      return 'Publishing to platform…';
    case 'completed':
    case 'succeeded':
      return 'Published!';
    case 'failed':
    case 'error':
      return 'Failed';
    default:
      return status ? `Status: ${status}` : 'Working…';
  }
}

const enhanceBtnStyle = (active) => ({
  flexShrink: 0,
  width: 36,
  height: 36,
  borderRadius: 9,
  border: '1px solid rgba(255,255,255,0.15)',
  background: active ? 'rgba(109,94,252,0.25)' : 'rgba(255,255,255,0.04)',
  color: '#cbbcff',
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

// Small "Enhance writing" (✨) button shown next to editable post fields.
// Calls OpenAI via enhanceSocialPostText. `active` shows a spinner.
function EnhanceButton({ active, disabled, onClick }) {
  const isDisabled = disabled || active;
  return (
    <button
      type="button"
      aria-label="Enhance writing with AI"
      title="Enhance writing with AI"
      disabled={isDisabled}
      onClick={onClick}
      style={{
        ...enhanceBtnStyle(active),
        opacity: isDisabled && !active ? 0.4 : 1,
        cursor: isDisabled && !active ? 'not-allowed' : 'pointer',
      }}
    >
      {active ? (
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            borderRadius: 99,
            animation: 'spin 0.8s linear infinite',
          }}
        />
      ) : (
        '✨'
      )}
    </button>
  );
}

const SocialPublishModal = ({ options = {}, handleClose }) => {
  const opts = options || {};
  const initialType = opts.mediaType || inferMediaType(opts.mediaUrl);

  const [externalUserId] = useState(() => getExternalUserId(opts.externalUserId));
  const [mediaUrl, setMediaUrl] = useState(opts.mediaUrl || '');
  const [mediaType, setMediaType] = useState(initialType);

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  const [connectingPlatform, setConnectingPlatform] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | connecting | publishing | success | error
  const [progress, setProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [resultUrl, setResultUrl] = useState('');

  const [enhancing, setEnhancing] = useState(null); // field currently being AI-enhanced
  const [renamingId, setRenamingId] = useState(null); // account id being renamed
  const [renameValue, setRenameValue] = useState('');
  const [toneId, setToneId] = useState(''); // selected tonality id ('' = none)

  // form fields
  const [form, setForm] = useState({
    title: opts.title || '',
    description: opts.description || '',
    tags: Array.isArray(opts.tags) ? opts.tags.join(', ') : (opts.tags || ''),
    privacy: 'public',
    category_id: '22',
    made_for_kids: false,
    privacy_level: 'PUBLIC_TO_EVERYONE',
    disable_comment: false,
    disable_duet: false,
    disable_stitch: false,
    caption: '',
    media_type: initialType === 'image' ? 'IMAGE' : 'VIDEO',
    placement: 'reels',
    share_to_feed: true,
    cover_url: '',
    thumb_offset: '',
  });

  const popupTimer = useRef(null);
  const abortRef = useRef(null);
  const redirectTo = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

  useEffect(() => {
    abortRef.current = new AbortController();
    refreshAccounts();
    return () => {
      if (popupTimer.current) clearInterval(popupTimer.current);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const list = await socialPublishing.listAccounts(externalUserId);
      setAccounts(Array.isArray(list) ? list : []);
    } catch (e) {
      setAccountsError(e.message || 'Could not load connected accounts.');
    } finally {
      setAccountsLoading(false);
    }
  }, [externalUserId]);

  const handleConnect = useCallback(async (platform) => {
    if (status === 'connecting') return;
    setStatus('connecting');
    setConnectingPlatform(platform);
    setErrorMsg(null);
    try {
      const { url } = await socialPublishing.getConnectUrl(platform, externalUserId, redirectTo);
      const popup = window.open(url, 'muapi_oauth', 'width=600,height=720');
      if (!popup) window.open(url, '_blank'); // fallback if blocked

      popupTimer.current = setInterval(async () => {
        try {
          await refreshAccounts();
        } catch {
          /* ignore transient errors while polling */
        }
        // Clear once the popup is gone. If the popup was blocked (popup is
        // null), there is nothing to watch — stop polling so we don't leak a
        // timer that refreshes accounts forever. The user can click Refresh.
        if (!popup || popup.closed) {
          clearInterval(popupTimer.current);
          popupTimer.current = null;
          if (popup && popup.closed) {
            await refreshAccounts();
          }
          setStatus('idle');
          setConnectingPlatform(null);
        }
      }, 2500);
    } catch (e) {
      setErrorMsg(e.message || 'Could not start connection.');
      setStatus('idle');
      setConnectingPlatform(null);
    }
  }, [status, externalUserId, redirectTo, refreshAccounts]);

  const handleDisconnect = useCallback(async (accountId) => {
    try {
      await socialPublishing.disconnectAccount(accountId);
      if (selectedAccountId === accountId) setSelectedAccountId(null);
      await refreshAccounts();
    } catch (e) {
      setErrorMsg(e.message || 'Could not disconnect account.');
    }
  }, [selectedAccountId, refreshAccounts]);

  // --- Account management: rename + permanent removal -------------------
  const startRename = (acc) => {
    setRenamingId(String(acc.id));
    setRenameValue(acc.account_name || '');
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const saveRename = async (accountId) => {
    try {
      await socialPublishing.renameAccount(Number(accountId), renameValue.trim());
      await refreshAccounts();
    } catch (e) {
      setErrorMsg(e.message || 'Could not rename account.');
    }
    setRenamingId(null);
  };

  const handlePermanentRemove = async (accountId) => {
    try {
      await socialPublishing.permanentDisconnect(Number(accountId));
      if (String(selectedAccountId) === String(accountId)) setSelectedAccountId(null);
      await refreshAccounts();
    } catch (e) {
      setErrorMsg(e.message || 'Could not remove account.');
    }
  };

  // --- AI enhance writing (OpenAI) --------------------------------------
  const handleEnhance = async (field) => {
    if (enhancing) return;
    const value = (form[field] || '').trim();
    if (!value) {
      setErrorMsg('Write something first, then enhance it.');
      return;
    }
    setEnhancing(field);
    setErrorMsg(null);
    try {
      const improved = await enhanceSocialPostText({
        text: value,
        field,
        platform: platformOfSelected || 'social',
        tone: toneId ? TONALITIES.find((t) => t.id === toneId) : null,
      });
      updateForm(field, improved);
    } catch (e) {
      setErrorMsg(e.message || 'Could not enhance text.');
    } finally {
      setEnhancing(null);
    }
  };

  const selectedAccount = useMemo(
    () => accounts.find((a) => String(a.id) === String(selectedAccountId)) || null,
    [accounts, selectedAccountId],
  );

  const updateForm = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const buildPayload = (platform) => {
    const base = { account_id: Number(selectedAccountId), media_url: mediaUrl };
    if (platform === 'youtube') {
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      return {
        ...base,
        title: form.title.trim(),
        description: form.description,
        tags,
        privacy: form.privacy,
        category_id: String(form.category_id),
        made_for_kids: !!form.made_for_kids,
      };
    }
    if (platform === 'tiktok') {
      return {
        ...base,
        title: form.title.trim(),
        privacy_level: form.privacy_level,
        disable_comment: !!form.disable_comment,
        disable_duet: !!form.disable_duet,
        disable_stitch: !!form.disable_stitch,
      };
    }
    // instagram
    const payload = {
      ...base,
      caption: undefined,
      // Instagram's select is authoritative (it supports both feed + Reel),
      // unlike the top-level toggle which is bound to the generated asset kind.
      media_type: form.media_type,
      placement: form.placement,
      share_to_feed: !!form.share_to_feed,
    };
    if (form.caption.trim()) payload.caption = form.caption.trim();
    if (form.cover_url.trim()) payload.cover_url = form.cover_url.trim();
    if (form.thumb_offset !== '' && Number(form.thumb_offset) >= 0) {
      payload.thumb_offset = Number(form.thumb_offset);
    }
    return payload;
  };

  const handlePublish = useCallback(async () => {
    if (!/^https?:\/\//i.test(mediaUrl)) {
      setErrorMsg('Enter a valid public http(s) media URL.');
      return;
    }
    if (!selectedAccount) {
      setErrorMsg('Select a destination account.');
      return;
    }
    const platform = selectedAccount.platform_name;
    if ((platform === 'youtube' || platform === 'tiktok') && !form.title.trim()) {
      setErrorMsg(`${PLATFORM_BY_ID[platform]?.label || platform} requires a title.`);
      return;
    }

    setStatus('publishing');
    setErrorMsg(null);
    setProgress('Submitting…');
    try {
      const result = await socialPublishing.publishAndPoll(platform, buildPayload(platform), {
        onStatus: (s) => setProgress(statusLabel(s)),
        signal: abortRef.current?.signal,
      });
      // muapi returns the post reference in different shapes per platform:
      //   YouTube  -> { output: { url } }
      //   Instagram -> { platform, media_id }
      //   TikTok    -> { platform, publish_id }
      const link =
        result?.output?.url ||
        result?.url ||
        result?.media_id ||
        result?.publish_id ||
        '';
      setResultUrl(typeof link === 'string' ? link : '');
      setStatus('success');
      if (typeof opts.onPublished === 'function') {
        opts.onPublished({ platform, url: typeof link === 'string' ? link : '', raw: result });
      }
    } catch (e) {
      setErrorMsg(e.message || 'Publishing failed.');
      setStatus('error');
    }
  }, [mediaUrl, selectedAccount, form, mediaType, opts, buildPayload]);

  const platformOfSelected = selectedAccount?.platform_name;
  const publishDisabled = status === 'publishing' || status === 'connecting' || !selectedAccount
    || !/^https?:\/\//i.test(mediaUrl);

  return (
    <div style={{ padding: '8px 8px 4px', color: '#fff', minWidth: 520 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: 'linear-gradient(135deg,#6d5efc,#a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>📡</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Publish to Social</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            Push your generated media straight to YouTube, TikTok or Instagram.
          </div>
        </div>
      </div>

      {/* Media source */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Media to publish</div>
        <input
          style={inputStyle}
          placeholder="https://…/your-generated-asset.mp4"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Type:</span>
          {['video', 'image'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMediaType(t)}
              style={{
                ...ghostBtn,
                background: mediaType === t ? 'rgba(109,94,252,0.25)' : 'transparent',
                borderColor: mediaType === t ? '#6d5efc' : 'rgba(255,255,255,0.15)',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
            Must be a public URL
          </span>
        </div>
      </div>

      {/* Accounts */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ ...labelStyle, margin: 0 }}>Connected accounts</div>
          <button type="button" style={{ ...ghostBtn, padding: '6px 12px', fontSize: 12 }} onClick={refreshAccounts}>
            ↻ Refresh
          </button>
        </div>

        {accountsLoading && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>Loading accounts…</div>}
        {accountsError && <div style={{ fontSize: 13, color: '#ff8080', marginTop: 10 }}>{accountsError}</div>}

        {!accountsLoading && accounts.length === 0 && !accountsError && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>
            No accounts connected yet — connect one below.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {accounts.map((acc) => {
            const p = PLATFORM_BY_ID[acc.platform_name] || { label: acc.platform_name, color: '#888' };
            const compatible = p.mediaKinds?.includes(mediaType);
            const checked = String(acc.id) === String(selectedAccountId);
            const isRenaming = renamingId === String(acc.id);
            return (
              <div
                key={acc.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  border: `1px solid ${checked ? '#6d5efc' : 'rgba(255,255,255,0.1)'}`,
                  background: checked ? 'rgba(109,94,252,0.12)' : 'rgba(255,255,255,0.03)',
                  opacity: compatible ? 1 : 0.45,
                }}
              >
                <input
                  type="radio"
                  name="account"
                  checked={checked}
                  disabled={!compatible || isRenaming}
                  onChange={() => setSelectedAccountId(String(acc.id))}
                />
                <span style={{
                  width: 10, height: 10, borderRadius: 99, background: p.color, display: 'inline-block',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isRenaming ? (
                    <input
                      style={{ ...inputStyle, fontSize: 13 }}
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveRename(acc.id); if (e.key === 'Escape') cancelRename(); }}
                    />
                  ) : (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{acc.account_name || p.label}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                        {p.label}{acc.platform_user_id ? ` · ${acc.platform_user_id}` : ''}
                        {!compatible ? ` · not supported for ${mediaType}` : ''}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {isRenaming ? (
                    <>
                      <button type="button" style={{ ...ghostBtn, padding: '5px 10px', fontSize: 12 }} onClick={() => saveRename(acc.id)}>Save</button>
                      <button type="button" style={{ ...ghostBtn, padding: '5px 10px', fontSize: 12 }} onClick={cancelRename}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-label="Rename account"
                        title="Rename"
                        style={{ ...ghostBtn, padding: '5px 9px', fontSize: 13 }}
                        onClick={() => startRename(acc)}
                      >✎</button>
                      <button
                        type="button"
                        style={{ ...ghostBtn, padding: '5px 10px', fontSize: 12, color: '#ff9a9a', borderColor: 'rgba(255,120,120,0.3)' }}
                        onClick={() => handleDisconnect(acc.id)}
                      >Disconnect</button>
                      <button
                        type="button"
                        aria-label="Remove account permanently"
                        title="Remove permanently"
                        style={{ ...ghostBtn, padding: '5px 9px', fontSize: 13, color: '#ff9a9a', borderColor: 'rgba(255,120,120,0.3)' }}
                        onClick={() => handlePermanentRemove(acc.id)}
                      >🗑</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ ...labelStyle }}>Connect an account</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {SOCIAL_PLATFORMS.map((p) => {
            const enabled = p.mediaKinds.includes(mediaType);
            const isConnecting = connectingPlatform === p.id && status === 'connecting';
            return (
              <button
                key={p.id}
                type="button"
                disabled={!enabled || isConnecting}
                onClick={() => handleConnect(p.id)}
                style={{
                  ...ghostBtn,
                  display: 'flex', alignItems: 'center', gap: 8,
                  opacity: enabled ? 1 : 0.4,
                  cursor: enabled && !isConnecting ? 'pointer' : 'not-allowed',
                  borderColor: enabled ? p.color : 'rgba(255,255,255,0.1)',
                }}
                title={enabled ? `Connect ${p.label}` : `${p.label} supports ${p.note}`}
              >
                <span style={{ width: 9, height: 9, borderRadius: 99, background: p.color }} />
                {isConnecting ? `Connecting ${p.label}…` : `Connect ${p.label}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Details */}
      {selectedAccount && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Post details · {PLATFORM_BY_ID[platformOfSelected]?.label || platformOfSelected}</div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>Tone:</span>
            <select
              style={{ ...inputStyle, flex: 1 }}
              value={toneId}
              onChange={(e) => setToneId(e.target.value)}
            >
              <option value="">Default (no specific tone)</option>
              {TONALITIES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}{t.premium ? ' · Premium' : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            Applied whenever you click ✨ Enhance on any field below.
          </div>

          {(platformOfSelected === 'youtube' || platformOfSelected === 'tiktok') && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder={platformOfSelected === 'youtube' ? 'Video title (max 100)' : 'Caption / title (max 150)'}
                maxLength={platformOfSelected === 'youtube' ? 100 : 150}
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
              />
              <EnhanceButton active={enhancing === 'title'} disabled={!form.title.trim()} onClick={() => handleEnhance('title')} />
            </div>
          )}

          {platformOfSelected === 'youtube' && (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
                <textarea
                  style={{ ...inputStyle, flex: 1, minHeight: 64, resize: 'vertical' }}
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                />
                <EnhanceButton active={enhancing === 'description'} disabled={!form.description.trim()} onClick={() => handleEnhance('description')} />
              </div>
              <input
                style={{ ...inputStyle, marginTop: 10 }}
                placeholder="Tags (comma separated)"
                value={form.tags}
                onChange={(e) => updateForm('tags', e.target.value)}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <select style={{ ...inputStyle, flex: 1 }} value={form.privacy} onChange={(e) => updateForm('privacy', e.target.value)}>
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
                <select style={{ ...inputStyle, flex: 1 }} value={form.category_id} onChange={(e) => updateForm('category_id', e.target.value)}>
                  {YOUTUBE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 10 }}>
                <input type="checkbox" checked={!!form.made_for_kids} onChange={(e) => updateForm('made_for_kids', e.target.checked)} />
                Made for kids (COPPA)
              </label>
            </>
          )}

          {platformOfSelected === 'tiktok' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <select style={{ ...inputStyle, flex: 1 }} value={form.privacy_level} onChange={(e) => updateForm('privacy_level', e.target.value)}>
                <option value="PUBLIC_TO_EVERYONE">Public</option>
                <option value="MUTUAL_FOLLOW_FRIENDS">Mutual followers</option>
                <option value="FOLLOWER_OF_CREATOR">Followers</option>
                <option value="SELF_ONLY">Only me</option>
              </select>
              {[
                ['disable_comment', 'Disable comments'],
                ['disable_duet', 'Disable duets'],
                ['disable_stitch', 'Disable stitches'],
              ].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={!!form[key]} onChange={(e) => updateForm(key, e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>
          )}

          {platformOfSelected === 'instagram' && (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 4 }}>
                <textarea
                  style={{ ...inputStyle, flex: 1, minHeight: 56, resize: 'vertical' }}
                  placeholder="Caption (supports #hashtags)"
                  value={form.caption}
                  onChange={(e) => updateForm('caption', e.target.value)}
                />
                <EnhanceButton active={enhancing === 'caption'} disabled={!form.caption.trim()} onClick={() => handleEnhance('caption')} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <select style={{ ...inputStyle, flex: 1 }} value={form.media_type} onChange={(e) => updateForm('media_type', e.target.value)}>
                  <option value="VIDEO">Video (Reel)</option>
                  <option value="IMAGE">Image (feed)</option>
                </select>
                <select style={{ ...inputStyle, flex: 1 }} value={form.placement} onChange={(e) => updateForm('placement', e.target.value)}>
                  <option value="reels">Reels</option>
                  <option value="stories">Stories</option>
                  <option value="timeline">Timeline</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 10 }}>
                <input type="checkbox" checked={!!form.share_to_feed} onChange={(e) => updateForm('share_to_feed', e.target.checked)} />
                Show on main feed (Reels)
              </label>
              {form.media_type === 'VIDEO' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="Cover image URL (optional)" value={form.cover_url} onChange={(e) => updateForm('cover_url', e.target.value)} />
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="Thumb offset ms (optional)" value={form.thumb_offset} onChange={(e) => updateForm('thumb_offset', e.target.value)} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Status / errors */}
      {errorMsg && (
        <div style={{ color: '#ff9a9a', fontSize: 13, margin: '0 0 12px', padding: '10px 12px', background: 'rgba(255,80,80,0.1)', borderRadius: 10 }}>
          {errorMsg}
        </div>
      )}

      {status === 'success' && (
        <div style={{ color: '#7CFFB2', fontSize: 14, margin: '0 0 12px', padding: '12px', background: 'rgba(80,255,160,0.1)', borderRadius: 10 }}>
          ✅ Published!
          {resultUrl && (
            <div style={{ marginTop: 8 }}>
              <a href={resultUrl} target="_blank" rel="noreferrer" style={{ color: '#9ad6ff', textDecoration: 'underline', wordBreak: 'break-all' }}>
                {resultUrl}
              </a>
            </div>
          )}
        </div>
      )}

      {status === 'publishing' && (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: 99, display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          {progress || 'Working…'}
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" style={ghostBtn} onClick={handleClose}>Close</button>
        {status === 'success' ? (
          <button type="button" style={primaryBtn(false)} onClick={handleClose}>Done</button>
        ) : (
          <button type="button" style={primaryBtn(publishDisabled)} disabled={publishDisabled} onClick={handlePublish}>
            {status === 'publishing' ? 'Publishing…' : 'Publish'}
          </button>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SocialPublishModal;
