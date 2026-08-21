import { getCreateTarget, minimaxH3Demos } from '../data/minimaxH3Demos.js';
import { getAcademyCreateTarget } from '../data/academyStudioAdapters.js';
import { navigate, getCurrentPage } from './router.js';

const AUTO_GENERATE_TIMEOUT = 10000;
const AUTO_GENERATE_POLL = 250;

function findGenerateButton() {
  return Array.from(document.querySelectorAll('button')).find((btn) => {
    const text = (btn.textContent || '').trim();
    return /^Generate\b/.test(text) && !btn.disabled && btn.offsetParent !== null;
  }) || null;
}

function waitForGenerateButton(timeout) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;
    const tick = () => {
      const btn = findGenerateButton();
      if (btn) return resolve(btn);
      if (Date.now() >= deadline) return resolve(null);
      setTimeout(tick, AUTO_GENERATE_POLL);
    };
    tick();
  });
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
      scheduleAutoGenerate('video');
      return;
    }
    navigate(result.route, result.params);
    scheduleAutoGenerate(result.route);
  }
}

let pollTimer = null;

function scheduleAutoGenerate(expectedRoute) {
  if (typeof window === 'undefined') return;
  if (pollTimer) clearTimeout(pollTimer);
  window.__pendingAutoGenerate = { expectedRoute, startedAt: Date.now() };
  tryAutoGenerateFromExample();
}

function clearAutoGenerateSchedule() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  window.__pendingAutoGenerate = null;
}

if (typeof window !== 'undefined') {
  document.addEventListener('route-changed', () => {
    tryAutoGenerateFromExample();
  });
}

export async function tryAutoGenerateFromExample() {
  if (typeof window === 'undefined') return;
  const pending = window.__pendingAutoGenerate;
  if (!pending) return;

  try {
    const elapsed = Date.now() - pending.startedAt;
    if (elapsed > AUTO_GENERATE_TIMEOUT) {
      clearAutoGenerateSchedule();
      return;
    }

    const current = getCurrentPage();
    if (!current || current !== pending.expectedRoute) {
      pollTimer = setTimeout(() => tryAutoGenerateFromExample(), AUTO_GENERATE_POLL);
      return;
    }

    const btn = await waitForGenerateButton(Math.max(0, AUTO_GENERATE_TIMEOUT - elapsed));
    if (!btn) {
      clearAutoGenerateSchedule();
      return;
    }

    clearAutoGenerateSchedule();
    btn.click();
  } catch (err) {
    clearAutoGenerateSchedule();
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
    showPromptModal({ title: asset.title, prompt: asset.prompt || '' });
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
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'background:#141414;color:#a1a1aa;border:1px solid #27272a;border-radius:8px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.style.cssText = 'padding:20px;overflow-y:auto;flex:1;min-height:0;';
  const promptEl = document.createElement('p');
  promptEl.textContent = prompt || '';
  promptEl.style.cssText = 'color:#fff;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;';
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
