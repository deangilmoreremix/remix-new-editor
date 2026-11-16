// [remix] PUBLISH tab (the old LEADS tab, same tab id so saved projects and links keep working): everything about getting the video out.
// Share & Leads is the existing page, unchanged. Social, Contacts and Email are the pages added next to it.
import { useState } from 'react';
import { LeadsTab } from '../leads/leads-tab';
import { SocialPanel } from './social-panel';
import { ContactsPanel } from './contacts-panel';
import { ChipRow } from './publish-ui';
import '../../styles/publish.css';

export type PublishSub = 'share' | 'social' | 'contacts';
export const PUBLISH_SUB_KEY = 'cinegen_publish_sub';
const SUBS: Array<{ id: PublishSub; label: string; glyph: string }> = [
  { id: 'share', label: 'Share & Leads', glyph: '🔗' },
  { id: 'social', label: 'Social', glyph: '📣' },
  { id: 'contacts', label: 'Contacts', glyph: '👥' },
];

export function readSub(): PublishSub {
  try { const v = window.localStorage.getItem(PUBLISH_SUB_KEY); return SUBS.some((s) => s.id === v) ? (v as PublishSub) : 'share'; } catch { return 'share'; }
}

export function PublishTab() {
  const [sub, setSub] = useState<PublishSub>(readSub);
  const pick = (id: string) => { setSub(id as PublishSub); try { window.localStorage.setItem(PUBLISH_SUB_KEY, id); } catch { /* it just will not be remembered */ } };
  return (
    <div className="publish-tab" data-testid="publish-tab">
      <div className="publish-tab__nav"><ChipRow label="Publish sections" active={sub} onPick={pick} chips={SUBS} /></div>
      <div className="publish-tab__body">
        {sub === 'share' && <LeadsTab />}
        {sub === 'social' && <SocialPanel />}
        {sub === 'contacts' && <ContactsPanel />}
      </div>
    </div>
  );
}
