// DemoDetailModal.jsx
//
// Detail view for a clicked demo (roadmap §2.3). Built on the behaviour
// contract of src/components/landing/sections/minimax/DemoPromptModal.js:
//   - Tab is trapped inside the panel, Escape closes,
//   - focus returns to whatever opened the modal,
//   - the page behind is scroll-locked, the panel scrolls internally,
//   - role="dialog" + aria-modal + aria-labelledby/aria-describedby,
//   - prompt text is fetched lazily via loadDemoPrompt() so it costs nothing
//     until the modal is actually opened.
//
// Differences from the landing modal: a full-bleed inview player instead of a
// text-only panel, the extracted style params, an editable "Tweak prompt"
// field, and the studio-token "Create This Style" CTA.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createMediaFrame } from '../landing/sections/minimax/mediaFrame.js';
import {
  categoryBadge,
  injectMinimaxStyles,
} from '../landing/sections/minimax/ui.js';
import { MINIMAX_MODEL, loadDemoPrompt } from '../../data/minimaxH3Demos.js';
import { createThisStyle } from '../../lib/minimax/createThisStyle.js';
import { describeAsset, toMediaDemo, sourceLabel, sourceTone } from './assetShape.js';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea',
  'input',
  'select',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Scroll lock. Uses its own dataset keys so it can never clobber the values
 * DemoPromptModal.js stashes under `mmxPrev*`.
 */
function lockScroll() {
  const { body } = document;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  body.dataset.svDemoPrevOverflow = body.style.overflow || '';
  body.dataset.svDemoPrevPadding = body.style.paddingRight || '';
  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
}

function unlockScroll() {
  const { body } = document;
  body.style.overflow = body.dataset.svDemoPrevOverflow || '';
  body.style.paddingRight = body.dataset.svDemoPrevPadding || '';
  delete body.dataset.svDemoPrevOverflow;
  delete body.dataset.svDemoPrevPadding;
}

function MetaCell({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-white/90">{value || '—'}</dd>
    </div>
  );
}

