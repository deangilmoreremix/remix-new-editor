import { getCreateTarget, minimaxH3Demos } from '../data/minimaxH3Demos.js';
import { minimaxH3Demos as beatapiMinimaxH3Demos, getCreateTarget as beatapiMinimaxGetCreateTarget } from '../data/beatapiMinimaxH3Demos.js';
import { seedance25Demos, getCreateTarget as seedanceGetCreateTarget } from '../data/beatapiSeedance25Demos.js';
import { zeroLuDemos, getCreateTarget as zeroLuGetCreateTarget } from '../data/zeroLuDemos.js';
import { getAcademyCreateTarget } from '../data/academyStudioAdapters.js';
import { navigate } from './router.js';
import { stageStudioPrefill } from './studioPrefill.js';
import { MediaDetailView } from '../components/MediaDetailView.js';
import { getRelatedAssets } from '../data/exampleGalleryAssets.js';

// Studio routes that host an ExampleGallery; used as the fallback
// "Create This Style" destination when a source has no explicit mapping.
const STUDIO_ROUTES = new Set([
  'video', 'cinema', 'image', 'commercial', 'influencer',
  'avatar', 'character', 'effects', 'audio',
]);

/* ------------------------------------------------------------ prompt lookup */

/**
 * Resolve the full prompt text for a gallery asset. Most demo sources keep
 * their prompts in a lazily-loaded chunk, so this is async.
 */
export async function resolveAssetPrompt(asset) {
  if (!asset) return '';
  if (asset.prompt) return String(asset.prompt);
  try {
    if (asset.source === 'minimax') {
      if (minimaxH3Demos.some((d) => d.slug === asset.slug)) {
        const m = await import('../data/minimaxH3Demos.js');
        const p = await m.loadDemoPrompt(asset.slug);
        if (p) return p;
      }
      const b = await import('../data/beatapiMinimaxH3Demos.js');
      return (await b.loadDemoPrompt(asset.slug)) || '';
    }
    if (asset.source === 'seedance') {
      const m = await import('../data/beatapiSeedance25Demos.js');
      return (await m.loadDemoPrompt(asset.slug)) || '';
    }
    if (asset.source === 'zerolu') {
      const m = await import('../data/zeroLuDemos.js');
      return (await m.loadDemoPrompt(asset.slug)) || '';
    }
  } catch {
    /* prompt chunk failed to load — show an empty prompt rather than crash */
  }
  return '';
}

/* ------------------------------------------------------------ create target */

function resolveCreateTarget(asset) {
  if (asset.source === 'minimax') {
    const demo = minimaxH3Demos.find((d) => d.slug === asset.slug)
      || beatapiMinimaxH3Demos.find((d) => d.slug === asset.slug);
    if (demo) return beatapiMinimaxGetCreateTarget(demo) || getCreateTarget(demo);
  }

  if (asset.source === 'academy') {
    const rawId = String(asset.id || '').startsWith('academy:') ? asset.id.slice(8) : asset.id;
    const result = getAcademyCreateTarget(rawId);
    if (result) return result;
    return { route: 'video', params: { prompt: '' } };
  }

  if (asset.source === 'seedance') {
    const demo = seedance25Demos.find((d) => d.slug === asset.slug);
    if (demo) return seedanceGetCreateTarget(demo);
  }

  if (asset.source === 'zerolu') {
    const demo = zeroLuDemos.find((d) => d.slug === asset.slug);
    if (demo) return zeroLuGetCreateTarget(demo);
  }

  // youmind and anything unmapped: open the studio the asset belongs to.
  const route = STUDIO_ROUTES.has(asset.studio) ? asset.studio : 'video';
  return { route, params: asset.routeParams || {} };
}

/**
 * Put the prompt into the destination studio's main prompt field. Studios
 * render asynchronously, so retry briefly until the field exists.
 */
