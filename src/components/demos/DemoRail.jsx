// DemoRail.jsx
//
// Studio-facing wrapper: a rail (or grid) of <DemoCard>s that owns the
// "which demo is open" state and renders <DemoDetailModal> for it.
//
// The studios in this app are vanilla DOM factories (VideoStudio.js,
// TemplateStudio.js return an HTMLElement), so createDemoRail() mirrors the
// existing createExamplesRail() convention from src/lib/examplesRail.js: it
// returns a detached node with a .cleanup() method, letting a studio mount the
// React tree with a single appendChild and no JSX of its own.

import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoCard } from './DemoCard.jsx';
import { DemoDetailModal } from './DemoDetailModal.jsx';
import { assetSlug } from './assetShape.js';

export function DemoRail({
  items = [],
  source = 'minimax',
  variant = 'rail',
  title,
  subtitle,
  onUse,
}) {
  const [active, setActive] = useState(null);

  const handleOpen = useCallback((asset) => setActive(asset), []);
  const handleClose = useCallback(() => setActive(null), []);

  if (!items.length) return null;

  const isRail = variant === 'rail';

  return (
    <section className="sv-demo-rail w-full" data-demo-rail={source} data-demo-variant={variant}>
      {title || subtitle ? (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white/70">
                {title}
              </h3>
            ) : null}
            {subtitle ? <p className="mt-0.5 text-xs text-white/40">{subtitle}</p> : null}
          </div>
          <span className="shrink-0 text-[11px] text-white/30">{items.length} styles</span>
        </div>
      ) : null}

      <div
        className={
          isRail
            ? 'mmx-scroller flex gap-3 overflow-x-auto pb-3 -mx-1 px-1'
            : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
        }
      >
        {items.map((asset, index) => (
          <DemoCard
            key={assetSlug(asset) || index}
            asset={asset}
            source={source}
            variant={variant}
            onOpen={handleOpen}
            onUse={onUse}
          />
        ))}
      </div>

      <DemoDetailModal asset={active} source={source} onClose={handleClose} />
    </section>
  );
}

/**
 * Build (but do not append) a demo rail as a plain DOM node.
 * Mirrors createExamplesRail(): the caller decides where it goes.
 *
 * @param {object}  options              forwarded to <DemoRail>
 * @param {string} [options.className]   extra classes on the host element
 * @returns {HTMLElement} host node with a `cleanup()` method
 */
export function createDemoRail(options = {}) {
  const { className = '', ...props } = options;

  const host = document.createElement('div');
  host.className = `sv-demo-rail-host w-full ${className}`.trim();

  const root = createRoot(host);
  root.render(<DemoRail {...props} />);

  host.cleanup = () => {
    // Deferred: React refuses to unmount synchronously from inside a render or
    // a lifecycle the router may still be unwinding.
    setTimeout(() => root.unmount(), 0);
  };

  return host;
}

export default DemoRail;
