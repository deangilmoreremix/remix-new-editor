/**
 * Shared studio button factory.
 *
 * Use this instead of inline className strings so the generate-button
 * design stays consistent across ImageStudio, VideoStudio, and any
 * future studio.
 */

export function createStudioButton({
  text = '',
  emoji = '',
  variant = 'primary',
  loading = false,
  className = '',
  ariaLabel,
  tooltip,
}) {
  const btn = document.createElement('button');
  btn.type = 'button';

  const base =
    'inline-flex items-center justify-center gap-2.5 font-black text-sm md:text-base transition-all';

  const shapes = {
    primary:
      'px-6 md:px-8 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] shadow-lg w-full sm:w-auto',
    secondary:
      'px-4 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10',
    icon: 'w-10 h-10 rounded-xl flex items-center justify-center',
  };

  const colors = {
    primary:
      'bg-primary text-black hover:shadow-glow hover:scale-105 active:scale-95',
    secondary: 'text-white hover:text-primary',
    icon: 'bg-white/5 text-white hover:bg-white/10 hover:text-primary',
  };

  btn.className = [
    base,
    shapes[variant] ?? shapes.primary,
    colors[variant] ?? colors.primary,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
  if (tooltip) btn.setAttribute('data-tooltip', tooltip);

  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-2 text-black">◌</span> Generating...`;
  } else if (emoji) {
    btn.innerHTML = `${text} ${emoji}`;
  } else {
    btn.textContent = text;
  }

  return btn;
}