function applyPromptToStudio(prompt, { attempts = 20, interval = 75 } = {}) {
  if (!prompt) return Promise.resolve(false);
  return new Promise((resolve) => {
    let tries = 0;
    const tick = () => {
      const field = document.querySelector('[data-studio-prompt]');
      if (field) {
        field.value = prompt;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        try { field.focus({ preventScroll: true }); } catch { /* ignore */ }
        if (typeof field.scrollIntoView === 'function') {
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        resolve(true);
        return;
      }
      tries += 1;
      if (tries >= attempts) {
        resolve(false);
        return;
      }
      setTimeout(tick, interval);
    };
    tick();
  });
}

export async function handleCreateThisStyle(asset) {
  if (!asset) return;
  // The detail modal is fixed over the app; close it or the navigation
  // happens invisibly behind it.
  MediaDetailView.closeActive();

  const target = { ...resolveCreateTarget(asset) };
  // `ai-vfx` is an iframe-hosted app that cannot receive a prefill; the
  // in-app Effects studio is the prefill-able equivalent.
  if (target.route === 'ai-vfx') target.route = 'effects';
  const prompt = await resolveAssetPrompt(asset);

  stageStudioPrefill({
    route: target.route,
    prompt,
    params: target.params || {},
    ref: target.params?.ref || asset.source || 'example-gallery',
  });

  await navigate(target.route, target.params || {});
  const filled = await applyPromptToStudio(prompt);

  try {
    const { showToast } = await import('./loading.js');
    showToast(
      filled ? `“${asset.title || 'Template'}” style loaded — edit the prompt and generate`
             : `“${asset.title || 'Template'}” style applied`,
      'success',
      3500,
    );
  } catch {
    /* toast is cosmetic */
  }
}

/* -------------------------------------------------------------- detail view */

/**
 * Open the preview modal for a gallery asset. The prompt is loaded lazily
 * into the modal; `focusPrompt` scrolls straight to it.
 */
export function openAssetDetail(asset, { focusPrompt = false } = {}) {
  if (!asset) return null;
  const related = getRelatedAssets(asset, 8);
  const isVideo = Boolean(asset.videoSrc);
  const hasInlinePrompt = Boolean(asset.prompt);

  const detailView = new MediaDetailView({
    mediaUrl: isVideo ? asset.videoSrc : (asset.thumbnail || asset.posterSrc || ''),
    mediaType: isVideo ? 'video' : 'image',
    title: asset.title || '',
    prompt: asset.prompt || '',
    promptLoading: !hasInlinePrompt,
    model: asset.source || '',
    source: asset.source || '',
    author: asset.sourceAuthor || '',
    category: asset.category || '',
    date: asset.date || '',
    tags: asset.tags || [],
    relatedItems: related,
    onRelatedClick: (index) => {
      const relatedItem = related[index];
      if (relatedItem) openAssetDetail(relatedItem);
    },
    actions: [
      {
        id: 'view-prompt',
        label: 'View Prompt',
        onClick: () => detailView.revealPrompt(),
      },
      {
        id: 'create-style',
        label: 'Create This Style',
        onClick: () => handleCreateThisStyle(asset),
      },
    ],
  });
  detailView.show();

  const ready = hasInlinePrompt
    ? Promise.resolve()
    : resolveAssetPrompt(asset).then((prompt) => {
        if (detailView.isOpen) detailView.setPrompt(prompt);
      });

  if (focusPrompt) {
    ready.then(() => {
      if (detailView.isOpen) detailView.revealPrompt();
    });
  }

  detailView.ready = ready;
  return detailView;
}

export async function handleViewPrompt(asset) {
  if (!asset) return;

  // Academy items without an inline prompt live on the Academy page.
  if (asset.source === 'academy' && !asset.prompt) {
    MediaDetailView.closeActive();
    navigate('academy', { template: asset.id });
    return;
  }

  const view = openAssetDetail(asset, { focusPrompt: true });
  if (view?.ready) await view.ready;
}
