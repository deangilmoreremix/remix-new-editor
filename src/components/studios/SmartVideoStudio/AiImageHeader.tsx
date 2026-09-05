/**
 * SmartVideo Studio — AiImageHeader
 *
 * Cinematic AI image header that matches the muAPI Studio aesthetic
 * but uses the SmartVideo warm purple color scheme.
 */

import React from 'react';

interface AiImageHeaderProps {
  tabId: string;
  tabLabel: string;
  description?: string;
  heroImageUrl?: string;
}

const HEADER_CONTENT: Record<string, { tagline: string; cta: string }> = {
  image: {
    tagline: 'Create stunning images with AI — text-to-image, image editing, upscaling, and more',
    cta: 'Image Studio',
  },
  video: {
    tagline: 'Generate cinematic video from text or images — Kling, Veo, Seedance, and more',
    cta: 'Video Studio',
  },
  audio: {
    tagline: 'Produce music, voiceovers, and sound effects with AI — Suno, MMAudio, and more',
    cta: 'Audio Studio',
  },
  avatar: {
    tagline: 'Create talking avatars, lip-sync, and character animations',
    cta: 'Avatar Studio',
  },
  '3d': {
    tagline: 'Generate 3D models from text or images — Tripo3D, Meshy, and more',
    cta: '3D Studio',
  },
  tools: {
    tagline: 'Enhance, transform, and optimize your media with AI-powered tools',
    cta: 'AI Tools',
  },
};

export default function AiImageHeader({ tabId, tabLabel, description, heroImageUrl }: AiImageHeaderProps) {
  const content = HEADER_CONTENT[tabId] || { tagline: description || '', cta: tabLabel };

  return (
    <div className="ai-image-header">
      {/* Background layers */}
      <div className="ai-image-header-bg" aria-hidden="true">
        <div className="ai-image-header-bg-gradient" />
        {heroImageUrl && (
          <img
            src={heroImageUrl}
            alt=""
            className="ai-image-header-bg-image"
          />
        )}
        <div className="ai-image-header-bg-noise" />
      </div>

      {/* Content */}
      <div className="ai-image-header-content">
        <h1 className="ai-image-header-title">{content.cta}</h1>
        <p className="ai-image-header-tagline">{content.tagline}</p>
      </div>
    </div>
  );
}
