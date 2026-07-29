import { useState, useEffect } from 'react';

function TokenEditor({ onTokensChange, initialTokens }) {
  const [tokens, setTokens] = useState(initialTokens || {});

  function update(path, value) {
    setTokens(prev => {
      const next = { ...prev };
      const nested = path.split('.');
      let ref = next;
      for (let i = 0; i < nested.length - 1; i++) {
        ref = ref[nested[i]] ||= {};
      }
      ref[nested[nested.length - 1]] = value;
      onTokensChange?.(next);
      return next;
    });
  }

  return (
    <div style={{ background: '#0b0f19', color: '#fff', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tokens</h2>
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>Edit color, spacing, and typography</span>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.55)', margin: '0 0 16px' }}>Token editor requires React runtime.</p>

      {Object.keys(tokens).length === 0 && (
        <div style={{ opacity: 0.8 }}>
          <div style={{ padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 8 }}>colors.primary: <input defaultValue="#3b82f6" onChange={e => update('colors.primary', e.target.value)} style={{ marginLeft: 8, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px' }} /></div>
          <div style={{ padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>colors.background: <input defaultValue="#0b0f19" onChange={e => update('colors.background', e.target.value)} style={{ marginLeft: 8, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px' }} /></div>
        </div>
      )}
    </div>
  );
}

export default TokenEditor;
