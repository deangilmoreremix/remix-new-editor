'use client';

import React, { useState, useCallback } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import type { CopyState } from '../types';

const CATEGORIES = [
  'All', 'Social', 'Marketing', 'Creator', 'People',
  'Business', 'Product', 'Education', 'Editorial', 'Creative', 'Fun',
] as const;

const TEMPLATES = [
  {
 id: 'creator-reaction', label: 'Creator Reaction', category: 'Creator', icon: '😮',
    prompt: 'YouTuber-style reaction face, dramatic lighting, bold yellow text overlay area, high contrast, shocked expression, clean background',
    referenceType: 'photo', referenceLabel: 'Face photo (optional)' 
},
  {
 id: 'product-hero', label: 'Product Hero', category: 'Product', icon: '📦',
    prompt: 'Premium product photography studio, dramatic key light, soft shadow, clean white or gradient background, commercial lighting, 8K product shot',
    referenceType: 'product', referenceLabel: 'Product image' 
},
  {
 id: 'workspace-makeover', label: 'Workspace Makeover', category: 'Business', icon: '💼',
    prompt: 'Modern minimalist workspace, natural window light, clean desk setup, professional yet inviting, warm tones, shallow depth of field',
    referenceType: 'room', referenceLabel: 'Room photo (optional)' 
},
  {
 id: 'face-reveal', label: 'Face Reveal', category: 'People', icon: '👤',
    prompt: 'Dramatic portrait reveal, rim lighting, mystery atmosphere, face partially in shadow, cinematic, high contrast',
    referenceType: 'photo', referenceLabel: 'Face reference' 
},
  {
 id: 'edu-explainer', label: 'Edu Explainer', category: 'Education', icon: '📚',
    prompt: 'Educational infographic style, clean white background, bold iconography, clear visual metaphor, friendly and approachable, modern design',
    referenceType: null, referenceLabel: null 
},
  {
 id: 'editorial-cover', label: 'Editorial Cover', category: 'Editorial', icon: '📰',
    prompt: 'Magazine cover style, bold typography composition, dramatic color palette, minimalist layout, negative space, premium feel',
    referenceType: null, referenceLabel: null 
},
  {
 id: 'social-viral', label: 'Social Viral', category: 'Social', icon: '🔥',
    prompt: 'Viral social media thumbnail, high saturation, bold contrasting colors, eye-catching focal point, modern graphic design, shareable aesthetic',
    referenceType: null, referenceLabel: null 
},
  {
 id: 'marketing-ctr', label: 'Marketing CTR', category: 'Marketing', icon: '📈',
    prompt: 'High-CTR marketing thumbnail, before/after composition, arrow graphics, bold result numbers, contrasting color blocks, professional design',
    referenceType: null, referenceLabel: null 
},
  {
 id: 'funny-meme', label: 'Funny Meme', category: 'Fun', icon: '😂',
    prompt: 'Meme-style thumbnail, exaggerated expression, bold Impact-style text area, high contrast, comedic timing, vibrant colors, social media optimized',
    referenceType: null, referenceLabel: null 
},
  {
 id: 'creative-3d', label: 'Creative 3D', category: 'Creative', icon: '🎨',
    prompt: '3D rendered scene, isometric perspective, vibrant materials, soft volumetric lighting, blender-style render, modern abstract composition',
    referenceType: null, referenceLabel: null 
},
  {
 id: 'lifestyle-blog', label: 'Lifestyle Blog', category: 'Social', icon: '🌿',
    prompt: 'Lifestyle blogger thumbnail, warm natural light, cozy aesthetic, authentic candid feel, soft pastels, relatable composition',
    referenceType: 'photo', referenceLabel: 'Lifestyle photo (optional)' 
},
  {
 id: 'business-podcast', label: 'Business Podcast', category: 'Business', icon: '🎙️',
    prompt: 'Professional podcast thumbnail, headshot composition, clean gradient background, bold episode number, modern sans-serif layout, trust-inspiring',
    referenceType: 'photo', referenceLabel: 'Headshot (optional)' 
},
] as const;

export type Category = typeof CATEGORIES[number];

export interface ExploreIdeasProps {
  onSelectTemplate: (templateId: string) => void
  selectedTemplateId: string | undefined
  copy?: CopyState
}

export default function ExploreIdeas({ onSelectTemplate, selectedTemplateId, copy }: ExploreIdeasProps) {
  const [category, setCategory] = useState<Category>('All');
  const [showAll, setShowAll] = useState(false);

  const visibleTemplates = category === 'All'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === category);

  const displayed = showAll ? visibleTemplates : visibleTemplates.slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Popular Ideas</p>
        <span className="text-[10px] text-white/30">{visibleTemplates.length} ideas</span>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Template categories">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={category === cat}
            onClick={() => { setCategory(cat); setShowAll(false); }}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
            style={{
              background: category === cat ? 'rgba(217,255,0,0.15)' : 'rgba(255,255,255,0.05)',
              color: category === cat ? '#d9ff00' : 'rgba(255,255,255,0.5)',
              border: `1px solid ${category === cat ? 'rgba(217,255,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
        role="listbox"
        aria-label="Thumbnail ideas"
      >
        {displayed.map(template => {
          const isSelected = selectedTemplateId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectTemplate(template.id)}
              className="group relative flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all"
              style={{
                background: isSelected ? 'rgba(217,255,0,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isSelected ? 'rgba(217,255,0,0.35)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <span className="text-xl leading-none">{template.icon}</span>
              <span className="text-[11px] font-semibold text-white/80 leading-tight">{template.label}</span>
              <span className="text-[9px] text-white/30 leading-tight">{template.category}</span>
              {template.referenceType && (
                <span className="text-[9px] text-[#d9ff00]/70 leading-tight">+ reference</span>
              )}
              {isSelected && (
                <div className="absolute inset-0 rounded-xl" style={{ boxShadow: '0 0 12px rgba(217,255,0,0.2)' }} />
              )}
            </button>
          );
        })}
      </div>

      {visibleTemplates.length > 8 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="flex items-center gap-1.5 w-full py-2 text-[11px] font-medium text-white/40 hover:text-[#d9ff00] transition-colors"
        >
          <ChevronDown size={12} />
          Explore all {visibleTemplates.length} ideas
        </button>
      )}
    </div>
  );
}
