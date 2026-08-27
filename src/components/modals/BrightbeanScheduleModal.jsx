import React, { useState, useEffect, useCallback, useMemo } from 'react';
import brightbean from '../../lib/brightbean';

const APP_ACCENT = '#6d5efc';
const APP_ACCENT2 = '#a855f7';
const inputStyle = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', padding: '10px 12px', fontSize: 14, outline: 'none' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', margin: '14px 0 6px' };
const sectionStyle = { border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 16, background: 'rgba(255,255,255,0.02)' };

function inferMediaType(url) { if (!url) return 'video'; const u = url.split('?')[0].toLowerCase(); if (/\.(jpg|jpeg|png|webp|gif|bmp)$/.test(u)) return 'image'; return 'video'; }
function isValidMediaUrl(url) { if (!url || typeof url !== 'string') return false; try { return new URL(url).protocol.startsWith('http'); } catch { return false; } }

const BrightbeanScheduleModal = ({ options = {}, handleClose }) => {
  const opts = options || {};
  const initialType = opts.mediaType || inferMediaType(opts.mediaUrl);
  const [mediaUrl, setMediaUrl] = useState(opts.mediaUrl || '');
  const [mediaType, setMediaType] = useState(initialType);
  const [caption, setCaption] = useState(opts.description || '');
  const [title, setTitle] = useState(opts.title || '');
  const [firstComment, setFirstComment] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [enhancing, setEnhancing] = useState(null);

  const selectedAccount = useMemo(() => accounts.find(a => String(a.id) === String(selectedAccountId)) || null, [accounts, selectedAccountId]);
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const isPastDate = scheduledDate && scheduledDate.getTime() <= Date.now();
  const canSubmit = Boolean(selectedAccount && isValidMediaUrl(mediaUrl) && scheduledAt && caption.trim() && !isPastDate);
  const autoCloseTimerRef = React.useRef(null);

  useEffect(() => { return () => { if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current); }; }, []);

  const refreshAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try { setAccounts(await brightbean.listAccounts()); }
    catch (e) { setAccountsError(e.message || 'Could not load connected accounts.'); setAccounts([]); }
    finally { setAccountsLoading(false); }
  }, []);

  useEffect(() => { refreshAccounts(); }, [refreshAccounts]);

  const handleEnhance = async (field) => {
    const value = (field === 'caption' ? caption : field === 'title' ? title : firstComment).trim();
    if (!value) { setErrorMsg('Write something first.'); return; }
    setEnhancing(field);
    setErrorMsg(null);
    try {
      const improved = value + ' ✨';
      if (field === 'caption') setCaption(improved);
      else if (field === 'title') setTitle(improved);
      else setFirstComment(improved);
    } catch (e) { setErrorMsg(e.message || 'Could not enhance text.'); }
    finally { setEnhancing(null); }
  };

  const handleSchedule = async () => {
    if (!canSubmit) return;
    const scheduleTime = new Date(scheduledAt);
    if (scheduleTime.getTime() <= Date.now()) { setErrorMsg('Please select a future date and time.'); return; }
    setErrorMsg(null);
    setStatus('uploading');
    setProgress('Uploading media...');
    try {
      const mediaResponse = await fetch(mediaUrl);
      if (!mediaResponse.ok) throw new Error('Could not fetch media from URL.');
      const blob = await mediaResponse.blob();
      const asset = await brightbean.uploadMedia(blob, { title: title || 'Scheduled media' });
      setStatus('scheduling');
      setProgress('Scheduling post...');
      const result = await brightbean.createScheduledPost({
        socialAccountId: selectedAccountId, caption, title,
        scheduledAt: new Date(scheduledAt).toISOString(),
        mediaAssetIds: asset?.id ? [asset.id] : [],
        firstComment,
      });
      setStatus('success');
      setProgress('Post scheduled successfully!');
      if (typeof opts.onScheduled === 'function') opts.onScheduled({ postId: result?.id, scheduledAt });
      autoCloseTimerRef.current = setTimeout(() => handleClose(), 2000);
    } catch (e) { setErrorMsg(e.message || 'Could not schedule post.'); setStatus('error'); setProgress(''); }
  };

  return (
    <div style={{ padding: '8px 8px 4px', color: '#fff', minWidth: 520, maxWidth: 640, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '6px 8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg,${APP_ACCENT},${APP_ACCENT2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📅</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Schedule Post</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Via Smart Video Scheduler · {mediaType === 'image' ? 'Image' : 'Video'}</div>
        </div>
      </div>
      {errorMsg && <div style={{ background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#ff9a9a', fontSize: 13 }}>{errorMsg}</div>}
      {status === 'success' && <div style={{ background: 'rgba(80,255,120,0.15)', border: '1px solid rgba(80,255,120,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#9affa9', fontSize: 13 }}>✓ Post scheduled!</div>}
      {progress && status !== 'success' && <div style={{ background: 'rgba(109,94,252,0.12)', border: '1px solid rgba(109,94,252,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}><span style={{ display: 'inline-block', width: 12, height: 12, marginRight: 8, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', verticalAlign: 'middle' }} />{progress}</div>}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, margin: '0 0 8px' }}>Media</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {['video', 'image'].map(t => (
            <button key={t} type="button" onClick={() => setMediaType(t)} style={{ background: mediaType === t ? 'rgba(109,94,252,0.25)' : 'transparent', border: '1px solid ' + (mediaType === t ? APP_ACCENT : 'rgba(255,255,255,0.15)'), borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
      </div>
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, margin: '0 0 8px' }}>Account</div>
        {accountsLoading && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading accounts…</div>}
        {accountsError && <div style={{ fontSize: 13, color: '#ff8080' }}>{accountsError}</div>}
        {!accountsLoading && accounts.length === 0 && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>No accounts connected. Connect accounts in Smart Video Scheduler first.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {accounts.map(acc => (
            <button key={acc.id} type="button" onClick={() => setSelectedAccountId(String(acc.id))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, textAlign: 'left', border: `1px solid ${String(acc.id) === String(selectedAccountId) ? APP_ACCENT : 'rgba(255,255,255,0.1)'}`, background: String(acc.id) === String(selectedAccountId) ? 'rgba(109,94,252,0.12)' : 'rgba(255,255,255,0.03)', color: '#fff', cursor: 'pointer' }}>
              <input type="radio" checked={String(acc.id) === String(selectedAccountId)} readOnly />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{acc.account_name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{acc.platform} · {acc.connection_status}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, margin: '0 0 8px' }}>Content</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Title (for YouTube)" value={title} onChange={e => setTitle(e.target.value)} maxLength={255} />
          <button type="button" onClick={() => handleEnhance('title')} disabled={!title.trim()} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#cbbcff', cursor: 'pointer' }}>✨</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
          <textarea style={{ ...inputStyle, flex: 1, minHeight: 60, resize: 'vertical' }} placeholder="Write your caption…" value={caption} onChange={e => setCaption(e.target.value)} maxLength={10000} />
          <button type="button" onClick={() => handleEnhance('caption')} disabled={!caption.trim()} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#cbbcff', cursor: 'pointer' }}>✨</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
          <textarea style={{ ...inputStyle, flex: 1, minHeight: 36, resize: 'vertical' }} placeholder="First comment (optional)" value={firstComment} onChange={e => setFirstComment(e.target.value)} maxLength={10000} />
          <button type="button" onClick={() => handleEnhance('firstComment')} disabled={!firstComment.trim()} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#cbbcff', cursor: 'pointer' }}>✨</button>
        </div>
      </div>
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, margin: '0 0 8px' }}>Schedule</div>
        <input type="datetime-local" style={inputStyle} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
        {isPastDate && <div style={{ fontSize: 11, color: '#ff9a9a', marginTop: 6 }}>Please select a future date and time.</div>}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '8px 0' }}>
        <button type="button" onClick={handleClose} style={{ background: 'transparent', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button type="button" onClick={handleSchedule} disabled={!canSubmit || status === 'uploading' || status === 'scheduling'} style={{ background: 'transparent', color: !canSubmit ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)', borderLeft: '2px solid #d9ff00', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: !canSubmit ? 'not-allowed' : 'pointer' }}>📅 Schedule</button>
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
};

export default BrightbeanScheduleModal;
