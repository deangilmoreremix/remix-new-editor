import type { ManifestTheme, WorkbenchManifest } from './cards/manifest';
import type { CardDef } from './cards/types';
import { defaultsOf } from './cards/types';
import type { ProjectData } from './types';

/**
 * 没有接入成片清单时的兜底主题。
 *
 * Motion Studio 可以不接外部成片工程（`proj-stub/workbench.ts` 返回 null），
 * 但主题面板 / 配色编辑器仍然要能用——否则 `setThemeColors` 没有入口，配色
 * 也无处可改。清单自带 themes 时以清单为准，这里只是兜底。
 */
export const FALLBACK_THEME: ManifestTheme = {
  id: 'studio-paper',
  label: '纸墨 · Paper',
  background: '#f2eee6',
  palette: {
    page: '#f2eee6',
    surface: '#fbf8f2',
    text: '#1c1a17',
    muted: '#6b6560',
    accent: '#b5651d',
    field: '#ffffff',
    border: '#e2ddd3',
  },
};

const themesOf = (m: WorkbenchManifest | null): ManifestTheme[] => m?.themes ?? [];

export const selectedTheme = (m: WorkbenchManifest | null, id?: string) => {
  const themes = themesOf(m);
  if (!themes.length) return FALLBACK_THEME;
  return (
    themes.find((t) => t.id === id) ??
    themes.find((t) => t.id === m?.defaultTheme) ??
    themes[0]
  );
};

/** 按 id 取主题（导入配色文件时用）；清单没有主题时只有兜底主题可选 */
export const themeById = (m: WorkbenchManifest | null, id?: string): ManifestTheme | undefined => {
  const themes = themesOf(m);
  const hit = themes.find((t) => t.id === id);
  if (hit) return hit;
  return themes.length ? undefined : id === FALLBACK_THEME.id ? FALLBACK_THEME : undefined;
};

/** Same precedence in the inspector, all players, and the exported film. */
export const themedProps = (m: WorkbenchManifest | null, card: CardDef, id?: string, overrides: Record<string, unknown> = {}, colors?: Record<string, string>) => {
  const theme = selectedTheme(m, id);
  const palette = validThemeColors(m, id, colors);
  const aliases: Record<string,string> = {paper:"page",ink:"text",color:"text",muted:"muted",amber:"accent",accent:"accent"};
  const custom = Object.fromEntries(Object.entries(theme?.unitDefaults?.[card.themeKey ?? ""] ?? {}).filter(([k]) => palette[aliases[k]]).map(([k]) => [k,palette[aliases[k]]]));
  return {...defaultsOf(card),
    ...(card.themeKey ? theme?.unitDefaults?.[card.themeKey] : {}), ...(card.themeKey ? custom : {}), ...overrides,
    ...(card.themeKey && m?.themeProp ? {[m.themeProp]: theme?.id} : {}),
    ...(card.themeKey && m?.paletteProp && Object.keys(palette).length ? {[m.paletteProp]: palette} : {}),
  };
};

/** Omit inherited style values on import so future theme changes stay lightweight.
 * Explicit values differing from the default preset remain per-clip overrides. */
export const inheritedProps = (m: WorkbenchManifest, key: string | undefined, props: Record<string, unknown> = {}) => {
  const defaults = key ? selectedTheme(m)?.unitDefaults?.[key] : undefined;
  return Object.fromEntries(Object.entries(props).filter(([k,v]) => !defaults || !(k in defaults) || defaults[k] !== v));
};

/** Upgrade pre-theme JSON once. Never infer inheritance again after this marker
 * is saved: a user can explicitly choose a color equal to another preset. */
export const upgradeLegacyTheme = (project: ProjectData, m: WorkbenchManifest | null, cards: Record<string, CardDef>): ProjectData => {
  if (project.themeId !== undefined || !m?.themes?.length) return project;
  return {...project, themeId: selectedTheme(m)?.id, tracks: project.tracks.map(track => ({...track,
    clips: track.clips.map(clip => ({...clip, props: inheritedProps(m, cards[clip.cardId]?.themeKey, clip.props)})),
  }))};
};

export const switchTheme = (project: ProjectData, m: WorkbenchManifest | null, id: string): ProjectData => {
  if (!themeById(m, id)) return project;
  return {...project, themeId: id, themeColors: undefined};
};
export const themedBackground = (project: ProjectData, m: WorkbenchManifest | null) =>
  validThemeColors(m, project.themeId, project.themeColors).page ?? (project.themeId === 'site' ? project.sitePalette?.page : undefined) ?? (project.themeId ? selectedTheme(m, project.themeId)?.background ?? project.background : project.background);

export const validThemeColors = (m: WorkbenchManifest | null, id?: string, colors?: Record<string,string>) => {
 const palette = selectedTheme(m,id)?.palette;
 return Object.fromEntries(Object.entries(colors ?? {}).filter(([k,v]) => palette && Object.prototype.hasOwnProperty.call(palette,k) && typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)));
};
