import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import socialPublishing, {
  SOCIAL_PLATFORMS,
  YOUTUBE_CATEGORIES,
  getExternalUserId,
} from '../../lib/socialPublishing';

import { enhanceSocialPostText, TONALITIES } from '../../lib/socialPostEnhancer';
import openaiConfig from '../../lib/config/openaiConfig.js';
// Same palette as the "Personalize this demo" window (black, lime accent, 22px shell), so every publishing window looks like one app.
import { C } from '../../src/features/personalization/shared/personalization/guided/tokens';
// The thumbnail creator is lazy-loaded on demand (see handleCreateThumbnail) so
// the publish modal stays lightweight until the user opts into a thumbnail.
import { seedThumbnailFieldsFromSocialCopy } from '../../lib/socialPublisherThumbnail';

// ---------------------------------------------------------------------------
// SocialPublishModal  (unified: media -> thumbnail -> copy -> platform -> preview)
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
// 2026 flow: 1 Media -> 2 Thumbnail -> 3 Copy -> 4 Platform -> 5 Preview.
// Thumbnail creation reuses the existing TemplateThumbnailModal tooling
// (opened in 'panel' layout) — it is NOT removed from the 18 studio call
// sites; here we only read its `onApply({ imageUrl, revisedPrompt })` result
// into local form state so a single thumbnail step drives the live preview.
// ---------------------------------------------------------------------------

const PLATFORM_BY_ID = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.id, p]));

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 40,
  background: C.field,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.text,
  padding: '9px 11px',
  fontSize: 13,
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: C.muted,
  margin: '14px 0 6px',
};

const sectionStyle = {
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 18,
  marginBottom: 16,
  background: C.panel,
};

// Main action: the app's lime button (black text), like the Personalize window's primary button.
const primaryBtn = (disabled) => ({
  minHeight: 40,
  background: disabled ? C.panel : C.accent,
  color: disabled ? C.muted2 : C.onAccent,
  border: `1px solid ${disabled ? C.border : C.accent}`,
  borderRadius: 10,
  padding: '0 20px',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'all 160ms ease',
  opacity: disabled ? 0.6 : 1,
  pointerEvents: disabled ? 'none' : 'auto',
});

const ghostBtn = {
  background: C.panel,
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '7px 12px',
  fontSize: 11,
  fontWeight: 700,
  lineHeight: '1.2',
  cursor: 'pointer',
  transition: 'all 160ms ease',
};

// A selectable pill (media type, step tab): lime outline + soft lime fill when on, like the Personalize window's chips.
const pillStyle = (active) => ({
  minHeight: 34,
  padding: '0 14px',
  borderRadius: 999,
  border: `1px solid ${active ? C.cyanBorder : C.border}`,
  background: active ? C.cyanSoft : 'transparent',
  color: active ? C.cyan : C.muted,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
});

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

function isValidMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function recommendedAspectRatio(platform, mediaType) {
  if (mediaType === 'image') return '1:1';
  if (platform === 'tiktok') return '9:16';
  if (platform === 'youtube') return '16:9';
  if (platform === 'instagram') return '4:5';
  return '16:9';
}

// --- sub-components ----------------------------------------------------------

