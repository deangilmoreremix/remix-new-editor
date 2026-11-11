/**
 * "My Motion Recipes" — the user's own shot list.
 *
 * The studio keeps the saved list in localStorage (there is no server-side
 * recipe store in Motion Studio): every entry points at a catalog shot id, so
 * the saved card always renders the live demo component and never a stale
 * copy of it.
 */

const STORAGE_KEY = 'motion-director:saved-recipes-v1';

export interface SavedRecipe {
  /** Catalog shot id — `motionCardId` maps it to the registry card. */
  id: string;
  /** User-given name; falls back to the catalog name when empty. */
  name?: string;
  savedAt: string;
}

const isSavedRecipe = (v: unknown): v is SavedRecipe => {
  if (typeof v !== 'object' || v === null) return false;
  const rec = v as Partial<SavedRecipe>;
  return typeof rec.id === 'string' && rec.id.length > 0;
};

export const loadSavedRecipes = (): SavedRecipe[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedRecipe);
  } catch {
    /* 存档损坏：当作空列表 */
    return [];
  }
};

const persist = (list: SavedRecipe[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* 隐私模式 / 存储满：静默失败 */
  }
};

export const saveRecipe = (id: string, name?: string): SavedRecipe[] => {
  const list = loadSavedRecipes();
  if (list.some((r) => r.id === id)) return list;
  const next = [...list, { id, name, savedAt: new Date().toISOString() }];
  persist(next);
  return next;
};

export const removeRecipe = (id: string): SavedRecipe[] => {
  const next = loadSavedRecipes().filter((r) => r.id !== id);
  persist(next);
  return next;
};

export const renameRecipe = (id: string, name: string): SavedRecipe[] => {
  const next = loadSavedRecipes().map((r) => (r.id === id ? { ...r, name } : r));
  persist(next);
  return next;
};
