import { callOpenAIChat } from '@ohb/shared/api/openai';

export interface SocialCopyResult {
  masterPost: string
  hook: string
  cta: string
  hashtags: string
  variants: string[]
  youtube: { title: string; description: string }
  instagram: { caption: string }
  tiktok: { caption: string }
  thumbnail: {
    headline: string
    subheadline: string
    subject: string
    visualIdea: string
    recommendedTemplateIds: string[]
  }
}

function validateSocialCopy(data: unknown): SocialCopyResult {
  if (!data || typeof data !== 'object') throw new Error('Empty AI response');
  const obj = data as Record<string, unknown>;

  const masterPost = typeof obj.masterPost === 'string' ? obj.masterPost : '';
  const hook = typeof obj.hook === 'string' ? obj.hook : '';
  const cta = typeof obj.cta === 'string' ? obj.cta : '';
  const hashtags = typeof obj.hashtags === 'string' ? obj.hashtags : '';

  const variantsRaw = Array.isArray(obj.variants) ? obj.variants : [];
  const variants = variantsRaw
    .map((v) => (typeof v === 'string' ? v : ''))
    .filter((v) => v.trim());

  const youtubeEntry = obj.youtube as Record<string, unknown> | undefined;
  const youtube = {
    title: typeof youtubeEntry?.title === 'string' ? youtubeEntry.title : '',
    description: typeof youtubeEntry?.description === 'string' ? youtubeEntry.description : '',
  };

  const instagramEntry = obj.instagram as Record<string, unknown> | undefined;
  const instagram = {
    caption: typeof instagramEntry?.caption === 'string' ? instagramEntry.caption : '',
  };

  const tiktokEntry = obj.tiktok as Record<string, unknown> | undefined;
  const tiktok = {
    caption: typeof tiktokEntry?.caption === 'string' ? tiktokEntry.caption : '',
  };

  const thumbnailEntry = (obj.thumbnail as Record<string, unknown> | undefined) || {};
  const recommendedTemplateIds = Array.isArray(thumbnailEntry.recommendedTemplateIds)
    ? thumbnailEntry.recommendedTemplateIds.filter((t: unknown) => typeof t === 'string')
    : [];

  const thumbnail = {
    headline: typeof thumbnailEntry.headline === 'string' ? thumbnailEntry.headline : '',
    subheadline: typeof thumbnailEntry.subheadline === 'string' ? thumbnailEntry.subheadline : '',
    subject: typeof thumbnailEntry.subject === 'string' ? thumbnailEntry.subject : '',
    visualIdea: typeof thumbnailEntry.visualIdea === 'string' ? thumbnailEntry.visualIdea : '',
    recommendedTemplateIds,
  };

  if (!masterPost && variants.length === 0) {
    throw new Error('AI returned no copy content');
  }

  return { masterPost, hook, cta, hashtags, variants, youtube, instagram, tiktok, thumbnail };
}

function buildSystemPrompt(asset: { type: 'video' | 'image'; title?: string; description?: string }): string {
  return [
    'You are a social media copywriter. Return JSON only.',
    `Media type: ${asset.type}.`,
    asset.title ? `Title: ${asset.title}` : '',
    asset.description ? `Context: ${asset.description}` : '',
    'JSON shape:',
    '{',
    '  "masterPost": string,',
    '  "hook": string,',
    '  "cta": string,',
    '  "hashtags": string,',
    '  "variants": [string, string, string],',
    '  "youtube": { "title": string, "description": string },',
    '  "instagram": { "caption": string },',
    '  "tiktok": { "caption": string },',
    '  "thumbnail": { "headline": string, "subheadline": string, "subject": string, "visualIdea": string, "recommendedTemplateIds": [string] }',
    '}',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildUserPrompt(topic: string, action: string): string {
  const actionContext: Record<string, string> = {
    generate: `Generate a complete social post for: "${topic}".`,
    rewrite: `Rewrite this copy: "${topic}". Keep the core message.`,
    enhance: `Enhance this copy: "${topic}". Make it more engaging.`,
    shorten: `Shorten this copy: "${topic}". Keep the hook and CTA.`,
    expand: `Expand this copy: "${topic}". Add detail and context.`,
    hook: `Write a compelling hook based on: "${topic}".`,
    cta: `Write a strong CTA based on: "${topic}".`,
    hashtags: `Generate relevant hashtags for: "${topic}".`,
    professional: `Rewrite this copy in a professional tone: "${topic}".`,
    conversational: `Rewrite this copy in a conversational tone: "${topic}".`,
    persuasive: `Rewrite this copy to be more persuasive: "${topic}".`,
    platformize: `Adapt this copy for the target platform: "${topic}".`,
    refine: `Refine and polish this copy: "${topic}".`,
  };
  return actionContext[action] || `Process this copy: "${topic}".`;
}

async function callStructuredCopy(
  asset: { type: 'video' | 'image'; title?: string; description?: string },
  topic: string,
  action: string
): Promise<SocialCopyResult> {
  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(asset) },
    { role: 'user' as const, content: buildUserPrompt(topic, action) },
  ];

  const raw = await callOpenAIChat(messages);

  let parsed: unknown;
  try {
    const trimmed = raw.trim();
    const match = trimmed.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : trimmed;
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('AI returned invalid JSON');
  }

  return validateSocialCopy(parsed);
}

export async function generateCopy(
  topic: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, topic, 'generate');
}

export async function rewrite(
  text: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, text, 'rewrite');
}

export async function enhance(
  text: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, text, 'enhance');
}

export async function shorten(
  text: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, text, 'shorten');
}

export async function expand(
  text: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, text, 'expand');
}

export async function hook(
  text: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, text, 'hook');
}

export async function cta(
  text: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, text, 'cta');
}

export async function hashtags(
  text: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, text, 'hashtags');
}

export async function professional(
  text: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, text, 'professional');
}

export async function conversational(
  text: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, text, 'conversational');
}

export async function persuasive(
  text: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, text, 'persuasive');
}

export async function platformize(
  text: string,
  platform: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, `${text} [platform: ${platform}]`, 'platformize');
}

export async function refine(
  text: string,
  asset: { type: 'video' | 'image'; title?: string; description?: string }
): Promise<SocialCopyResult> {
  return callStructuredCopy(asset, text, 'refine');
}
