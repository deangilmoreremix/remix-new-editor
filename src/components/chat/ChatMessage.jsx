import React from 'react';
import { MessageRole, MessageStatus } from '../../types/chat.js';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function ChatMessage({ message }) {
  const isUser = message.role === MessageRole.USER;
  const isStreaming = message.status === MessageStatus.STREAMING;

  return (
    <div className="chat-message">
      <div className="chat-message-header">
        <span className="chat-message-role">{message.role}</span>
        {isStreaming && <span className="chat-streaming-indicator" />}
      </div>
      <div className="chat-message-content">
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>{children}</code>
              );
            },
          }}
        >
          {message.content || (isStreaming ? '' : '...')}
        </ReactMarkdown>
      </div>
    </div>
  );
}
