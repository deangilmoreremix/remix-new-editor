import { useState, useEffect } from 'react';

function PersonalizationModal({ handleClose, options }) {
  const [tokens, setTokens] = useState(options?.tokens || []);
  const [activeToken, setActiveToken] = useState(null);

  function addToken() {
    setTokens(t => [...t, { id: Date.now(), label: 'New Token' }]);
  }

  function removeToken(id) {
    setTokens(t => t.filter(x => x.id !== id));
    if (activeToken === id) setActiveToken(null);
  }

  function updateToken(id, patch) {
    setTokens(t => t.map(x => x.id === id ? { ...x, ...patch } : x));
  }

  function apply() {
    if (options?.onAdd) options.onAdd(tokens);
    handleClose?.();
  }

  return (
    <div style={{ background: '#0b0f19', color: '#fff', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Personalizer</h2>
        <button onClick={handleClose} style={{ background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.55)', margin: '0 0 16px' }}>Open the timeline Personalizer inside the editor.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tokens.map(token => (
          <div key={token.id} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12 }}>
            <input
              value={token.label}
              onChange={e => updateToken(token.id, { label: e.target.value })}
              onClick={() => setActiveToken(token.id)}
              style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', flex: 1, outline: 'none' }}
            />
            <button onClick={() => removeToken(token.id)} style={{ background: 'rgba(255,80,80,0.15)', color: '#ff5050', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Delete</button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button onClick={addToken} style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 16px', cursor: 'pointer' }}>+ Add Token</button>
        <button onClick={apply} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 16px', cursor: 'pointer', fontWeight: 600 }}>Apply</button>
      </div>
    </div>
  );
}

export { PersonalizationModal };
