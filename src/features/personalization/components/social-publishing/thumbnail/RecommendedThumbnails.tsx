'use client';

import React from 'react';
import type { CopyState } from '../types';
import type { Category } from './ExploreIdeas';

export interface RecommendedThumbnailsProps {
  onSelectTemplate: (templateId: string) => void
  selectedTemplateId: string | undefined
  copy: CopyState
  assetType: 'video' | 'image'
}

const RECOMMENDED_TEMPLATES: {
  id: string
  label: string
  category: string
  icon: string
  prompt: string
  reason: (copy: CopyState, assetType: 'video' | 'image') => string
}[] = [
  {
    id: 'creator-reaction',
    label: 'Creator Reaction',
    category: 'Creator',
    icon: '😮',
    prompt: 'YouTuber-style reaction face, dramatic lighting, bold yellow text overlay area, high contrast, shocked expression',
    reason: (c) => c.title ? `Matches "${c.title.slice(0, 30)}" energy` : 'Great for engagement-focused content',
  },
  {
    id: 'social-viral',
    label: 'Social Viral',
    category: 'Social',
    icon: '🔥',
    prompt: 'Viral social media thumbnail, high saturation, bold contrasting colors, eye-catching focal point, modern graphic design',
    reason: () => 'Optimized for social feeds and CTR',
  },
  {
    id: 'product-hero',
    label: 'Product Hero',
    category: 'Product',
    icon: '📦',
    prompt: 'Premium product photography studio, dramatic key light, soft shadow, clean background, commercial lighting, 8K',
    reason: (c, t) => t === 'video' && c.subject ? `Shows off: ${c.subject}` : 'Clean commercial look',
  },
  {
    id: 'editorial-cover',
    label: 'Editorial Cover',
    category: 'Editorial',
    icon: '📰',
    prompt: 'Magazine cover style, bold typography composition, dramatic color palette, minimalist layout, negative space, premium feel',
    reason: (c) => c.headline ? `Elevates "${c.headline.slice(0, 30)}"` : 'Premium editorial feel',
  },
  {
    id: 'edu-explainer',
    label: 'Edu Explainer',
    category: 'Education',
    icon: '📚',
    prompt: 'Educational infographic style, clean white background, bold iconography, clear visual metaphor, friendly, modern design',
    reason: () => 'Clear and trustworthy for tutorials',
  },
  {
    id: 'marketing-ctr',
    label: 'Marketing CTR',
    category: 'Marketing',
    icon: '📈',
    prompt: 'High-CTR thumbnail, before/after composition, arrow graphics, bold result numbers, contrasting color blocks',
    reason: (c) => c.visualIdea ? `Builds on your visual idea` : 'Designed for high click-through rate',
  },
]

export default function RecommendedThumbnails({ onSelectTemplate, selectedTemplateId, copy, assetType }: RecommendedThumbnailsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
          Recommended for this post
        </p>
        <span className="text-[10px] text-white/30">AI-suggested</span>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
        role="listbox"
        aria-label="Recommended thumbnail templates"
      >
        {RECOMMENDED_TEMPLATES.map(template => {
          const isSelected = selectedTemplateId === template.id
          return (
            <button
              key={template.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectTemplate(template.id)}
              className="group flex flex-col gap-2 p-3 rounded-xl text-left transition-all"
              style={{
                background: isSelected ? 'rgba(217,255,0,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isSelected ? 'rgba(217,255,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{template.icon}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-white/80 leading-tight truncate">{template.label}</p>
                  <p className="text-[9px] text-white/30 leading-tight">{template.category}</p>
                </div>
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2">
                {template.reason(copy, assetType)}
              </p>
              {isSelected && (
                <div className="h-0.5 rounded-full bg-[#d9ff00]/60" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
