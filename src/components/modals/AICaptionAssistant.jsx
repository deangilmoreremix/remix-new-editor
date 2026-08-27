import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { generateCaption, generateHashtags } from '../../lib/aiCaptionService';

const APP_ACCENT = '#6d5efc';
const inputStyle = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', padding: '10px 12px', fontSize: 14, outline: 'none' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', margin: '14px 0 6px' };

const AICaptionAssistant = ({ options = {}, handleClose }) => {
  const opts = options || {};
  const [platform, setPlatform] = useState(opts.platform || 'instagram');
  const [tone, setTone] = useState(opts.tone || 'engaging');
  const [model, setModel] = useState('gpt-5.6-luna');
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const models = [
    { id: 'gpt-5.6-luna', name: '🌙 Luna — Fast & Cheap', desc: 'Captions, hashtags, bulk content. $0.20/MTok.' },
    { id: 'gpt-5.6-terra', name: '🌍 Terra — Balanced', desc: 'Content ideas, A/B tests, calendars. $2/MTok.' },
    { id: 'gpt-5.6-sol', name: '☀️ Sol — Most Powerful', desc: 'Strategy, repurposing, analysis. $4/MTok.' },
  ];

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setResult('');
    setHashtags([]);
    try {
      const capResult = await generateCaption({ platform, tone, content: topic, model });
      setResult(capResult.caption);
      const tagResult = await generateHashtags({ platform, caption: capResult.caption, count: 10, model });
      setHashtags(tagResult.hashtags);
    } catch (err) {
      setError(err.message || 'Failed to generate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '8px 8px 4px', color: '#fff', minWidth: 480, maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '6px 8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#6d5efc,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✨</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>AI Caption Assistant</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Powered by GPT-5.6 models</div>
        </div>
      </div>

      <div style={{ ...labelStyle, margin: '0 0 6px' }}>Platform</div>
      <select value={platform} onChange={e => setPlatform(e.target.value)} style={inputStyle}>
        {['instagram', 'tiktok', 'youtube', 'linkedin', 'twitter', 'facebook', 'pinterest'].map(p => (
          <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
        ))}
      </select>

      <div style={{ ...labelStyle, margin: '14px 0 6px' }}>Topic / Keywords</div>
      <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Describe your content..." value={topic} onChange={e => setTopic(e.target.value)} />

      <div style={{ ...labelStyle, margin: '14px 0 6px' }}>Tone</div>
      <select value={tone} onChange={e => setTone(e.target.value)} style={inputStyle}>
        {['engaging', 'professional', 'casual', 'funny', 'inspirational', 'educational'].map(t => (
          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
        ))}
      </select>

      <div style={{ ...labelStyle, margin: '14px 0 6px' }}>AI Model</div>
      <select value={model} onChange={e => setModel(e.target.value)} style={inputStyle}>
        {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
        {models.find(m => m.id === model)?.desc}
      </p>

      <button onClick={handleGenerate} disabled={loading || !topic.trim()} style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 10, border: 'none', background: loading ? 'rgba(109,94,252,0.5)' : 'linear-gradient(135deg,#6d5efc,#a855f7)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? 'Generating...' : 'Generate Caption'}
      </button>

      {error && <div style={{ marginTop: 12, padding: '10px', borderRadius: 8, background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)', color: '#ff9a9a', fontSize: 13 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 12, padding: '12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 14, color: '#fff', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{result}</p>
          {hashtags.length > 0 && <p style={{ fontSize: 12, color: '#6d5efc' }}>{hashtags.join(' ')}</p>}
        </div>
      )}
    </div>
  );
};

export default AICaptionAssistant;
