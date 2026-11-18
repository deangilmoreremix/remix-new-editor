// [remix] "Personalized layouts" tab of the Add to timeline window: one-click layouts built from the previewed contact's logo, photo and details.
import { useState } from 'react';
import { personalizedLayouts } from '@cinegen/lib/overlays/personalized-layouts';
import { usePreviewContact } from '@cinegen/lib/personalize/preview-contact';

const rowStyle = { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-input)' } as const;

export function PersonalizedLayoutsPanel({ onPick }: { onPick: (layoutId: string) => { ok: boolean; message: string } }) {
  const contact = usePreviewContact();
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div data-testid="personalized-layouts" style={{ display: 'grid', gap: 10, padding: '4px 2px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.6, opacity: 0.8 }}>
        {contact.profile
          ? <>Layouts use <strong>{contact.nameOf(contact.profile)}</strong> (change it with “Preview as” above the video). Each contact gets their own logo, photo and details in their own video.</>
          : 'Pick a contact in “Preview as” above the video, or make one with the Personalization button. Layouts use that contact’s logo, photo and details, and every contact gets their own.'}
      </p>
      {personalizedLayouts().map((l) => (
        <div key={l.id} style={rowStyle} data-testid={`layout-${l.id}`}>
          <span aria-hidden style={{ fontSize: 26, width: 36, textAlign: 'center' }}>{l.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{l.label}</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>{l.description}</div>
          </div>
          <button type="button" className="cg-btn" data-testid={`layout-add-${l.id}`} onClick={() => setNote(onPick(l.id))}>Add at playhead</button>
        </div>
      ))}
      {note && !note.ok && <p role="status" data-testid="layout-note" style={{ margin: 0, fontSize: 12, color: '#ffb4b4' }}>{note.message}</p>}
    </div>
  );
}
