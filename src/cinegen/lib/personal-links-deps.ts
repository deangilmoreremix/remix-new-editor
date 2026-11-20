// [remix] What the personal-links UIs in the CineGen editor (Export tab hub, Publish tab links list) share: the tokens the
// video uses, and what each contact's stored link should hold.
// @ts-expect-error plain JS
import { contactName, personalVariables, projectTokens } from '../../lib/editor/personalize/perContact.js';

type Overlay = { [key: string]: unknown };

/** The overlays as a tiny project, the shape the token helpers read. */
export const overlayProject = (overlays: Overlay[]) => ({ tracks: [{ items: overlays }] });

/** Token names the video's overlays use. */
export const tokensIn = (overlays: Overlay[]): string[] => projectTokens(overlayProject(overlays));

type CompanyHolder = { contact?: { company?: string }; personalization?: { business?: { businessName?: string } } };
const companyOf = (p: unknown): string => {
  const c = p as CompanyHolder;
  return String(c?.contact?.company || c?.personalization?.business?.businessName || '').trim();
};

/** One stored-link item per contact: { contactId, name, company, variables }. */
export function personalLinkItems(overlays: Overlay[], contacts: Array<{ id: unknown }>) {
  const tokens = tokensIn(overlays);
  // `company` only labels the link's address (acme-dental-…); a person's own name is never put in a URL.
  return contacts.map((p) => ({ contactId: String(p.id), name: contactName(p), company: companyOf(p), variables: personalVariables(p, tokens, { maxLength: 500 }) }));
}
