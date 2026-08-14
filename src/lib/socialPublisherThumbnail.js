export function seedThumbnailFieldsFromSocialCopy({ postText = '', caption = '', platforms = [], postType = 'video' } = {}) {
  const combinedText = [postText, caption].filter(Boolean).join(' ');
  const headline = extractHeadline(combinedText);
  const hashtags = extractHashtags(combinedText);
  const aspectRatio = recommendAspectRatio(platforms, postType);

  return {
    headline,
    hashtags,
    aspectRatio,
    brief: buildBrief(headline, hashtags, platforms),
    template: null,
    selectedThumbnail: null,
    isGenerating: false,
    error: null,
  };
}

function extractHeadline(text) {
  if (!text) return '';
  const sentences = text.split(/[.!?\n]/).filter(s => s.trim());
  const headline = sentences[0]?.trim() || '';
  return headline.slice(0, 80);
}

function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#[\w]+/g) || [];
  return matches.map(tag => tag.slice(1));
}

function recommendAspectRatio(platforms, postType) {
  if (postType === 'reel' || postType === 'story') return '9:16';
  if (platforms.includes('tiktok')) return '9:16';
  if (platforms.includes('youtube')) return '16:9';
  if (platforms.includes('instagram') && !platforms.includes('facebook')) return '1:1';
  return '16:9';
}

function buildBrief(headline, hashtags, platforms) {
  const tags = hashtags.length > 0 ? hashtags.join(', ') : 'social media content';
  const platformNames = platforms.length > 0 ? platforms.join(', ') : 'multi-platform';
  return `${headline} — ${tags} — ${platformNames}`;
}

export function validateSelectedThumbnail(thumbnail) {
  if (!thumbnail) {
    return { valid: false, error: 'Please select a thumbnail before continuing.' };
  }
  if (!thumbnail.url && !thumbnail.imageB64 && !thumbnail.dataUrl) {
    return { valid: false, error: 'Selected thumbnail is missing image data.' };
  }
  return { valid: true };
}

export function getThumbnailPublishMetadata(thumbnail, platforms, postType) {
  if (!thumbnail) return null;
  return {
    thumbnailUrl: thumbnail.url || null,
    thumbnailB64: thumbnail.imageB64 || null,
    thumbnailDataUrl: thumbnail.dataUrl || null,
    aspectRatio: thumbnail.aspectRatio || '16:9',
    templateId: thumbnail.templateId || null,
    promptUsed: thumbnail.promptUsed || '',
    headline: thumbnail.headline || '',
    platforms,
    postType,
  };
}
