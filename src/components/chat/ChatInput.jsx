import React, { useState, useRef, useEffect } from 'react';

export default function ChatInput({ onSend, onStop, isStreaming }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [value]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || isStreaming) return;
    onSend(value.trim());
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="chat-input-area" onSubmit={handleSubmit}>
      <div className="chat-input-form">
        <textarea
          ref={textareaRef}
          className="chat-input-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows={1}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button type="button" className="chat-stop-btn" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="chat-send-btn" disabled={!value.trim()}>
            Send
          </button>
        )}
      </div>
    </form>
  );
}
