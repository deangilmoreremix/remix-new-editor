export function buildThumbnailPrompt({ headline, brief, customPrompt, template, preset, hashtags }) {
  const parts = [];

  if (headline) {
    parts.push(`Headline: "${headline}"`);
  }

  if (brief) {
    parts.push(`Context: ${brief}`);
  }

  if (hashtags && hashtags.length > 0) {
    parts.push(`Themes: ${hashtags.join(', ')}`);
  }

  if (preset && preset.briefModifier) {
    parts.push(`Style: ${preset.briefModifier}`);
  }

  if (customPrompt) {
    parts.push(`Details: ${customPrompt}`);
  }

  if (template && template.niche) {
    parts.push(`Niche: ${template.niche}`);
  }

  const prompt = parts.join('\n');
  return prompt.trim() || 'Social media thumbnail, eye-catching, high quality';
}

export function buildBriefFromSocialCopy(caption, platforms) {
  const sentences = caption.split(/[.!?\n]/).filter(s => s.trim());
  const headline = sentences[0]?.trim().slice(0, 80) || caption.slice(0, 80);
  const hashtags = (caption.match(/#[\w]+/g) || []).map(t => t.slice(1));
  const platformNames = platforms.length > 0 ? platforms.join(', ') : 'multi-platform';

  return {
    headline,
    hashtags,
    brief: `${headline} — ${hashtags.length > 0 ? hashtags.join(', ') : 'social media content'} — ${platformNames}`,
    prompt: buildThumbnailPrompt({
      headline,
      brief: `${headline} — ${platformNames}`,
      hashtags,
    }),
  };
}
