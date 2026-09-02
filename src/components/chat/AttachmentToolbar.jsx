import React, { useState } from 'react';
import { fileMatchesAccept } from '../../lib/studioFileDrop.js';

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
  const [dragKey, setDragKey] = useState(null);

  const uploadFiles = (tool, fileList) => {
    if (isStreaming) return;
    const compatible = Array.from(fileList || []).filter((file) => fileMatchesAccept(file, tool.accept));
    const files = tool.multiple ? compatible : compatible.slice(0, 1);
    files.forEach((file) => onUpload(tool.key, file, {
      role: tool.key,
      accept: tool.accept,
      source: 'chat-attachment-toolbar',
    }));
  };

  const handleClick = (tool) => {
    if (isStreaming) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = tool.accept;
    input.multiple = tool.multiple;
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = (e) => {
      uploadFiles(tool, e.target.files);
      input.remove();
    };

    input.oncancel = () => input.remove();
    input.click();
  };

  const handleDragEnter = (event, tool) => {
    event.preventDefault();
    event.stopPropagation();
    if (isStreaming) return;
    const items = Array.from(event.dataTransfer?.items || []);
    const files = Array.from(event.dataTransfer?.files || []);
    const compatible = files.some((file) => fileMatchesAccept(file, tool.accept)) ||
      items.some((item) => item.kind === 'file' && (!item.type || fileMatchesAccept({ type: item.type, name: '' }, tool.accept)));
    if (compatible || (!items.length && !files.length)) setDragKey(tool.key);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (event, tool) => {
    event.preventDefault();
    event.stopPropagation();
    setDragKey(null);
    uploadFiles(tool, event.dataTransfer?.files);
  };

  return (
    <div className="chat-attachment-toolbar" role="toolbar" aria-label="Attachment toolbar">
      {TOOLS.map((tool) => (
        <button
          key={tool.key}
          type="button"
          className={`chat-attachment-btn ${dragKey === tool.key ? 'is-dragging ring-2 ring-primary border-primary bg-primary/10' : ''}`}
          disabled={isStreaming}
          onClick={() => handleClick(tool)}
          onDragEnter={(event) => handleDragEnter(event, tool)}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragKey((current) => current === tool.key ? null : current)}
          onDrop={(event) => handleDrop(event, tool)}
          data-tooltip={tool.title}
          data-attachment-role={tool.key}
          aria-label={tool.title}
          title={`${tool.title} — click to browse or drop files here`}
        >
          <span className="chat-attachment-icon">{tool.icon}</span>
          <span className="chat-attachment-label">{tool.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
