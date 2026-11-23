// [remix] The contact the editor previews as. Contacts come from the Personalization Studio (src/lib/contactStore.js, kept in this browser);
// the selected one is the same `remix_selected_contact_id` the Personalize window and the classic editor use, so choosing one anywhere
// changes the preview everywhere. Smart Text then shows that contact's details and a Personalized Image their picture.
import { useCallback, useEffect, useState } from 'react';
// @ts-expect-error plain JS contact store (localStorage)
import * as contactStore from '../../../lib/contactStore.js';
// @ts-expect-error plain JS per-contact helpers
import { listContactProfiles, contactName } from '../../../lib/editor/personalize/perContact.js';

export interface ContactProfile { id: string; [key: string]: unknown }
export interface PreviewContact {
  profiles: ContactProfile[];
  profile: ContactProfile | null;
  /** bumps on every change to the contacts or the selection, so previews redraw */
  version: number;
  select: (id: string | null) => void;
  nameOf: (p: ContactProfile) => string;
}

const read = () => {
  const profiles = listContactProfiles(contactStore) as ContactProfile[];
  const id = contactStore.getSelectedContactId() as string | null;
  return { profiles, profile: (id ? profiles.find((p) => p.id === id) : null) ?? null };
};

export function usePreviewContact(): PreviewContact {
  const [state, setState] = useState(read);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => { setState(read()); setVersion((v) => v + 1); };
    window.addEventListener('remix:contact-changed', refresh);
    window.addEventListener('storage', refresh); // another tab changed the contacts
    window.addEventListener('focus', refresh);   // contacts made in the Personalize window while this tab was in the background
    return () => { window.removeEventListener('remix:contact-changed', refresh); window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); };
  }, []);
  const select = useCallback((id: string | null) => { contactStore.selectContact(id); }, []);
  return { ...state, version, select, nameOf: contactName as (p: ContactProfile) => string };
}
