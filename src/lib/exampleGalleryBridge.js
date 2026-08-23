import { getCreateTarget, minimaxH3Demos } from '../data/minimaxH3Demos.js';
import { getAcademyCreateTarget } from '../data/academyStudioAdapters.js';
import { navigate } from './router.js';

function scheduleAutoGenerate(route) {}

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

  if (asset.source === 'youmind') {
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
    showPromptModal({ title: asset.title, prompt });
    return;
  }

  if (asset.source === 'academy') {
    navigate('academy', { template: asset.id });
  }

  if (asset.source === 'seedance') {
    const { loadDemoPrompt } = await import('../data/beatapiSeedance25Demos.js');
    const prompt = await loadDemoPrompt(asset.slug);
    showPromptModal({ title: asset.title, prompt: prompt || '' });
    return;
  }

  if (asset.source === 'youmind') {
    showPromptModal({ title: asset.title, prompt: asset.prompt || '' });
    return;
  }

  if (asset.source === 'zerolu') {
    const { loadDemoPrompt } = await import('../data/zeroLuDemos.js');
    const prompt = await loadDemoPrompt(asset.slug);
    showPromptModal({ title: asset.title, prompt: prompt || '' });
    return;
  }
}

function showPromptModal({ title, prompt }) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#141414;border:1px solid #27272a;border-radius:14px;max-width:640px;width:100%;max-height:80vh;overflow:hidden;display:flex;flex-direction:column;';

  const header = document.createElement('div');
  header.style.cssText = 'padding:16px 20px;border-bottom:1px solid #27272a;display:flex;align-items:center;justify-content:space-between;';
  const titleEl = document.createElement('h3');
  titleEl.textContent = title || 'Prompt';
  titleEl.style.cssText = 'color:#d9ff00;font-size:14px;font-weight:700;margin:0;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'background:#141414;color:#a1a1aa;border:1px solid #27272a;border-radius:8px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.style.cssText = 'padding:20px;overflow-y:auto;';
  const promptEl = document.createElement('p');
  promptEl.textContent = prompt || '';
  promptEl.style.cssText = 'color:#fff;font-size:13px;line-height:1.6;white-space:pre-wrap;';
  body.appendChild(promptEl);

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);

  const close = () => overlay.remove();
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.body.appendChild(overlay);
}
