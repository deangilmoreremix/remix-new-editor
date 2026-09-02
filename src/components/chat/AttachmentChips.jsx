import React from 'react';

export default function AttachmentChips({ attachments, onRemove }) {
  const renderChip = (attachment, key, index) => {
    const isImage = attachment.type === 'image' || attachment.type === 'startFrame' || attachment.type === 'endFrame';
    const isAudio = attachment.type === 'audio';

    return (
      <span key={attachment.id || index} className="attachment-chip">
        {isImage && attachment.url && (
          <img src={attachment.url} alt="" width={24} height={24} />
        )}
        {isAudio && (
          <span className="attachment-chip-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </span>
        )}
        {!isImage && !isAudio && attachment.url && (
          <span className="attachment-chip-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
            </svg>
          </span>
        )}
        <span className="attachment-chip-label">
          {key === 'startFrame' && 'Start frame'}
          {key === 'endFrame' && 'End frame'}
          {key === 'images' && `Image ${index + 1}`}
          {key === 'videos' && `Video ${index + 1}`}
          {key === 'audios' && `Audio ${index + 1}`}
        </span>
        <button
          type="button"
          className="attachment-chip-remove"
          onClick={() => onRemove(key, attachment.id)}
          aria-label={`Remove ${key} ${index + 1}`}
          title="Remove"
        >
          ×
        </button>
      </span>
    );
  };

  const hasAttachments =
    attachments.images.length > 0 ||
    attachments.videos.length > 0 ||
    attachments.audios.length > 0 ||
    attachments.startFrame ||
    attachments.endFrame;

  if (!hasAttachments) return null;

  return (
    <div className="chat-attachment-chips" aria-label="Selected attachments">
      {attachments.startFrame && renderChip(attachments.startFrame, 'startFrame', 0)}
      {attachments.endFrame && renderChip(attachments.endFrame, 'endFrame', 0)}
      {attachments.images.map((chip, i) => renderChip(chip, 'images', i))}
      {attachments.videos.map((chip, i) => renderChip(chip, 'videos', i))}
      {attachments.audios.map((chip, i) => renderChip(chip, 'audios', i))}
    </div>
  );
}
