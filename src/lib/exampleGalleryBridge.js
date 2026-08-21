import { getCreateTarget, getCreateUrl, TEMPLATE_PREFIX, minimaxH3Demos } from '../data/minimaxH3Demos.js';
import { getAcademyCreateTarget } from '../data/academyStudioAdapters.js';
import { navigate } from './router.js';

export function showPromptModal({ title, prompt }) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.style.zIndex = '9999';

  const modal = document.createElement('div');
  modal.style.background = '#141414';
  modal.style.border = '1px solid #27272a';
  modal.style.borderRadius = '14px';
  modal.style.padding = '24px';
  modal.style.maxWidth = '640px';
  modal.style.width = '90%';
  modal.style.maxHeight = '80vh';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.gap = '16px';

  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  titleEl.style.fontSize = '16px';
  titleEl.style.fontWeight = '700';
  titleEl.style.color = '#d9ff00';

  const promptEl = document.createElement('div');
  promptEl.textContent = prompt;
  promptEl.style.fontSize = '14px';
  promptEl.style.fontWeight = '400';
  promptEl.style.color = '#ffffff';
  promptEl.style.lineHeight = '1.5';
  promptEl.style.whiteSpace = 'pre-wrap';
  promptEl.style.wordBreak = 'break-word';
  promptEl.style.overflowY = 'auto';
  promptEl.style.flex = '1';
  promptEl.style.maxHeight = '60vh';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.flex = '1';
  closeBtn.style.padding = '6px 10px';
  closeBtn.style.borderRadius = '8px';
  closeBtn.style.fontSize = '11px';
  closeBtn.style.fontWeight = '700';
  closeBtn.style.background = '#141414';
  closeBtn.style.color = '#a1a1aa';
  closeBtn.style.border = '1px solid #27272a';
  closeBtn.style.cursor = 'pointer';

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);

  modal.appendChild(titleEl);
  modal.appendChild(promptEl);
  modal.appendChild(closeBtn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

export async function handleCreateThisStyle(asset) {
  if (asset.source === 'minimax') {
    const demo = minimaxH3Demos.find((d) => d.slug === asset.slug);
    if (!demo) return;
    const target = getCreateTarget(demo);
    if (target.route.startsWith('template/') || target.params.template) {
      navigate(target.route, target.params);
    } else {
      navigate(target.route, target.params);
    }
    return;
  }

  if (asset.source === 'academy') {
    const result = getAcademyCreateTarget(asset.id);
    if (!result) {
      navigate('video', { prompt: '' });
      return;
    }
    navigate(result.route, result.params);
  }
}

export async function handleViewPrompt(asset) {
  if (asset.source === 'minimax') {
    const m = await import('../data/minimaxH3Demos.js');
    const prompt = await m.loadDemoPrompt(asset.slug);
    showPromptModal({ title: asset.title, prompt });
    return;
  }

  if (asset.source === 'academy') {
    navigate('academy', { template: asset.id });
  }
}
