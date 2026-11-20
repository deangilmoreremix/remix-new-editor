'use client';

import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { suggestCopy } from '../copy/copyVariants';
import type { ClientProfile } from '../types';
import { C, chipStyle, hintStyle, labelStyle, secondaryButtonStyle } from './tokens';

type Field = 'ctaHeadline' | 'brandDescription' | 'callToAction'
const GROUPS: { key: 'headlines' | 'taglines' | 'ctas'; label: string; field: Field; layer: 'headline' | 'tagline' | 'cta' }[] = [
  { key: 'headlines', label: 'Headline', field: 'ctaHeadline', layer: 'headline' },
  { key: 'taglines', label: 'Tagline', field: 'brandDescription', layer: 'tagline' },
  { key: 'ctas', label: 'Call to action', field: 'callToAction', layer: 'cta' },
];

/**
 * "Suggest wording": free, offline suggestions assembled from the details already entered. They state facts
 * (name, kind of business, place, contact line) and never invent an offer, price or claim. Picking one fills
 * the field; nothing is applied until it is clicked.
 */
export function CopySuggestionsPanel({ client, onPick }: { client: Partial<ClientProfile>; onPick: (field: Field, value: string, layer: 'headline' | 'tagline' | 'cta') => void }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const s = useMemo(
    () => suggestCopy({ businessName: client.businessName || client.name, industry: client.industry, location: client.location, phone: client.phone, website: client.website }),
    [client.businessName, client.name, client.industry, client.location, client.phone, client.website],
  );
  const empty = s.headlines.length === 0 && s.taglines.length === 0;
  return (
    <div data-testid="copy-suggestions" style={{ marginTop: 10 }}>
      <button type="button" data-testid="copy-suggest-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ ...secondaryButtonStyle, minHeight: 30, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={12} color={C.cyan} /> {open ? 'Hide wording ideas' : 'Suggest wording'}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          {empty && <p style={{ ...hintStyle, margin: 0 }}>Add the business name, kind of business or location above to get suggestions.</p>}
          {GROUPS.map((g) => s[g.key].length > 0 && (
            <div key={g.key}>
              <div style={{ ...labelStyle, marginBottom: 4 }}>{g.label}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {s[g.key].map((text) => (
                  <button key={text} type="button" data-testid={`copy-pick-${g.key}`} onClick={() => onPick(g.field, text, g.layer)} style={chipStyle(false)}>{text}</button>
                ))}
              </div>
            </div>
          ))}
          <p style={{ ...hintStyle, margin: 0 }}>Built from your details only — no offers, prices or claims are added.</p>
        </div>
      )}
    </div>
  );
}
