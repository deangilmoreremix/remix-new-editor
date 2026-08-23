const STUDIO_META = {
  T: { label: 'Template Studio', sublabel: 'Browse & create from templates', route: 'template' },
  C: { label: 'Cinema Template Studio', sublabel: 'Cinematic template playback', route: 'cinema-template' },
  F: { label: 'Cinema Studio', sublabel: 'Direct cinematic scene creation', route: 'cinema' },
  V: { label: 'Video Studio', sublabel: 'Text/image to video', route: 'video' },
  I: { label: 'Image Studio', sublabel: 'Text/image to image', route: 'image' },
};

export function createStudioIconTooltip(icon, templateId, prompt, onClick) {
  const meta = STUDIO_META[icon];
  if (!meta) return null;

  const tooltipId = `studio-tooltip-${icon}-${templateId || 'prompt'}`;

  const wrap = document.createElement('div');
  wrap.className = 'studio-icon-tooltip-wrap';
  wrap.setAttribute('data-tooltip-for', tooltipId);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'studio-icon-btn';
  button.setAttribute('data-tooltip-id', tooltipId);
  button.setAttribute('data-studio-route', meta.route);
  button.setAttribute('data-prompt', prompt || '');
  button.setAttribute('aria-label', meta.label);
  button.title = meta.label;
  button.textContent = icon;

  button.addEventListener('click', () => {
    if (typeof onClick === 'function') {
      onClick(meta.route, prompt);
    }
  });

  const tooltip = document.createElement('div');
  tooltip.className = 'studio-icon-tooltip';
  tooltip.id = tooltipId;
  tooltip.setAttribute('role', 'tooltip');

  const title = document.createElement('div');
  title.className = 'studio-icon-tooltip-title';
  title.textContent = meta.label;

  const sub = document.createElement('div');
  sub.className = 'studio-icon-tooltip-sub';
  sub.textContent = meta.sublabel;

  const arrow = document.createElement('div');
  arrow.className = 'studio-icon-tooltip-arrow';

  tooltip.appendChild(title);
  tooltip.appendChild(sub);
  tooltip.appendChild(arrow);

  wrap.appendChild(button);
  wrap.appendChild(tooltip);

  return wrap;
}
