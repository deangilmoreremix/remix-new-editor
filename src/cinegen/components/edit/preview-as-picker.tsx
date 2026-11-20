// [remix] "Preview as" in the viewer header: choose which contact's details the overlays show (Smart Text tokens, Personalized Image).
import type { PreviewContact } from '@cinegen/lib/personalize/preview-contact';

export function PreviewAsPicker({ contact }: { contact: PreviewContact }) {
  if (!contact.profiles.length) return null; // no contacts yet: the overlay settings say where to make one
  return (
    <label className="timeline-viewer__preview-as" data-testid="preview-as" style={{ marginLeft: 'auto', marginRight: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: 0.9 }}>
      <span>Preview as</span>
      <select aria-label="Preview as contact" value={contact.profile?.id ?? ''} onChange={(e) => contact.select(e.target.value || null)} style={{ maxWidth: 180, background: 'var(--cg-surface-2, #0d1218)', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>
        <option value="">No contact</option>
        {contact.profiles.map((p) => <option key={p.id} value={p.id}>{contact.nameOf(p)}</option>)}
      </select>
    </label>
  );
}
