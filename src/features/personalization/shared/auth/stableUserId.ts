const PREFIX = 'smartvideo-go';

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function getStableUserId(): string {
  if (typeof window === 'undefined') return `${PREFIX}:anonymous`;

  // Preferred: Clerk user ID from session
  try {
    const clerkId = (window as any).__CLERK_USER_ID__ || localStorage.getItem('clerk_user_id');
    if (clerkId) return `${PREFIX}:clerk:${clerkId}`;
  } catch {}

  // Supabase user ID
  try {
    const supabaseUid = localStorage.getItem('supabase_uid');
    if (supabaseUid) return `${PREFIX}:supabase:${supabaseUid}`;
  } catch {}

  // Fallback: deterministic browser fingerprint (stable per browser)
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}`,
  ].join('|');

  return `${PREFIX}:browser:${hashString(fingerprint)}`;
}
