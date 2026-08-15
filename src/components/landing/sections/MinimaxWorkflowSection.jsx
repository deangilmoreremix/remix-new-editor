// "One Creative Platform. Every AI Workflow."
//
// Uses the Ice Gunslinger interactive web loop as the centrepiece and wraps it
// in product UI so the AI video reads as if it is driving the interface.
// The video never actually controls the page — a lightweight step cycle drives
// the labels, and it only runs while the section is on screen.

import { requireDemo } from '../../../data/minimaxH3Demos.js';
import { createMediaFrame, cleanupFrames, prefersReducedMotion, revealOnScroll } from './minimax/mediaFrame.js';
import { injectMinimaxStyles, sectionHeading, createStyleLink, escapeHtml } from './minimax/ui.js';
import { handleViewPrompt } from './minimax/DemoPromptModal.js';
import { createViewPromptButton } from './minimax/ui.js';

const DEMO_SLUG = 'ice-gunslinger-interactive-web-loop';

/** The product pipeline, cycled in order. */
const WORKFLOW_STEPS = [
  { label: 'Generate', detail: 'Prompt to first frame', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { label: 'Animate', detail: 'Motion, camera, timing', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
  { label: 'Edit', detail: 'Cut, retime, refine', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { label: 'Upscale', detail: 'Up to crisp delivery res', icon: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4' },
  { label: 'Publish', detail: 'Export for every channel', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
];

/** Interaction states the loop demonstrates. */
const INTERACTION_STATES = ['Loading', 'Hover', 'Click', 'Scroll', 'Drag', 'Carousel'];

export function MinimaxWorkflowSection() {
  injectMinimaxStyles();

  const demo = requireDemo(DEMO_SLUG);
  const reduced = prefersReducedMotion();

  const section = document.createElement('section');
  section.id = 'ai-workflow';
  section.className = 'relative overflow-hidden bg-[#020205] px-5 py-20 sm:px-6 md:py-28';
  section.setAttribute('aria-labelledby', 'mmx-workflow-heading');
  section.setAttribute('data-testid', 'minimax-workflow-section');

  section.innerHTML = `
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(34,211,238,0.05),transparent_70%)]" aria-hidden="true"></div>

    <div class="container relative z-10 mx-auto max-w-7xl">
      ${sectionHeading({
        eyebrow: 'End-to-end pipeline',
        title: 'One Creative Platform.',
        accent: 'Every AI Workflow.',
        subtitle:
          'Generate, animate, edit, upscale and publish without leaving the platform or exporting between five different tools.',
        id: 'mmx-workflow-heading',
      })}

      <div class="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">

        <!-- workflow steps -->
        <ol class="order-2 min-w-0 space-y-2.5 lg:order-1" data-mmx-steps>
          ${WORKFLOW_STEPS.map(
            (step, index) => `
            <li>
              <div
                data-mmx-step="${index}"
                class="mmx-reveal flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5 transition-all duration-500"
              >
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors duration-500" data-mmx-step-icon>
                  <svg class="h-4 w-4 text-white/50 transition-colors duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="${step.icon}"/>
                  </svg>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-bold text-white">${escapeHtml(step.label)}</span>
                  <span class="block text-xs text-gray-500">${escapeHtml(step.detail)}</span>
                </span>
                <span class="text-[10px] font-semibold tabular-nums text-white/25">0${index + 1}</span>
              </div>
            </li>`
          ).join('')}
        </ol>

        <!-- media + surrounding UI chrome -->
        <div class="order-1 min-w-0 lg:order-2">
          <div class="mmx-reveal relative overflow-hidden rounded-2xl border border-white/10 bg-[#05070b] shadow-2xl shadow-black/50">

            <!-- fake app chrome -->
            <div class="flex items-center gap-2 border-b border-white/8 bg-white/[0.02] px-4 py-2.5">
              <span class="flex gap-1.5" aria-hidden="true">
                <span class="h-2.5 w-2.5 rounded-full bg-white/12"></span>
                <span class="h-2.5 w-2.5 rounded-full bg-white/12"></span>
                <span class="h-2.5 w-2.5 rounded-full bg-white/12"></span>
              </span>
              <span class="ml-2 min-w-0 flex-1 truncate text-[11px] font-medium text-white/40">smartvideo · ${escapeHtml(demo.title)}</span>
              <span class="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5">
                <span class="h-1 w-1 rounded-full bg-cyan-400"></span>
                <span class="text-[10px] font-semibold uppercase tracking-wider text-cyan-300" data-mmx-state>Loading</span>
              </span>
            </div>

            <div class="relative" data-mmx-workflow-media></div>

            <!-- progress rail reads as the active pipeline stage -->
            <div class="border-t border-white/8 bg-white/[0.02] px-4 py-3">
              <div class="mb-2 flex items-center justify-between">
                <span class="text-[11px] font-semibold text-white/70" data-mmx-stage-label>Generate</span>
                <span class="text-[10px] tabular-nums text-white/35" data-mmx-stage-count>01 / 05</span>
              </div>
              <div class="h-1 w-full overflow-hidden rounded-full bg-white/8">
                <div class="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-700 ease-out" style="width: 20%" data-mmx-progress></div>
              </div>
            </div>
          </div>

          <!-- interaction state chips -->
          <ul class="mmx-reveal mt-4 flex flex-wrap gap-2" data-mmx-interactions aria-label="Interaction states demonstrated">
            ${INTERACTION_STATES.map(
              (state, index) => `
              <li>
                <span
                  data-mmx-interaction="${index}"
                  class="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/55 transition-all duration-500"
                >${escapeHtml(state)}</span>
              </li>`
            ).join('')}
          </ul>

          <div class="mmx-reveal mt-5 flex flex-wrap items-center gap-2.5" data-mmx-workflow-cta></div>
        </div>
      </div>
    </div>
  `;

  /* ------------------------------------------------------------------ media */

  const mediaHost = section.querySelector('[data-mmx-workflow-media]');
  const frame = createMediaFrame(demo, {
    mode: 'inview',
    ratio: 959 / 540, // native ratio for this clip — no distortion, no CLS
    className: 'w-full',
    ariaLabel: `${demo.title} — interactive web loop demo`,
  });
  mediaHost.appendChild(frame);

  /* -------------------------------------------------------------------- CTAs */

  const ctaHost = section.querySelector('[data-mmx-workflow-cta]');
  ctaHost.appendChild(createViewPromptButton(demo, handleViewPrompt));
  ctaHost.appendChild(createStyleLink(demo, { label: 'Create This Style' }));

  /* -------------------------------------------------------------- step cycle */

  const stepEls = Array.from(section.querySelectorAll('[data-mmx-step]'));
  const interactionEls = Array.from(section.querySelectorAll('[data-mmx-interaction]'));
  const stateLabel = section.querySelector('[data-mmx-state]');
  const stageLabel = section.querySelector('[data-mmx-stage-label]');
  const stageCount = section.querySelector('[data-mmx-stage-count]');
  const progress = section.querySelector('[data-mmx-progress]');

  const ACTIVE_STEP = ['border-cyan-400/45', 'bg-cyan-400/[0.07]'];
  const ACTIVE_CHIP = ['border-cyan-400/45', 'bg-cyan-400/10', 'text-cyan-200'];

  function applyStep(index) {
    stepEls.forEach((el, i) => {
      const active = i === index;
      el.classList.toggle(ACTIVE_STEP[0], active);
      el.classList.toggle(ACTIVE_STEP[1], active);
      const icon = el.querySelector('[data-mmx-step-icon]');
      const svg = el.querySelector('svg');
      icon?.classList.toggle('border-cyan-400/40', active);
      icon?.classList.toggle('bg-cyan-400/10', active);
      svg?.classList.toggle('text-cyan-300', active);
      svg?.classList.toggle('text-white/50', !active);
    });

    interactionEls.forEach((el, i) => {
      const active = i === index % interactionEls.length;
      ACTIVE_CHIP.forEach((cls) => el.classList.toggle(cls, active));
      el.classList.toggle('text-white/55', !active);
    });

    const step = WORKFLOW_STEPS[index];
    stageLabel.textContent = step.label;
    stageCount.textContent = `0${index + 1} / 0${WORKFLOW_STEPS.length}`;
    progress.style.width = `${((index + 1) / WORKFLOW_STEPS.length) * 100}%`;
    stateLabel.textContent = INTERACTION_STATES[index % INTERACTION_STATES.length];
  }

  applyStep(0);

  let cycleTimer = null;
  let cursor = 0;

  function startCycle() {
    if (cycleTimer || reduced) return;
    cycleTimer = window.setInterval(() => {
      cursor = (cursor + 1) % WORKFLOW_STEPS.length;
      applyStep(cursor);
    }, 2600);
  }

  function stopCycle() {
    if (!cycleTimer) return;
    window.clearInterval(cycleTimer);
    cycleTimer = null;
  }

  // Only animate while the section is actually visible.
  let visibilityObserver = null;
  if (typeof IntersectionObserver !== 'undefined') {
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? startCycle() : stopCycle()));
      },
      { threshold: 0.2 }
    );
    visibilityObserver.observe(section);
  }

  const onVisibilityChange = () => (document.hidden ? stopCycle() : null);
  document.addEventListener('visibilitychange', onVisibilityChange);

  /* ------------------------------------------------------------------ reveal */

  const disposeReveal = revealOnScroll(section.querySelectorAll('.mmx-reveal'));

  section.cleanup = () => {
    stopCycle();
    visibilityObserver?.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    disposeReveal();
    cleanupFrames(section);
  };

  return section;
}

export default MinimaxWorkflowSection;
