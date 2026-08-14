import { getTemplate } from './thumbnailTemplateRegistry.js';
import { getPresetForTemplate, PRESET_LIST } from './thumbnailPresets.js';

/* eslint-disable no-unused-vars */
export function recommendForSocialPublish({ platforms = [], postType = 'video', _caption = '', selectedTemplate = null }) {
  const recommendations = [];

  if (selectedTemplate) {
    const template = getTemplate(selectedTemplate);
    if (template) {
      const preset = getPresetForTemplate(template);
      recommendations.push({
        template,
        preset,
        score: 100,
        reason: 'Previously selected template',
      });
    }
  }

  const _aspectRatio = postType === 'reel' || postType === 'story' ? '9:16'
    : platforms.includes('tiktok') ? '9:16'
    : platforms.includes('youtube') ? '16:9'
    : '16:9';

  const platformTemplates = [
    ...new Map(
      platforms.flatMap(pid => PRESET_LIST.filter(p => {
        if (postType === 'reel' || postType === 'story') return p.key === 'vertical';
        if (pid === 'tiktok') return p.key === 'vertical';
        if (pid === 'youtube') return p.key === 'cinematic';
        return p.key === 'boldText' || p.key === 'lifestyle';
      }).map(p => [p.key, p]))
    ).values()
  ];

  PRESET_LIST.forEach(preset => {
    if (recommendations.some(r => r.preset?.key === preset.key)) return;
    const score = platformTemplates.some(pt => pt.key === preset.key) ? 80 : 40;
    recommendations.push({
      template: null,
      preset,
      score,
      reason: preset.description,
    });
  });

  return recommendations.sort((a, b) => b.score - a.score);
}

export function getTopRecommendation({ platforms, postType, _caption, selectedTemplate }) {
  const recs = recommendForSocialPublish({ platforms, postType, selectedTemplate });
  return recs[0] || null;
}
