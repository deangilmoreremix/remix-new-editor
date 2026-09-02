import { getCreateTarget, minimaxH3Demos } from '../data/minimaxH3Demos.js';
import { getAcademyCreateTarget } from '../data/academyStudioAdapters.js';
import { navigate } from './router.js';
import { MediaDetailView } from '../components/MediaDetailView.js';
import { getRelatedAssets } from '../data/exampleGalleryAssets.js';

function scheduleAutoGenerate(route) {}

function openAssetDetail(asset) {
  if (!asset) return;
  const related = getRelatedAssets(asset, 8);
  const detailView = new MediaDetailView({
    mediaUrl: asset.thumbnail || asset.videoSrc || '',
    mediaType: asset.videoSrc ? 'video' : 'image',
    title: asset.title || '',
    prompt: asset.prompt || '',
    model: asset.source || '',
    source: asset.sourceAuthor || asset.source || '',
    author: asset.sourceAuthor || '',
    category: asset.category || '',
    date: asset.date || '',
    tags: asset.tags || [],
    relatedItems: related,
    onRelatedClick: (index) => {
      const relatedItem = related[index];
      if (relatedItem) openAssetDetail(relatedItem);
    },
    actions: asset.prompt ? [
      {
        id: 'copy-prompt',
        label: 'Copy Prompt',
        onClick: () => {
          navigator.clipboard.writeText(asset.prompt || '').then(() => {
            detailView._showToast('Prompt copied to clipboard');
          }).catch(() => {
            detailView._showToast('Failed to copy prompt', true);
          });
        },
      },
    ] : [],
  });
  detailView.show();
}

export async function handleCreateThisStyle(asset) {
  if (asset.source === 'minimax') {
    const demo = minimaxH3Demos.find((d) => d.slug === asset.slug);
    if (!demo) return;
    const target = getCreateTarget(demo);
    navigate(target.route, target.params);
    scheduleAutoGenerate(target.route);
    return;
  }

  if (asset.source === 'academy') {
    const result = getAcademyCreateTarget(asset.id);
    if (!result) {
      navigate('video', { prompt: '' });
      return;
    }
    navigate(result.route, result.params);
    scheduleAutoGenerate(result.route);
    return;
  }

  if (asset.source === 'seedance') {
    const { getCreateTarget, loadDemoPrompt } = await import('../data/beatapiSeedance25Demos.js');
    const demo = seedance25Demos.find((d) => d.slug === asset.slug);
    if (demo) {
      const target = getCreateTarget(demo);
      navigate(target.route, target.params);
      scheduleAutoGenerate(target.route);
    }
    return;
  }

  if (asset.provider === 'youmind') {
    const ta = document.getElementById('i-prompt-textarea') || document.querySelector('textarea');
    if (ta) {
      ta.value = asset.prompt || '';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.focus();
    }
    return;
  }

  if (asset.source === 'zerolu') {
    const { getCreateTarget, loadDemoPrompt } = await import('../data/zeroLuDemos.js');
    const demo = zeroLuDemos.find((d) => d.slug === asset.slug);
    if (demo) {
      const target = getCreateTarget(demo);
      navigate(target.route, target.params);
      scheduleAutoGenerate(target.route);
    }
    return;
  }
}

export async function handleViewPrompt(asset) {
  if (asset.source === 'minimax') {
    const m = await import('../data/minimaxH3Demos.js');
    const prompt = await m.loadDemoPrompt(asset.slug);
    showPromptView({ title: asset.title, prompt, source: asset.source, asset });
    return;
  }

  if (asset.source === 'academy') {
    navigate('academy', { template: asset.id });
  }

  if (asset.source === 'seedance') {
    const { loadDemoPrompt } = await import('../data/beatapiSeedance25Demos.js');
    const prompt = await loadDemoPrompt(asset.slug);
    showPromptView({ title: asset.title, prompt: prompt || '', source: asset.source, asset });
    return;
  }

  if (asset.provider === 'youmind') {
    const related = getRelatedAssets(asset, 8);
    const detailView = new MediaDetailView({
      mediaUrl: asset.thumbnail || '',
      mediaType: 'image',
      title: asset.title || '',
      prompt: asset.prompt || '',
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
          id: 'copy-prompt',
          label: 'Copy Prompt',
          onClick: () => {
            if (asset.prompt) {
              navigator.clipboard.writeText(asset.prompt).then(() => {
                detailView._showToast('Prompt copied to clipboard');
              }).catch(() => {
                detailView._showToast('Failed to copy prompt', true);
              });
            }
          },
        },
      ],
    });
    detailView.show();
    return;
  }

  if (asset.source === 'zerolu') {
    const { loadDemoPrompt } = await import('../data/zeroLuDemos.js');
    const prompt = await loadDemoPrompt(asset.slug);
    showPromptView({ title: asset.title, prompt: prompt || '', source: asset.source, asset });
    return;
  }
}

function showPromptView({ title, prompt, source, asset }) {
  const related = asset ? getRelatedAssets(asset, 8) : [];
  const detailView = new MediaDetailView({
    title: title || 'Prompt',
    prompt: prompt || '',
    source: source || '',
    model: source || '',
    author: asset?.sourceAuthor || '',
    category: asset?.category || '',
    date: asset?.date || '',
    relatedItems: related,
    onRelatedClick: (index) => {
      const relatedItem = related[index];
      if (relatedItem) openAssetDetail(relatedItem);
    },
    autoCollapsePrompt: true,
    actions: [
      {
        id: 'copy-prompt',
        label: 'Copy Prompt',
        onClick: () => {
          if (prompt) {
            navigator.clipboard.writeText(prompt).then(() => {
              detailView._showToast('Prompt copied to clipboard');
            }).catch(() => {
              detailView._showToast('Failed to copy prompt', true);
            });
          }
        },
      },
    ],
  });
  detailView.show();
}
