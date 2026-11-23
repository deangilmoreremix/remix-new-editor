/** Address helpers shared by the download and "Get link" code. */

export const isHttpUrl = (u) => /^https?:\/\//i.test(String(u || ''));
export const isHttpsUrl = (u) => /^https:\/\//i.test(String(u || ''));
export const isLocalUrl = (u) => /^(blob|data):/i.test(String(u || ''));

const ownSupabaseUrl = () => String((typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '').replace(/\/$/, '');

/**
 * True only for a PUBLIC file in OUR OWN storage: https, our Supabase host, and the public-object path.
 * (The old check looked for the path anywhere in the string, so any address containing it counted as ours.)
 */
export function isOurStorageUrl(url, supabaseUrl = ownSupabaseUrl()) {
  try {
    const u = new URL(String(url || ''));
    const own = new URL(supabaseUrl);
    return u.protocol === 'https:' && u.host === own.host && u.pathname.startsWith('/storage/v1/object/public/');
  } catch { return false; }
}
