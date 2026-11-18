// [remix] The look of the Publish pages, taken from the "Personalize this demo > Choose a video" design: chips with counts, a Search + filters
// row, "Showing N of M", and a grid of picture cards. Class names only (styles/publish.css), so the pages stay consistent and light.
import type { ReactNode } from 'react';

export function ChipRow({ label, chips, active, onPick }: { label: string; chips: Array<{ id: string; label: string; count?: number; glyph?: string }>; active: string; onPick: (id: string) => void }) {
  return (
    <div className="pub-chips" role="tablist" aria-label={label}>
      {chips.map((c) => (
        <button key={c.id} type="button" role="tab" aria-selected={active === c.id} data-testid={`pub-chip-${c.id}`} className={`pub-chip${active === c.id ? ' pub-chip--on' : ''}`} onClick={() => onPick(c.id)}>
          {c.glyph && <span className="pub-chip__glyph" aria-hidden="true">{c.glyph}</span>}
          <span>{c.label}</span>
          {c.count !== undefined && <span className="pub-chip__count">{c.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="pub-field"><div className="pub-field__label">{label}</div>{children}</div>;
}

export function PanelHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="pub-head">
      <div><div className="pub-head__title">{title}</div>{sub && <div className="pub-head__sub">{sub}</div>}</div>
      <div className="pub-head__right">{right}</div>
    </div>
  );
}

/** One picture card. `onClick` is the whole card; `badge` sits top-left, `tag` top-right. */
export function PictureCard({ title, sub, image, badge, tag, busy, onClick, testId }: { title: string; sub?: string; image?: string | null; badge?: string; tag?: string; busy?: boolean; onClick: () => void; testId?: string }) {
  return (
    <button type="button" className={`pub-card${busy ? ' pub-card--busy' : ''}`} onClick={onClick} disabled={busy} aria-label={title} data-testid={testId}>
      <div className="pub-card__thumb">
        {image ? <img src={image} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <span className="pub-card__noimg" aria-hidden="true">▶</span>}
        {badge && <span className="pub-card__badge">{badge}</span>}
        {tag && <span className="pub-card__tag">{tag}</span>}
        {busy && <span className="pub-card__busy">Getting it ready…</span>}
      </div>
      <div className="pub-card__title">{title}</div>
      {sub && <div className="pub-card__sub">{sub}</div>}
    </button>
  );
}