export function DemoDetailModal({ asset, source = 'minimax', onClose }) {
  const info = useMemo(() => (asset ? describeAsset(asset) : null), [asset]);
  const mediaDemo = useMemo(() => (asset ? toMediaDemo(asset) : null), [asset]);

  const panelRef = useRef(null);
  const hostRef = useRef(null);
  const closeRef = useRef(null);
  const openerRef = useRef(null);
  const aliveRef = useRef(true);

  const [prompt, setPrompt] = useState('');
  const [promptState, setPromptState] = useState('loading'); // loading | ready | empty | error
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [entered, setEntered] = useState(false);

  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') onClose();
  }, [onClose]);

  useEffect(() => {
    injectMinimaxStyles();
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /* ------------------------------------------------- scroll lock + focus mgmt */

  useEffect(() => {
    if (!asset) return undefined;

    openerRef.current = document.activeElement;
    lockScroll();
    // Match the landing modal's enter transition (.mmx-modal-backdrop.mmx-open).
    const raf = requestAnimationFrame(() => setEntered(true));
    const focusTimer = setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 0);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(focusTimer);
      unlockScroll();
      const opener = openerRef.current;
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [asset]);

  /* ----------------------------------------------------- Escape + focus trap */

  useEffect(() => {
    if (!asset) return undefined;

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [asset, handleClose]);

  /* --------------------------------------------------------- full-bleed player */

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !mediaDemo) return undefined;

    const frame = createMediaFrame(mediaDemo, {
      mode: 'inview',
      priority: true,
      ariaLabel: `${mediaDemo.title} preview`,
      className: 'absolute inset-0 h-full w-full',
      // The detail view is where aspect honesty matters, so letterbox rather
      // than crop a 9:16 / 40:17 source.
      objectFit: 'contain',
    });
    host.appendChild(frame);

    return () => {
      frame.cleanup?.();
      frame.remove();
    };
  }, [mediaDemo]);

  /* ------------------------------------------------------------- prompt load */

  useEffect(() => {
    if (!asset || !info) return undefined;

    // Presets and academy assets carry their prompt inline; MiniMax demos keep
    // it in a lazy chunk.
    if (info.prompt) {
      setPrompt(info.prompt);
      setPromptState('ready');
      return undefined;
    }

    let cancelled = false;
    setPromptState('loading');

    loadDemoPrompt(info.slug)
      .then((text) => {
        if (cancelled || !aliveRef.current) return;
        if (text) {
          setPrompt(text);
          setPromptState('ready');
        } else {
          setPrompt('');
          setPromptState('empty');
        }
      })
      .catch(() => {
        if (cancelled || !aliveRef.current) return;
        setPromptState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [asset, info]);

  /* -------------------------------------------------------------------- CTA */

  const handleCreate = useCallback(async () => {
    if (!info || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      // Honour an edited prompt through the channel the studios already read
      // first on mount (VideoStudio.js reads localStorage 'prefill_prompt'
      // ahead of the staged payload), so a tweak is never silently dropped.
      const tweaked = prompt.trim();
      if (tweaked) {
        try {
          localStorage.setItem('prefill_prompt', tweaked);
        } catch {
          /* storage unavailable — the staged preset prompt still applies */
        }
      }
      await createThisStyle(info.slug);
      handleClose();
    } catch (error) {
      console.error('[DemoDetailModal] "Create This Style" failed', error);
      if (aliveRef.current) setFailed(true);
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [busy, handleClose, info, prompt]);

  if (!asset || !info) return null;

  const titleId = `sv-demo-title-${info.slug}`;
  const descId = `sv-demo-desc-${info.slug}`;

  return createPortal(
    <div
      className={`mmx-modal-backdrop fixed inset-0 z-[130] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6 ${
        entered ? 'mmx-open' : ''
      }`}
      data-demo-modal={info.slug}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        ref={panelRef}
        className="mmx-modal-panel flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#080a10] shadow-2xl shadow-black/60 sm:max-h-[88vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/15 sm:hidden"
          aria-hidden="true"
        />

        <header className="flex shrink-0 items-start gap-4 border-b border-white/8 px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0 flex-1">
            <span
              dangerouslySetInnerHTML={{
                __html: categoryBadge(sourceLabel(source), { tone: sourceTone(source) }),
              }}
            />
            <h2 id={titleId} className="mt-2 text-lg font-bold leading-snug text-white sm:text-xl">
              {info.title}
            </h2>
            <p id={descId} className="mt-1 text-sm text-gray-400">
              {info.useCase || `${info.category} style reference`}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={handleClose}
            aria-label="Close demo details"
            className="shrink-0 rounded-lg border border-white/10 p-2 text-white/60 transition hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        <div className="mmx-prompt-scroll min-h-0 flex-1 overflow-y-auto">
          {/* Full-bleed player */}
          <div
            ref={hostRef}
            className="relative w-full bg-black"
            style={{ aspectRatio: info.ratioNumber }}
          />

          <dl className="grid grid-cols-2 gap-4 border-b border-white/8 px-5 py-4 sm:grid-cols-4 sm:px-7">
            <MetaCell label="Model" value={MINIMAX_MODEL} />
            <MetaCell label="Duration" value={info.duration} />
            <MetaCell label="Aspect ratio" value={info.ratio} />
            <MetaCell label="Category" value={info.category} />
          </dl>

          {info.tags.length ? (
            <div className="border-b border-white/8 px-5 py-4 sm:px-7">
              <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Style tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {info.tags.map((tag) => (
                  <span
                    key={tag}
                    dangerouslySetInnerHTML={{ __html: categoryBadge(tag, { tone: 'neutral' }) }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="px-5 py-5 sm:px-7">
            <label
              htmlFor={`sv-demo-prompt-${info.slug}`}
              className="mb-2.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40"
            >
              Tweak prompt
            </label>

            {promptState === 'loading' ? (
              <div className="space-y-2" aria-live="polite" aria-busy="true">
                <div className="h-3 w-11/12 animate-pulse rounded bg-white/8" />
                <div className="h-3 w-full animate-pulse rounded bg-white/8" />
                <div className="h-3 w-9/12 animate-pulse rounded bg-white/8" />
              </div>
            ) : (
              <textarea
                id={`sv-demo-prompt-${info.slug}`}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={6}
                spellCheck={false}
                placeholder={
                  promptState === 'error'
                    ? 'Could not load the original prompt — write your own.'
                    : 'Describe the shot you want in this style…'
                }
                className="w-full resize-y rounded-xl border border-white/10 bg-black/40 p-3.5 font-mono text-[13px] leading-[1.7] text-gray-200 transition-colors placeholder:text-white/25 focus:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:text-sm"
              />
            )}

            {promptState === 'error' ? (
              <p role="alert" className="mt-2 text-xs text-red-400/80">
                Could not load the original prompt. You can still write your own above.
              </p>
            ) : null}

            {info.sourceUrl ? (
              <p className="mt-5 border-t border-white/8 pt-4 text-xs text-white/35">
                Reference clip by {info.author || 'unknown'} ·{' '}
                <a
                  href={info.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary/80 underline-offset-4 hover:text-primary hover:underline"
                >
                  original post
                </a>
              </p>
            ) : null}

            {info.rightsNote ? (
              <p className="mt-2 text-[11px] leading-relaxed text-white/25">{info.rightsNote}</p>
            ) : null}
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-2.5 border-t border-white/8 bg-white/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          {failed ? (
            <p role="alert" className="text-xs text-red-400/80">
              Could not open that style. Please try again.
            </p>
          ) : (
            <span className="text-[11px] text-white/30">
              Opens {info.targetStudio || 'the mapped studio'} pre-filled with this style.
            </span>
          )}
          <button
            type="button"
            data-mmx-cta="create-style"
            data-studio={info.targetStudio || ''}
            aria-label={`Create this style: ${info.title}`}
            disabled={busy}
            onClick={handleCreate}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-black transition-all duration-300 hover:shadow-glow active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-wait disabled:opacity-70 sm:ml-auto"
          >
            {busy ? 'Spinning up…' : 'Create This Style'}
            {busy ? null : (
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            )}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

export default DemoDetailModal;
