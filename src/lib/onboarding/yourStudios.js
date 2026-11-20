// src/lib/onboarding/yourStudios.js
//
// "Your studios": the ones picked in the onboarding (favorites, primary first), then the ones recommended for the
// video types chosen there. Shown on the Apps page; the side menu shows the favorites only.
import { getFavorites, loadLocalAppOnboarding } from './store.js';
import { recommendedTools } from './toolCatalog.js';
import { getStudio } from '../studioDirectory.js';

/** The signed-in user's id, or '' for a guest / dev session (their browser copy is keyed the same way). */
export const currentUserId = () => globalThis.window?.Clerk?.user?.id || '';

/** Favorite studios as directory entries (unknown ids dropped), capped. */
export function favoriteStudios(userId = currentUserId(), max = 8) {
  return getFavorites(userId).map(getStudio).filter(Boolean).slice(0, max);
}

/** Favorites, then recommendations for the chosen video types (no repeats), as directory entries. */
export function yourStudios(userId = currentUserId(), max = 8) {
  const favs = getFavorites(userId);
  const types = loadLocalAppOnboarding(userId)?.videoTypes || [];
  const ids = [...favs, ...recommendedTools(types).filter((id) => !favs.includes(id))];
  return ids.map(getStudio).filter(Boolean).slice(0, max);
}
