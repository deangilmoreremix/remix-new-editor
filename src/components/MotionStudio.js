// Motion Studio: upstream's Recast and Motion Control studios on one page.
// `?mode=control` opens Motion Control directly.

import { createSegmented } from './studio/promptComposer.js';
import { createMotionPanel } from './studios/MotionPanels.js';

export function MotionStudio() {
  const root = document.createElement('div');
  root.className = 'w-full h-full flex flex-col bg-app-bg overflow-hidden relative';

  const bar = document.createElement('div');
  bar.className = 'flex items-center justify-center gap-3 px-4 py-2 border-b border-white/5 bg-app-bg shrink-0 z-20';
  const body = document.createElement('div');
  body.className = 'flex-1 min-h-0 relative';

  const hosts = {};
  const panels = {};
  for (const kind of ['recast', 'control']) {
    const host = document.createElement('div');
    host.className = 'absolute inset-0 overflow-y-auto custom-scrollbar hidden p-4 md:p-6';
    host.dataset.motionHost = kind;
    hosts[kind] = host;
    body.appendChild(host);
  }

  const show = (kind) => {
    for (const [k, host] of Object.entries(hosts)) host.classList.toggle('hidden', k !== kind);
    if (!panels[kind]) {
      panels[kind] = createMotionPanel(kind === 'control' ? 'motion-control' : 'recast');
      hosts[kind].appendChild(panels[kind]);
    }
    try {
      const url = new URL(window.location.href);
      if (kind === 'control') url.searchParams.set('mode', 'control'); else url.searchParams.delete('mode');
      window.history.replaceState({}, '', url);
    } catch { /* ignore */ }
  };

  const toggle = createSegmented([{ value: 'recast', label: 'Recast' }, { value: 'control', label: 'Motion control' }], 'recast', show);
  bar.appendChild(toggle);
  root.append(bar, body);

  const initial = new URLSearchParams(window.location.search).get('mode') === 'control' ? 'control' : 'recast';
  if (initial === 'control') toggle.setValue('control');
  show(initial);
  return root;
}
