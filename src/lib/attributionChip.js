/**
 * Attribution Chip
 *
 * Renders a small attribution badge for Pexels media.
 * Use in studios to show "Photo by <name> on Pexels" with links.
 */

export function renderAttributionChip(asset, container) {
  if (!container) return null;

  const chip = document.createElement('div');
  chip.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/80';

  const icon = document.createElement('span');
  icon.textContent = '📷';
  chip.appendChild(icon);

  const photographer = asset.photographer || (asset.user && asset.user.name) || '';
  if (photographer) {
    const photographerUrl = asset.photographer_url || (asset.user && asset.user.url) || 'https://www.pexels.com';
    const link = document.createElement('a');
    link.href = photographerUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'text-primary hover:underline font-medium';
    link.textContent = photographer;
    chip.appendChild(link);
  }

  const onPexels = document.createElement('span');
  onPexels.className = 'text-muted';
  onPexels.textContent = 'on';
  chip.appendChild(onPexels);

  const pexelsLink = document.createElement('a');
  pexelsLink.href = asset.url || asset.pexelsUrl || 'https://www.pexels.com';
  pexelsLink.target = '_blank';
  pexelsLink.rel = 'noopener noreferrer';
  pexelsLink.className = 'text-primary hover:underline font-medium';
  pexelsLink.textContent = 'Pexels';
  chip.appendChild(pexelsLink);

  container.appendChild(chip);
  return chip;
}
