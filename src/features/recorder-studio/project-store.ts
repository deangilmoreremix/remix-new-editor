// In-memory "project" for Recorder Studio: the editable composition props (scenes, theme,
// layout, platform). It stands in for Remotion Studio's default-props storage, which the
// vendored Remotion Recorder composition writes to (updateDefaultProps / saveDefaultProps).
import type { Platform } from "./composition/config/endcard";
import type { CanvasLayout } from "./composition/config/layout";
import type { SelectableScene } from "./composition/config/scenes";
import type { Theme } from "./composition/config/themes";

export type StudioProps = {
  theme: Theme;
  canvasLayout: CanvasLayout;
  platform: Platform;
  scenes: SelectableScene[];
};

type Listener = () => void;

export const COMPOSITION_ID = "recorder";

export const createProjectStore = (initial: StudioProps) => {
  let props = initial;
  let revision = 0; // bumps whenever files change and metadata must be recomputed
  let focusedPath: (string | number)[] | null = null;
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l());

  return {
    getProps: () => props,
    getRevision: () => revision,
    getFocusedPath: () => focusedPath,
    setProps: (next: StudioProps | ((old: StudioProps) => StudioProps)) => {
      props = typeof next === "function" ? next(props) : next;
      emit();
    },
    bumpRevision: () => {
      revision += 1;
      emit();
    },
    focusPath: (path: (string | number)[]) => {
      focusedPath = path;
      emit();
    },
    subscribe: (l: Listener) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
};

export type ProjectStore = ReturnType<typeof createProjectStore>;

// The vendored composition calls module-level functions (no React context), so the
// active store is registered here by the Studio component for as long as it is mounted.
let active: ProjectStore | null = null;
export const setActiveProjectStore = (store: ProjectStore | null) => {
  active = store;
};
export const getActiveProjectStore = () => active;
