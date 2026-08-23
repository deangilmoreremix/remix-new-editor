import React from 'react';

import { openSocialPublish } from '../../lib/socialPublishHelpers';

// Drop-in button for any image or video studio. Pass the generated asset's
// public URL + its type and it opens the SocialPublishModal. If no URL is
// available yet, it still opens and lets the user paste one.
export default function PublishToSocialButton({
  mediaUrl = '',
  mediaType, // 'image' | 'video' — inferred from URL if omitted
  title,
  description,
  tags,
  externalUserId,
  onPublished,
  label = 'Publish to Social',
  className,
  style,
}) {
  const handleClick = () => {
    openSocialPublish({ mediaUrl, mediaType, title, description, tags, externalUserId, onPublished });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'linear-gradient(90deg,#6d5efc,#a855f7)',
        color: '#fff',
        border: 'none',
        borderRadius: 10,
        padding: '9px 14px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        ...style,
      }}
    >
      <span aria-hidden>📡</span>
      {label}
    </button>
  );
}
