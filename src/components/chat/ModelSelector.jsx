import React from 'react';

// MuAPI text endpoints (dashed GPT-6 ids, see src/lib/muapi/liveModels.json).
const MODELS = [
  { id: 'gpt-6-1-sol', name: 'GPT-6 1 Sol' },
  { id: 'gpt-6-luna', name: 'GPT-6 Luna' },
  { id: 'gpt-6-astra', name: 'GPT-6 Astra' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
  { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet' },
];

export default function ModelSelector({ selectedModelId, onSelect }) {
  return (
    <div className="chat-model-selector">
      <select
        value={selectedModelId || 'gpt-6-1-sol'}
        onChange={(e) => onSelect(e.target.value)}
        style={{
          background: '#161a21',
          color: '#e6e6e6',
          border: '1px solid #232830',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '13px',
          width: '100%',
          maxWidth: '300px',
        }}
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    </div>
  );
}
