// [remix] Turn rows from the Contact Importer into contact + profile records the personalization store understands.
// Only a real CSV is imported: the importer's Google/Outlook sources still preview built-in sample people, and
// sample data must never become real recipients.
export interface ImportedRow { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string }
export interface ImportResult { source?: string | null; contacts?: ImportedRow[] }
export interface NewContact { contact: { id: string; name: string; email: string; phone: string; company: string }; profile: Record<string, unknown> }

const clean = (v: unknown, n = 200) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const idOf = (i: number) => `imp-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`;

export function importedToRecords(result: ImportResult, existingEmails: Set<string> = new Set()): { records: NewContact[]; skipped: number; reason: string } {
  if (result.source !== 'csv') return { records: [], skipped: result.contacts?.length ?? 0, reason: 'Only CSV imports can be added as recipients.' };
  const records: NewContact[] = []; const seen = new Set(existingEmails); let skipped = 0;
  (result.contacts ?? []).forEach((r, i) => {
    const firstName = clean(r.firstName, 80), lastName = clean(r.lastName, 80), email = clean(r.email, 200).toLowerCase(), company = clean(r.company), phone = clean(r.phone, 40);
    const name = [firstName, lastName].filter(Boolean).join(' ') || email || company;
    if (!name || (email && seen.has(email))) { skipped += 1; return; }
    if (email) seen.add(email);
    const id = idOf(i);
    records.push({
      contact: { id, name, email, phone, company },
      profile: { id, name, contact: { firstName, lastName, email, phone, company }, variables: { firstName, lastName, company, ...(email ? { email } : {}) }, personalization: { business: { businessName: company || undefined, phone: phone || undefined } } },
    });
  });
  return { records, skipped, reason: '' };
}
