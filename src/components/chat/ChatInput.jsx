import React, { useState, useRef, useEffect } from 'react';
import AttachmentToolbar from './AttachmentToolbar.jsx';
import AttachmentChips from './AttachmentChips.jsx';

export default function ChatInput({ onSend, onStop, isStreaming, attachments, onUpload, onRemoveAttachment }) {
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
    onSend(value.trim(), attachments);
    setValue('');
    if (onUpload) onUpload('__reset__', null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (!file) continue;

        if (file.type.startsWith('image/')) {
          e.preventDefault();
          onUpload?.('image', file);
        } else if (file.type.startsWith('video/')) {
          e.preventDefault();
          onUpload?.('video', file);
        } else if (file.type.startsWith('audio/')) {
          e.preventDefault();
          onUpload?.('audio', file);
        }
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    files.forEach((file) => {
      if (file.type.startsWith('image/')) onUpload?.('image', file);
      else if (file.type.startsWith('video/')) onUpload?.('video', file);
      else if (file.type.startsWith('audio/')) onUpload?.('audio', file);
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <form
      className="chat-input-area"
      onSubmit={handleSubmit}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {attachments && onUpload && (
        <>
          <AttachmentToolbar
            onUpload={onUpload}
            isStreaming={isStreaming}
            attachments={attachments}
          />
          {onRemoveAttachment && (
            <AttachmentChips
              attachments={attachments}
              onRemove={onRemoveAttachment}
            />
          )}
        </>
      )}
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