const enhanceBtnStyle = (active) => ({
  flexShrink: 0,
  width: 36,
  height: 36,
  borderRadius: 9,
  border: `1px solid ${active ? C.cyanBorder : C.border}`,
  background: active ? C.cyanSoft : C.panel,
  color: active ? C.cyan : C.muted,
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

// Reroll angle quick-picks: re-enhance the CURRENT field content with a fresh
// angle, so the user can keep rerolling until the copy is right.
const REROUTE_OPTIONS = [
  { label: 'Re-enhance', goal: '' },
  { label: 'Curiosity hook', goal: 'try a curiosity-driven hook opener' },
  { label: 'Emotional', goal: 'try a more emotional, feelings-driven angle' },
  { label: 'Humor', goal: 'try a light, humor-first angle' },
  { label: 'Tighter', goal: 'tighten to under 100 characters with a punchy close' },
];

const REROLl_BTN_SIZE = 28;

// Small inline dropdown that re-enhances the CURRENT field content (the text
// already in the box) with a fresh creative angle.
function RerollMenu({ field, enhancing, disabled, onReroll, currentText }) {
  const [open, setOpen] = useState(false);
  const active = enhancing === field;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        aria-label="Reroll this text with a new angle"
        title="Reroll — re-enhance current text until it's right"
        disabled={disabled || active}
        onClick={() => setOpen(!open)}
        style={{
          flexShrink: 0,
          width: REROLl_BTN_SIZE,
          height: REROLl_BTN_SIZE,
          borderRadius: 7,
          border: `1px solid ${C.border}`,
          background: C.panel,
          color: C.muted,
          fontSize: 13,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled || active ? 0.4 : 1,
        }}
      >
        {active ? '↻' : '🔁'}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            padding: '6px 8px',
            background: C.panel,
            border: `1px solid ${C.borderStrong}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minWidth: 150,
          }}
        >
          {REROUTE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              disabled={disabled || active}
              onClick={() => {
                setOpen(false);
                onReroll(field, opt.goal, currentText);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: C.text,
                fontSize: 12,
                padding: '4px 6px',
                borderRadius: 5,
                cursor: 'pointer',
                textAlign: 'right',
              }}
            >
              {opt.label}
            </button>
          ))}
          <span
            style={{
              color: C.muted2,
              fontSize: 10,
              padding: '2px 4px',
              opacity: currentText ? 1 : 0.55,
            }}
            title={currentText ? '' : 'Write or enhance text first to reroll'}
          >
            {currentText ? 'Rerolls the current text in this field' : 'No text yet — enhance first'}
          </span>
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { key: 'media', label: 'Media' },
  { key: 'thumbnail', label: 'Thumbnail' },
  { key: 'copy', label: 'Copy' },
  { key: 'platform', label: 'Platform' },
  { key: 'preview', label: 'Preview' },
];

function StepBar({ activeStep, completedSteps, onStep }) {
  return (
    <div role="tablist" aria-label="Publishing steps" style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
      {STEPS.map((s, i) => {
        const done = completedSteps.has(s.key);
        const active = activeStep === s.key;
        return (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onStep(s.key)}
            disabled={s.key === 'preview'}
            style={{
              ...pillStyle(active),
              flex: '1 1 110px',
              minHeight: 38,
              textTransform: 'uppercase',
              letterSpacing: '.04em',
              color: active ? C.cyan : done ? C.text : C.muted,
              cursor: s.key === 'preview' ? 'default' : 'pointer',
              opacity: s.key === 'preview' ? 0.6 : 1,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, marginRight: 8, fontSize: 10, borderRadius: 999, background: active ? C.cyanSoft : done ? 'rgba(34,197,94,.18)' : C.panelSoft, color: done && !active ? C.green : 'inherit' }}>
              {done ? '✓' : i + 1}
            </span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// --- Thumbnail step ----------------------------------------------------------

function ThumbnailZone({
  form,
  updateForm,
  selectedAccount,
  mediaType,
  onOpenThumbnail,
}) {
  const thumb = form.thumbnail;
  const platform = selectedAccount?.platform_name;
  const ar = thumb?.aspectRatio || recommendedAspectRatio(platform, mediaType);
  const hasThumb = !!(thumb && thumb.imageUrl);

  return (
    <div style={sectionStyle}>
      <div style={{ ...labelStyle, margin: '0 0 10px' }}>Thumbnail</div>
      {hasThumb ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 96, height: 96, borderRadius: 8, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0,
            background: 'rgba(0,0,0,0.3)',
          }}
          >
            {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
            <img src={thumb.imageUrl + '?v=' + Date.now()} alt="Selected thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <button type="button" style={{ ...ghostBtn, marginBottom: 6 }} onClick={onOpenThumbnail}>
              Change thumbnail
            </button>
            <button type="button" className="btn-danger-ghost" style={{ marginLeft: 8 }} onClick={() => updateForm('thumbnail', null)}>
              Remove
            </button>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Aspect ratio: {ar}</div>
            {thumb?.revisedPrompt && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, wordBreak: 'break-word' }}>
                Prompt: {thumb.revisedPrompt.slice(0, 120)}{thumb.revisedPrompt.length > 120 && '…'}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
            Add a thumbnail image to make your post pop. Recommended aspect ratio for the selected destination: <strong>{ar}</strong>.
          </div>
          <button type="button" style={primaryBtn(false)} onClick={onOpenThumbnail}>
            🎨 Create thumbnail
          </button>
        </div>
      )}
      {/* Inline thumbnail tools are intentionally NOT embedded here; the existing
          TemplateThumbnailModal (opened in panel layout) is reused so every
          studio's thumbnail generation/export pipeline stays in one place. */}
    </div>
  );
}

// --- Device preview (step 5) -------------------------------------------------

// Simple platform chrome frames. Each renders the chosen thumbnail as the post
// media plus a headline line + caption chrome. Lightweight & reactive.
function DevicePreview({ platform, mediaUrl, form, thumbnail }) {
  const img = thumbnail?.imageUrl || mediaUrl;
  const headline = (form.title || form.caption || '').split('\n')[0].slice(0, 60) || 'Your headline';
  const caption = (platform === 'youtube' ? form.description : form.caption) || '';

  if (!img) {
    return (
      <div style={{ ...sectionStyle, textAlign: 'center', padding: '28px 16px' }}>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>📡 No media or thumbnail yet — it'll render here.</div>
      </div>
    );
  }

  if (platform === 'instagram' || platform === 'tiktok') {
    // portrait phone
    const w = 178, h = 370;
    return (
      <div style={{ display: 'inline-flex', justifyContent: 'center' }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" rx="34" fill={platform === 'tiktok' ? '#000' : '#1a1a1a'} stroke="#444" strokeWidth="1" />
          <foreignObject x="6" y="6" width={w - 12} height={h - 12} overflow="visible">
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%', position: 'relative' }}>
              <img src={img} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 26, display: 'block' }} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent,rgba(0,0,0,0.7))',
                color: '#fff', padding: '10px 8px 6px', fontSize: 10, lineHeight: 1.3,
              }}>
                <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>{headline}</div>
                <div style={{ opacity: 0.9 }}>{caption.slice(0, 80)}{caption.length > 80 && '…'}</div>
                <div style={{ marginTop: 2, opacity: 0.8 }}>❤️ 1.2K · 💬 84</div>
              </div>
            </div>
          </foreignObject>
        </svg>
      </div>
    );
  }

  // landscape: YouTube / LinkedIn / X
  const w = 360, h = 200;
  return (
    <div style={{ display: 'inline-flex', justifyContent: 'center' }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" rx="14" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
        <foreignObject x="4" y="4" width={w - 8} height={h - 8} overflow="visible">
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%', position: 'relative' }}>
            <img src={img} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12, display: 'block' }} />
            {platform === 'youtube' && (
              <div style={{
                position: 'absolute', top: 6, left: 6, right: 6,
                display: 'flex', gap: 6, alignItems: 'center', color: '#fff', fontSize: 10, background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '4px 8px',
              }}>
                <span style={{ color: '#ff0000', fontWeight: 700 }}>▶</span> your-video-title
              </div>
            )}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent,rgba(0,0,0,0.8))',
              color: '#fff', padding: '8px 8px 6px', fontSize: 10, lineHeight: 1.3,
            }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>{headline}</div>
              <div style={{ opacity: 0.9 }}>{caption.slice(0, 80)}{caption.length > 80 && '…'} ❤️ 1.2K</div>
            </div>
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}

// --- main component ----------------------------------------------------------

const SocialPublishModal = ({ options = {}, handleClose }) => {
  const opts = options || {};
  const initialType = opts.mediaType || inferMediaType(opts.mediaUrl);
  const initialThumb = seedThumbnailFieldsFromSocialCopy({
    postText: opts.title,
    caption: opts.description,
    platforms: [],
    postType: initialType,
  });

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
  const [selectedModel, setSelectedModel] = useState(() => openaiConfig?.getResponsesModel?.() || 'gpt-4.1-mini');
  const [lastResponseIds, setLastResponseIds] = useState({}); // field -> responseId
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
    thumbnail: null,
  });

  const [activeStep, setActiveStep] = useState('media');
  const [draftSaved, setDraftSaved] = useState(false);

  const popupTimer = useRef(null);
  const abortRef = useRef(null);
  const redirectTo = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

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

  useEffect(() => {
    abortRef.current = new AbortController();
    refreshAccounts();
    return () => {
      if (popupTimer.current) clearInterval(popupTimer.current);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = useCallback(async (platform) => {
    if (status === 'connecting') return;
    setStatus('connecting');
    setConnectingPlatform(platform);
    setErrorMsg(null);
    try {
      const { url } = await socialPublishing.getConnectUrl(platform, externalUserId, redirectTo);
      const popup = window.open(url, 'muapi_oauth', 'width=600,height=720');
      const fallbackTab = !popup ? window.open(url, '_blank') : null;

      const onFocus = async () => {
        try {
          await refreshAccounts();
        } catch {
          /* ignore transient errors while refreshing */
        }
      };

      const stop = () => {
        if (popupTimer.current) {
          clearInterval(popupTimer.current);
          popupTimer.current = null;
        }
        window.removeEventListener('focus', onFocus);
        setStatus('idle');
        setConnectingPlatform(null);
      };

      if (popup) {
        window.addEventListener('focus', onFocus);
        popupTimer.current = setInterval(async () => {
          try {
            await refreshAccounts();
          } catch {
            /* ignore transient errors while polling */
          }
          if (popup.closed) {
            await refreshAccounts();
            stop();
          }
        }, 2500);
      } else if (fallbackTab) {
        // Popup was blocked: poll on a timer and refresh when the user returns
        // to the app tab so the new connected account appears without a manual
        // refresh.
        window.addEventListener('focus', onFocus);
        popupTimer.current = setInterval(async () => {
          try {
            await refreshAccounts();
          } catch {
            /* ignore transient errors while polling */
          }
        }, 2500);
      } else {
        // Both popup and fallback failed (e.g. browser blocked both).
        setErrorMsg('Could not open the connection page. Please allow popups and try again.');
        setStatus('idle');
        setConnectingPlatform(null);
      }
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

  // --- Account management: rename + permanent removal -----------------------
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

  // --- AI enhance writing (OpenAI) -------------------------------------------
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
      const { text: improved, responseId } = await enhanceSocialPostText({
        text: value,
        field,
        platform: platformOfSelected || 'social',
        tone: toneId ? TONALITIES.find((t) => t.id === toneId) : null,
        model: selectedModel,
      });
      updateForm(field, improved);
      if (responseId) setLastResponseIds((prev) => ({ ...prev, [field]: responseId }));
      setDraftSaved(false);
    } catch (e) {
      setErrorMsg(e.message || 'Could not enhance text.');
    } finally {
      setEnhancing(null);
    }
  };

  // Re-enhance the CURRENT field content (the text already in the box) with a
  // fresh angle/goal, so the user can keep rerolling until the copy is right.
  const handleReroll = async (field, goal, currentText) => {
    if (enhancing) return;
    const value = (currentText || form[field] || '').trim();
    if (!value) {
      setErrorMsg('Write something first, then enhance it.');
      return;
    }
    setEnhancing(field);
    setErrorMsg(null);
    try {
      const { text: improved, responseId } = await enhanceSocialPostText({
        text: value,
        field,
        platform: platformOfSelected || 'social',
        tone: toneId ? TONALITIES.find((t) => t.id === toneId) : null,
        model: selectedModel,
        previousResponseId: lastResponseIds[field] || undefined,
        goal,
      });
      updateForm(field, improved);
      if (responseId) setLastResponseIds((prev) => ({ ...prev, [field]: responseId }));
      setDraftSaved(false);
    } catch (e) {
      setErrorMsg(e.message || 'Could not enhance text.');
    } finally {
      setEnhancing(null);
    }
  };

  // --- Thumbnail creation (reuses TemplateThumbnailModal tooling) ------------
  // Lazy-load the thumbnail studio on demand so the publish modal bundle stays
  // light. The thumbnail module is opened in 'panel' layout; its onApply writes
  // the chosen { imageUrl, revisedPrompt } back into form.thumbnail.
  const handleCreateThumbnail = async () => {
    try {
      const platform = platformOfSelected;
      const seeded = seedThumbnailFieldsFromSocialCopy({
        postText: form.title,
        caption: form.caption || form.description,
        platforms: platform ? [platform] : [],
        postType: mediaType === 'image' ? 'image' : 'video',
      });
      const existing = form.thumbnail || seeded;
      const { default: TemplateThumbnailModal, mountThumbnailModal } = await import('../../src/components/modals/TemplateThumbnailModal');
      const modal = new TemplateThumbnailModal({
        layout: 'panel',
        aspectRatio: existing.aspectRatio,
        onApply: ({ imageUrl, revisedPrompt }) => {
          updateForm('thumbnail', {
            imageUrl,
            revisedPrompt: revisedPrompt || '',
            aspectRatio: existing.aspectRatio,
          });
          setDraftSaved(false);
        },
        onClear: () => updateForm('thumbnail', null),
      });
      mountThumbnailModal(modal);
      modal.open();
    } catch (e) {
      setErrorMsg(e.message || 'Could not open thumbnail creator.');
    }
  };

  const selectedAccount = useMemo(
    () => accounts.find((a) => String(a.id) === String(selectedAccountId)) || null,
    [accounts, selectedAccountId],
  );

  // Hoisted above buildPayload / handlePublish / handleCreateThumbnail so the
  // render-time usages (useMemo factory + useCallback deps) don't hit TDZ.
  const platformOfSelected = selectedAccount?.platform_name;
  const publishDisabled =
    status === 'publishing' || status === 'connecting' || !selectedAccount
    || !isValidMediaUrl(mediaUrl);

  const updateForm = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const buildPayload = useMemo(() => {
    const platform = platformOfSelected;
    return (platform) => {
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
      const payload = {
        ...base,
        caption: undefined,
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
  }, [selectedAccountId, mediaUrl, form, platformOfSelected]);

  const handlePublish = useCallback(async () => {
    if (!isValidMediaUrl(mediaUrl)) {
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
    if (platform === 'instagram' && !form.thumbnail?.imageUrl) {
      setErrorMsg('Add a thumbnail to make your post pop (your media preview still works without one).');
      return;
    }

    setStatus('publishing');
    setErrorMsg(null);
    setProgress('Submitting…');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await socialPublishing.publishAndPoll(platform, buildPayload(platform), {
        onStatus: (s) => setProgress(statusLabel(s)),
        signal: controller.signal,
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
  }, [mediaUrl, selectedAccount, form, opts, buildPayload]);

  // --- draft / preview helpers ----------------------------------------------
  const handleSaveDraft = () => {
    try {
      const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
      const draft = {
        v: 1,
        mediaUrl,
        mediaType,
        form,
        selectedAccountId,
        toneId,
        savedAt: Date.now(),
        expiresAt: Date.now() + DRAFT_TTL_MS,
      };
      localStorage.setItem('socialPublishDraft', JSON.stringify(draft));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 1600);
    } catch {
      setErrorMsg('Could not save draft locally.');
    }
  };

  const completedSteps = useMemo(() => {
    const set = new Set();
    if (mediaUrl) set.add('media');
    if (form.thumbnail?.imageUrl) set.add('thumbnail');
    if (selectedAccount && (form.title || form.caption)) set.add('copy');
    if (selectedAccount) set.add('platform');
    return set;
  }, [mediaUrl, form.thumbnail, selectedAccount, form.title, form.caption]);

  const canPreview = !!selectedAccount && isValidMediaUrl(mediaUrl);

  // Keyboard shortcuts (2026 micro-interactions):
  //   Space           → reroll current field
  //   Ctrl/Cmd+Enter  → publish
  //   Ctrl/Cmd+G      → open thumbnail creator
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === ' ' && !mod) {
        const rerollable = ['caption', 'title', 'description'].find((f) => (form[f] || '').trim());
        if (rerollable && !enhancing) {
          e.preventDefault();
          handleReroll(rerollable, '', form[rerollable]);
        }
      }
      if (e.key === 'Enter' && mod && !publishDisabled) {
        e.preventDefault();
        handlePublish();
      }
      if ((e.key === 'g' || e.key === 'G') && mod && selectedAccount) {
        e.preventDefault();
        handleCreateThumbnail();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, enhancing, publishDisabled, selectedAccount]);

  // --- render ---------------------------------------------------------------

  return (
    <div style={{ color: C.text, minWidth: 0, position: 'relative' }} role="group" aria-labelledby="social-publish-title">
      {/* Header: icon tile, title, one line of help, close (same shape as the Personalize window's header) */}
      <header style={{
        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '22px 28px',
        position: 'sticky', top: 0, zIndex: 5, background: C.modal, borderBottom: `1px solid ${C.border}`,
      }}
      >
        <div style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: C.cyanSoft, color: C.cyan, fontSize: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        >↗</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 id="social-publish-title" style={{ margin: 0, fontSize: 19, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-.01em', color: C.text }}>Publish to Social</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.5, color: C.muted }}>
            Choose the video, write the caption, pick where it goes. Nothing is posted until you press Publish.
          </p>
        </div>
        {draftSaved && <div style={{ fontSize: 11, color: C.green, alignSelf: 'center' }}>✓ Draft saved</div>}
        <button type="button" aria-label="Close" onClick={handleClose} style={{ ...ghostBtn, width: 34, height: 34, padding: 0, fontSize: 16, borderRadius: 10, flexShrink: 0 }}>✕</button>
      </header>

      <div style={{ padding: '20px 28px 4px' }}>
      <StepBar activeStep={activeStep} completedSteps={completedSteps} onStep={(k) => k !== 'preview' && setActiveStep(k)} />

      {/* Step 1: Media */}
      {activeStep === 'media' && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Media to publish</div>
          <input
            style={inputStyle}
            placeholder="https://…/your-generated-asset.mp4"
            value={mediaUrl}
            onChange={(e) => { setMediaUrl(e.target.value); setDraftSaved(false); }}
            onBlur={() => setDraftSaved(false)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Type:</span>
            {['video', 'image'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMediaType(t)}
                style={{ ...pillStyle(mediaType === t), textTransform: 'capitalize' }}
              >
                {t}
              </button>
            ))}
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
              Must be a public URL
            </span>
          </div>
        </div>
      )}

      {/* Step 2: Thumbnail */}
      {activeStep === 'thumbnail' && (
        <ThumbnailZone
          form={form}
          updateForm={updateForm}
          selectedAccount={selectedAccount}
          mediaType={mediaType}
          onOpenThumbnail={handleCreateThumbnail}
        />
      )}

      {/* Step 3: Copy — always render so the post-writing fields (title/caption,
          Enhance + Reroll, Tone) are visible even before an account is connected */}
      {activeStep === 'copy' && (
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
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>Model:</span>
            <select
              style={{ ...inputStyle, flex: 1 }}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {(openaiConfig?.defaultConfig?.supportedResponsesModels || []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            Applied whenever you click ✨ Enhance on any field below.
          </div>

          {(platformOfSelected === 'youtube' || platformOfSelected === 'tiktok' || !platformOfSelected) && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder={platformOfSelected === 'youtube' ? 'Video title (max 100)' : 'Caption / title (max 150)'}
                maxLength={platformOfSelected === 'youtube' ? 100 : 150}
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
              />
              <EnhanceButton active={enhancing === 'title'} disabled={!form.title.trim()} onClick={() => handleEnhance('title')} />
              <RerollMenu field="title" enhancing={enhancing} disabled={!form.title.trim()} onReroll={handleReroll} currentText={form.title} />
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
                <RerollMenu field="description" enhancing={enhancing} disabled={!form.description.trim()} onReroll={handleReroll} currentText={form.description} />
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
                <RerollMenu field="caption" enhancing={enhancing} disabled={!form.caption.trim()} onReroll={handleReroll} currentText={form.caption} />
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

      {/* Step 4: Platform (accounts) */}
      {activeStep === 'platform' && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ ...labelStyle, margin: 0 }}>Connected accounts</div>
            <button type="button" style={{ ...ghostBtn }} onClick={refreshAccounts}>
              ↻ Refresh
            </button>
          </div>

          {accountsLoading && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>Loading accounts…</div>}
          {accountsError && <div style={{ fontSize: 13, color: '#fca5a5', marginTop: 10 }}>{accountsError}</div>}

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
                    border: `1px solid ${checked ? C.cyanBorder : C.border}`,
                    background: checked ? C.cyanSoft : C.panelSoft,
                    opacity: compatible ? 1 : 0.45,
                  }}
                >
                  <input
                    type="radio"
                    name="account"
                    style={{ accentColor: C.accent }}
                    checked={checked}
                    disabled={!compatible || isRenaming}
                    onChange={() => setSelectedAccountId(String(acc.id))}
                  />
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: p.color, display: 'inline-block' }} />
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
                        <button type="button" style={{ ...ghostBtn }} onClick={() => saveRename(acc.id)}>Save</button>
                        <button type="button" style={{ ...ghostBtn }} onClick={cancelRename}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label="Rename account"
                          title="Rename"
                          style={{ ...ghostBtn }}
                          onClick={() => startRename(acc)}
                        >✎</button>
                        <button
                          type="button"
                          style={{ ...ghostBtn, color: '#fca5a5', borderColor: 'rgba(239,68,68,0.35)' }}
                            onClick={() => handleDisconnect(acc.id)}
                        >Disconnect</button>
                        <button
                          type="button"
                          aria-label="Remove account permanently"
                          title="Remove permanently"
                          style={{ ...ghostBtn, color: '#fca5a5', borderColor: 'rgba(239,68,68,0.35)' }}
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
      )}

      {/* Step 5: Preview */}
      {activeStep === 'preview' && (
        <div style={sectionStyle}>
          <div style={{ ...labelStyle, margin: '0 0 10px' }}>Live preview</div>
          {!canPreview && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
              Connect an account and enter a media URL to see the preview.
            </div>
          )}
          {canPreview && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}>
              <DevicePreview
                platform={platformOfSelected}
                mediaUrl={mediaUrl}
                form={form}
                thumbnail={form.thumbnail}
              />
            </div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 12, textAlign: 'center' }}>
            This preview simulates how your post will render. Actual placement may vary by platform.
          </div>
        </div>
      )}

      {/* Status / errors */}
      {errorMsg && (
        <div role="alert" style={{ color: '#fca5a5', fontSize: 13, margin: '0 0 12px', padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10 }}>
          {errorMsg}
        </div>
      )}

      {status === 'success' && (
        <div role="status" style={{ color: C.green, fontSize: 14, margin: '0 0 12px', padding: '12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 10 }}>
          ✅ Published!
          {resultUrl && (
            <div style={{ marginTop: 8 }}>
              <a href={resultUrl} target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: 'underline', wordBreak: 'break-all' }}>
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

      </div>

      {/* Footer actions: secondary buttons, then the lime Publish button */}
      <div style={{
        display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginTop: 8, padding: '14px 28px',
        borderTop: `1px solid ${C.border}`, position: 'sticky', bottom: 0, background: C.modal, zIndex: 5,
      }}
      >
        <button type="button" style={{ ...ghostBtn, minHeight: 40, padding: '0 16px' }} onClick={handleSaveDraft}>Save draft (⌘S)</button>
        <button type="button" style={{ ...ghostBtn, minHeight: 40, padding: '0 16px', opacity: canPreview ? 1 : 0.5 }} disabled={!canPreview} onClick={() => setActiveStep('preview')}>Preview</button>
        <button type="button" style={{ ...ghostBtn, minHeight: 40, padding: '0 16px' }} onClick={handleClose}>Close</button>
        {status === 'success' ? (
          <button type="button" style={primaryBtn(false)} onClick={handleClose}>Done</button>
        ) : (
          <button type="button" style={primaryBtn(publishDisabled)} disabled={publishDisabled} onClick={handlePublish}>
            {status === 'publishing' ? 'Publishing…' : 'Publish (⌘Enter)'}
          </button>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SocialPublishModal;
