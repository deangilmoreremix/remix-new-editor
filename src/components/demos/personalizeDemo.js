// "Personalize This Demo" for the in-studio demo rails and detail modal
// (OpenHiggsBolt DemoTemplateActions → openPersonalize(demo)).
//
// The asset is normalised to OpenHiggsBolt's VideoDemo shape (slug, title,
// videoSrc, posterSrc, prompt, aspect ratio …) and handed to the shared
// personalization modal. MiniMax prompts are lazy, so they are loaded first,
// exactly as "Create This Style" does.
import { describeAsset, toMediaDemo } from './assetShape.js';

async function loadPrompt(asset, source, info) {
  if (info.prompt) return info.prompt;
  if (source !== 'minimax' || !info.slug) return '';
  try {
    const { loadDemoPrompt } = await import('../../data/minimaxH3Demos.js');
    return (await loadDemoPrompt(info.slug)) || '';
  } catch {
    return '';
  }
}

export async function personalizeDemoAsset(asset, { source = 'minimax', trigger = null } = {}) {
  const info = describeAsset(asset);
  const media = toMediaDemo(asset);
  const prompt = await loadPrompt(asset, source, info);
  const { openDemoPersonalization } = await import('../../features/personalization/mount.jsx');
  openDemoPersonalization(
    {
      ...asset,
      ...media,
      title: info.title,
      prompt,
      aspectRatio: info.ratio || asset?.aspectRatio,
      duration: typeof info.duration === 'number' ? info.duration : asset?.duration,
      category: info.category || asset?.category,
      tags: info.tags,
      sourceUrl: info.sourceUrl || undefined,
    },
    { access: 'authenticated', trigger },
  );
}
