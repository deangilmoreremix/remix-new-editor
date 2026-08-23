import React from 'react';
import { chatStore } from '../../lib/chatStore.js';
import ModelSelector from './ModelSelector.jsx';

export default function ChatSidebar({ onNewChat, onSelectChat, onDeleteChat }) {
  const conversations = chatStore.conversations;
  const activeId = chatStore.activeConversationId;
  const selectedModelId = chatStore.selectedModelId;

  return (
    <div className="chat-sidebar">
      <div className="chat-sidebar-header">
        <h2>Chat Studio</h2>
        <button className="chat-new-chat-btn" onClick={onNewChat}>+ New Chat</button>
      </div>
      <div className="chat-conversation-list">
        {conversations.length === 0 && (
          <div style={{ padding: '12px', color: '#6b7280', fontSize: '13px' }}>
            No conversations yet
          </div>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`chat-conversation-item ${c.id === activeId ? 'active' : ''}`}
            onClick={() => onSelectChat(c.id)}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title || 'New conversation'}</span>
            <button
              className="delete-btn"
              onClick={(e) => { e.stopPropagation(); onDeleteChat(c.id); }}
              title="Delete"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px', borderTop: '1px solid #232830' }}>
        <ModelSelector selectedModelId={selectedModelId} onSelect={chatStore.setSelectedModelId} />
      </div>
    </div>
  );
}
