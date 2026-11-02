'use client';
import type { ReactNode, MouseEvent } from 'react';

export const DEMO_ACTION_LABELS = {
  viewPrompt: 'View Prompt',
  personalize: 'Personalize This Demo',
  createStyle: 'Create This Style',
} as const;

export type DemoActionHandlers = {
  onViewPrompt: (event: MouseEvent<HTMLButtonElement>) => void;
  onPersonalize: (event: MouseEvent<HTMLButtonElement>) => void;
  onCreateStyle?: (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
};

export type DemoTemplateActionsProps = DemoActionHandlers & {
  /** Optional href for the primary create action. When provided, the create action renders as an anchor. */
  createHref?: string;
  /** Optional additional class names for the action container. */
  className?: string;
  /** Accessible label describing the action group. */
  ariaLabel?: string;
  /** Optional override for the create button content. Use only for icons/suffixes, not for replacing the label. */
  createChildren?: ReactNode;
  /** Optional click handler for the create action. When omitted and createHref is provided, the anchor navigates normally. */
  onCreateStyle?: (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
};

const baseButtonClasses =
  'inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]';
const createButtonClasses =
  'inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 px-4 py-2.5 text-sm font-bold text-black shadow-glow transition hover:scale-[1.01]';

export function DemoTemplateActions({
  onViewPrompt,
  onPersonalize,
  onCreateStyle,
  createHref,
  className,
  ariaLabel = 'Demo actions',
  createChildren,
}: DemoTemplateActionsProps) {
  return (
    <div className={className} aria-label={ariaLabel}>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onViewPrompt} className={baseButtonClasses}>
          {DEMO_ACTION_LABELS.viewPrompt}
        </button>
        <button type="button" onClick={onPersonalize} className={baseButtonClasses}>
          {DEMO_ACTION_LABELS.personalize}
        </button>
        {createHref ? (
          <a
            href={createHref}
            onClick={onCreateStyle}
            className={createButtonClasses}
          >
            {createChildren ?? DEMO_ACTION_LABELS.createStyle}
          </a>
        ) : (
          <button type="button" onClick={onCreateStyle} className={createButtonClasses}>
            {createChildren ?? DEMO_ACTION_LABELS.createStyle}
          </button>
        )}
      </div>
    </div>
  );
}
