// [remix] Shared dialog shell for Edit-tab modals: backdrop, header (icon, title, subtitle, context chip, close), optional toolbar,
// scrolling body and optional footer. Handles Escape, backdrop click, focus on open / restore on close, and the dialog roles.
// Styles: styles/modal-shell.css (CineGen tokens). Labels passed in as props (ariaLabel, closeLabel) are the caller's, so they stay
// resolvable by the hover-help layer.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import '../../styles/modal-shell.css';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Small pill in the header, e.g. the clip the modal acts on. */
  chip?: ReactNode;
  /** Accessible name of the dialog (defaults to the title). */
  ariaLabel?: string;
  /** Accessible name of the close button. */
  closeLabel?: string;
  width?: number | string;
  height?: number | string;
  toolbar?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  /** Extra class on the dialog element (e.g. a legacy hook such as `occ-library`). */
  className?: string;
  testId?: string;
  children: ReactNode;
}

export function ModalShell({ title, subtitle, icon, chip, ariaLabel, closeLabel = 'Close', width = 760, height, toolbar, footer, onClose, className, testId, children }: ModalShellProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); previous?.focus?.(); };
  }, []);

  return (
    <div className={`cg-modal__backdrop${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={ariaLabel ?? title} aria-labelledby={ariaLabel ? undefined : titleId} data-testid={testId}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cg-modal" ref={dialogRef} tabIndex={-1} style={{ width, height }}>
        <div className="cg-modal__header">
          {icon != null && <div className="cg-modal__icon" aria-hidden="true">{icon}</div>}
          <div className="cg-modal__titles">
            <h2 className="cg-modal__title" id={titleId}>{title}</h2>
            {subtitle && <p className="cg-modal__subtitle">{subtitle}</p>}
          </div>
          {chip != null && <span className="cg-modal__chip">{chip}</span>}
          <button type="button" className="cg-modal__close" aria-label={closeLabel} onClick={onClose}>×</button>
        </div>
        {toolbar != null && <div className="cg-modal__toolbar">{toolbar}</div>}
        <div className="cg-modal__body">{children}</div>
        {footer != null && <div className="cg-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
