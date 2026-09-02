import React from 'react';
import { MessageRole, MessageStatus } from '../../types/chat.js';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function AttachmentPreview({ attachment }) {
  if (!attachment) return null;

  const isImage = attachment.type === 'image' || attachment.type === 'startFrame' || attachment.type === 'endFrame';
  const isVideo = attachment.type === 'video';
  const isAudio = attachment.type === 'audio';

  return (
    <span className="message-attachment">
      {isImage && attachment.url && (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
          <img src={attachment.url} alt={attachment.type} width={40} height={40} />
        </a>
      )}
      {isVideo && attachment.url && (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="message-attachment-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
          </svg>
          Video
        </a>
      )}
      {isAudio && attachment.url && (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="message-attachment-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          Audio
        </a>
      )}
    </span>
  );
}

export default function ChatMessage({ message }) {
  const isUser = message.role === MessageRole.USER;
  const isStreaming = message.status === MessageStatus.STREAMING;

  const attachments = message.attachments || {};
  const hasAttachments =
    attachments.reference_images?.length > 0 ||
    attachments.reference_videos?.length > 0 ||
    attachments.reference_audios?.length > 0 ||
    attachments.first_frame_url ||
    attachments.last_frame_url;

  return (
    <div className="chat-message">
      <div className="chat-message-header">
        <span className="chat-message-role">{message.role}</span>
        {isStreaming && <span className="chat-streaming-indicator" />}
      </div>
      {hasAttachments && (
        <div className="chat-message-attachments">
          {attachments.first_frame_url && (
            <AttachmentPreview attachment={{ type: 'startFrame', url: attachments.first_frame_url }} />
          )}
          {attachments.last_frame_url && (
            <AttachmentPreview attachment={{ type: 'endFrame', url: attachments.last_frame_url }} />
          )}
          {(attachments.reference_images || []).map((url, i) => (
            <AttachmentPreview key={`img-${i}`} attachment={{ type: 'image', url }} />
          ))}
          {(attachments.reference_videos || []).map((url, i) => (
            <AttachmentPreview key={`vid-${i}`} attachment={{ type: 'video', url }} />
          ))}
          {(attachments.reference_audios || []).map((url, i) => (
            <AttachmentPreview key={`aud-${i}`} attachment={{ type: 'audio', url }} />
          ))}
        </div>
      )}
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
