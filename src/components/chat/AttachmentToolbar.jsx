import React from 'react';

const TOOLS = [
  {
    key: 'startFrame',
    label: 'Start frame',
    shortLabel: 'Start f...',
    accept: 'image/*',
    multiple: false,
    title: 'Starting image for the video. Sets the opening scene.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    key: 'endFrame',
    label: 'End frame',
    shortLabel: 'End f...',
    accept: 'image/*',
    multiple: false,
    title: 'End frame needs a start frame — a last frame on its own is rejected.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M15 21V9" />
      </svg>
    ),
  },
  {
    key: 'image',
    label: 'Image',
    shortLabel: 'IMAGE',
    accept: 'image/*',
    multiple: true,
    title: 'Reference Images',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  {
    key: 'video',
    label: 'Video',
    shortLabel: 'VIDEO',
    accept: 'video/*',
    multiple: true,
    title: 'Reference Videos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    key: 'audio',
    label: 'Audio',
    shortLabel: 'AUDIO',
    accept: 'audio/*',
    multiple: true,
    title: 'Reference Audios',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
];

export default function AttachmentToolbar({ onUpload, isStreaming, attachments }) {
  const handleClick = (tool) => {
    if (isStreaming) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = tool.accept;
    input.multiple = tool.multiple;
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = (e) => {
      const files = Array.from(e.target.files || []);
      files.forEach((file) => onUpload(tool.key, file));
      if (input.parentNode) document.body.removeChild(input);
    };

    input.oncancel = () => {
      if (input.parentNode) document.body.removeChild(input);
    };

    input.click();
  };

  return (
    <div className="chat-attachment-toolbar" role="toolbar" aria-label="Attachment toolbar">
      {TOOLS.map((tool) => (
        <button
          key={tool.key}
          type="button"
          className="chat-attachment-btn"
          disabled={isStreaming}
          onClick={() => handleClick(tool)}
          data-tooltip={tool.title}
          aria-label={tool.title}
          title={tool.title}
        >
          <span className="chat-attachment-icon">{tool.icon}</span>
          <span className="chat-attachment-label">{tool.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
