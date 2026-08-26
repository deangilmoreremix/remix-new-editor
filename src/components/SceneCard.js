/**
 * Scene card component for OpenMontage storyboard.
 * Returns an HTML string for vanilla JS rendering.
 *
 * @param {Object} scene - Scene data
 * @param {number} scene.index - Scene index
 * @param {string} scene.label - Scene label
 * @param {string} scene.status - Scene status (DONE, RENDERING, QUEUED, FAILED)
 * @param {string} scene.type - Scene type (MOTION GFX, STOCK, etc.)
 * @param {string} scene.time - Scene duration
 * @param {string} scene.cost - Scene cost
 * @param {number} index - Scene index for display
 * @param {Function} onRegenerate - Callback for regenerate button
 * @returns {string} HTML string
 */
export function SceneCard(scene, index, onRegenerate) {
  const statusStyles = {
    DONE: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5',
    RENDERING: 'text-primary border-primary/30 bg-primary/5',
    QUEUED: 'text-white/60 border-white/10 bg-white/5',
    FAILED: 'text-red-400 border-red-400/30 bg-red-400/5',
    UNLOCKED: 'text-white/80 border-white/20 bg-white/5',
  };

  const statusIcons = {
    DONE: '✓',
    RENDERING: '◌',
    QUEUED: '○',
    FAILED: '✕',
    UNLOCKED: '◯',
  };

  const style = statusStyles[scene.status] || statusStyles.QUEUED;
  const icon = statusIcons[scene.status] || statusIcons.QUEUED;
  const isFailed = scene.status === 'FAILED';
  const isRendering = scene.status === 'RENDERING';

  return `
    <div class="border border-white/10 rounded-2xl p-3 md:p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-all"
         data-scene-index="${index}">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-black text-white/60">SC ${String(index).padStart(2, '0')}</span>
          <span class="text-xs font-bold text-white">${scene.label}</span>
        </div>
        <span class="text-[10px] font-black px-2 py-0.5 rounded-lg border ${style}">
          ${icon} ${scene.status}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-[11px] text-white/60">${scene.type}</span>
          <span class="text-[11px] text-muted">${scene.time}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-black text-white">${scene.cost}</span>
          <button class="om-regenerate-scene px-2 py-1 ${isFailed ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10'} rounded-lg text-[10px] font-bold transition-all"
                  data-scene-index="${index}">
            ${isFailed ? '↻ Retry' : '↻ Regenerate'}
          </button>
        </div>
      </div>
      ${isRendering ? `
        <div class="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
          <div class="h-full bg-primary animate-pulse" style="width: ${scene.progress || 30}%"></div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render a list of scene cards to a container element.
 *
 * @param {HTMLElement} container - Container element
 * @param {Array} scenes - Array of scene objects
 * @param {Function} onRegenerate - Callback for regenerate buttons
 */
export function renderSceneCards(container, scenes, onRegenerate) {
  if (!container) return;
  container.innerHTML = scenes.map((scene, i) => SceneCard(scene, i, onRegenerate)).join('');

  // Attach event listeners
  container.querySelectorAll('.om-regenerate-scene').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.sceneIndex || '0', 10);
      onRegenerate?.(index);
    });
  });
}

export default SceneCard;
