import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ChatSidebar from './ChatSidebar.jsx';
import ChatMessage from './ChatMessage.jsx';
import ChatInput from './ChatInput.jsx';
import { useChat } from '../../hooks/useChat.js';

function ChatStudioApp() {
  const chat = useChat();
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSidebar((s) => !s);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    document.title = chat.activeConversation
      ? `${chat.activeConversation.title} — Chat Studio`
      : 'Chat Studio';
  }, [chat.activeConversation?.title]);

  return (
    <div className="chat-studio">
      {showSidebar && (
        <ChatSidebar
          onNewChat={chat.createConversation}
          onSelectChat={chat.switchConversation}
          onDeleteChat={chat.deleteConversation}
        />
      )}
      <div className="chat-main">
        {chat.activeConversation ? (
          <>
            <div className="chat-messages">
              {chat.activeMessages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
            </div>
            {chat.error && <div className="chat-error">{chat.error}</div>}
            <ChatInput
              onSend={(content) => chat.sendMessage(content, chat.selectedModelId)}
              onStop={chat.stopGeneration}
              isStreaming={chat.isStreaming}
            />
          </>
        ) : (
          <div className="chat-empty-state">
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '18px', marginBottom: '8px' }}>Welcome to Chat Studio</p>
              <p style={{ fontSize: '13px', marginBottom: '16px' }}>Create a new conversation to get started</p>
              <button
                className="chat-new-chat-btn"
                onClick={chat.createConversation}
                style={{ width: 'auto', padding: '10px 24px' }}
              >
                New Conversation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full';
  const root = createRoot(container);
  root.render(<ChatStudioApp />);
  container.cleanup = () => root.unmount();
  return container;
}
