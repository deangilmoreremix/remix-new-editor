// [remix] One collapsible group of the clip Inspector. The sections inside stay mounted when the group is closed (hidden, not removed), so
// nothing they hold (a caption transcript in progress, an analysis result) is lost by closing and reopening.
import type { ReactNode } from 'react';
import type { InspectorGroupId } from './use-inspector-groups';

export function InspectorGroup({ id, label, open, forceOpen, onToggle, children }: { id: InspectorGroupId; label: string; open: boolean; forceOpen?: boolean; onToggle: () => void; children: ReactNode }) {
  const shown = open || !!forceOpen;
  return (
    <section className="inspector-group" data-group={id} data-testid={`inspector-group-${id}`}>
      <button type="button" className="inspector-group__head" aria-expanded={shown} aria-controls={`inspector-group-body-${id}`} data-testid={`inspector-group-toggle-${id}`} onClick={onToggle}>
        <span className="inspector-group__chev" aria-hidden="true">{shown ? '▾' : '▸'}</span>
        <span>{label}</span>
      </button>
      <div className="inspector-group__body" id={`inspector-group-body-${id}`} hidden={!shown}>{children}</div>
    </section>
  );
}
