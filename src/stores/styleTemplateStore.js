// styleTemplateStore.js
//
// Holds the StyleTemplate the user is currently creating from a Minimax demo
// ("Create This Style"). Fills the preset.store gap noted in the integration
// roadmap: a small pub/sub store built on src/stores/base/Store.js.
//
// Shape: { active: StyleTemplate | null, draftId: string | null, hydratedStudio: string | null }
//
//   load(template, draftId)  — set the active template + its draft id
//   clear()                  — reset to empty

import Store from './base/Store.js';

const initialState = {
  active: null,
  draftId: null,
  hydratedStudio: null,
};

class StyleTemplateStore extends Store {
  constructor() {
    super({ ...initialState });
  }

  /** Set the active template being created. */
  load(template, draftId = null) {
    this.setState({
      active: template,
      draftId: draftId || null,
      hydratedStudio: template && template.targetStudio ? template.targetStudio : null,
    });
  }

  /** Clear the active template (e.g. after the studio consumes it). */
  clear() {
    this.reset({ ...initialState });
  }
}

export const styleTemplateStore = new StyleTemplateStore();
export default styleTemplateStore;
