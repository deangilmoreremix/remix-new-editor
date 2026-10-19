import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'path';

const SOURCE_PATH = path.join(process.cwd(), 'src/components/TimelineEditorPage.jsx');
const SOURCE = readFileSync(SOURCE_PATH, 'utf-8');

// ---------------------------------------------------------------------------
// Parse the two tables the keyboard shortcut depends on straight out of the
// shipped source, so this test tracks the real component rather than a copy.
// ---------------------------------------------------------------------------

const TOOL_DEFS_BLOCK = /const TOOL_DEFS = \[([\s\S]*?)\n {4}\];/.exec(SOURCE);
const TOOL_MAP_BLOCK = /const toolMap = \{([\s\S]*?)\n {4}\};/.exec(SOURCE);

const TOOL_DEFS = [...(TOOL_DEFS_BLOCK?.[1] ?? '').matchAll(
  /\{\s*id:\s*'([^']+)',\s*icon:\s*'[^']*',\s*label:\s*'([^']+)',\s*hint:\s*'([^']*)'\s*\}/g,
)].map(([, id, label, hint]) => ({ id, label, hint }));

const TOOL_MAP = Object.fromEntries([...(TOOL_MAP_BLOCK?.[1] ?? '').matchAll(
  /'([a-z]+)':\s*'([^']+)'/g,
)].map(([, key, id]) => [key, id]));

/**
 * Rebuild the shipped `selectedToolLabel()` normaliser from source so the test
 * exercises the real normalisation logic, not a restatement of it. `TOOL_DEFS`
 * and `state` are passed as parameters, which shadow the closure bindings the
 * function body reads.
 */
const NORMALISER_BODY = /function selectedToolLabel\(\)\s*\{([\s\S]*?)\n {4}\}/.exec(SOURCE)?.[1];

function buildNormaliser(state) {
  expect(NORMALISER_BODY, 'selectedToolLabel() must exist in TimelineEditorPage.jsx').toBeTruthy();
  const factory = new Function('TOOL_DEFS', 'state', `return function selectedToolLabel() {${NORMALISER_BODY}}`);
  return factory(TOOL_DEFS, state);
}

describe('Timeline Editor keyboard tool shortcuts', () => {
  it('parses the toolbar and shortcut tables out of the source', () => {
    expect(TOOL_DEFS.length).toBeGreaterThan(0);
    expect(Object.keys(TOOL_MAP).length).toBeGreaterThan(0);
  });

  it('keeps the source string the mask regression test asserts', () => {
    // src/lib/editor/__tests__/timeline-editor-mask.test.js pins this exact
    // line — the shortcut must keep writing toolMap's value verbatim.
    expect(SOURCE).toContain('state.selectedTool = toolMap[toolKey]');
    expect(SOURCE).toContain("'x': 'mask'");
    expect(SOURCE).toContain("showToast('Mask tool active — select a clip and open AI Tools to segment')");
  });

  it('every shortcut selects a tool the toolbar actually knows', () => {
    const toolbarIds = new Set(TOOL_DEFS.map(def => def.id));
    for (const [key, toolId] of Object.entries(TOOL_MAP)) {
      expect(
        toolbarIds.has(toolId),
        `shortcut "${key}" selects "${toolId}", which is not in TOOL_DEFS — the toolbar can never highlight it`,
      ).toBe(true);
    }
  });

  it('each shortcut key is unique and each key selects a distinct tool', () => {
    const selected = Object.values(TOOL_MAP);
    expect(new Set(selected).size).toBe(selected.length);
  });

  it('activating a shortcut selects the exact same tool the toolbar shows', () => {
    for (const [key, toolId] of Object.entries(TOOL_MAP)) {
      const expected = TOOL_DEFS.find(def => def.id === toolId);

      // What the keyboard handler stores (the lowercase id from toolMap)...
      const state = { selectedTool: toolId };
      // ...must resolve to the display label the toolbar compares against.
      const resolved = buildNormaliser(state)();
      expect(resolved, `shortcut "${key}" → "${toolId}" did not resolve to a toolbar label`).toBe(expected.label);
      // And that label must be a genuine toolbar label, i.e. renderTools()
      // would add `.active` and the mask overlay gate would open.
      expect(TOOL_DEFS.some(def => def.label === resolved)).toBe(true);
    }
  });

  it('click-selection (the label path) still resolves to the toolbar label', () => {
    // selectTool() stores def.label, not the id — the normaliser must accept
    // both spellings or toolbar clicks would stop highlighting.
    for (const def of TOOL_DEFS) {
      expect(buildNormaliser({ selectedTool: def.label })()).toBe(def.label);
    }
  });

  it('an unknown or empty selection resolves to something harmless', () => {
    expect(buildNormaliser({ selectedTool: null })()).toBeNull();
    expect(buildNormaliser({ selectedTool: '' })()).toBeNull();
    // A stale/unknown token is passed through unchanged, so it matches no
    // toolbar button and no overlay gate rather than throwing.
    expect(buildNormaliser({ selectedTool: 'nope' })()).toBe('nope');
  });

  it('compares the selection through the normaliser, not the raw state value', () => {
    // Any remaining raw label comparison against state.selectedTool would
    // resurrect the original bug (shortcut stores an id, UI compares a label).
    const rawLabelComparisons = SOURCE.match(
      /state\.selectedTool\s*(?:===|!==)\s*'[A-Z]/g,
    );
    expect(
      rawLabelComparisons,
      `raw label comparison(s) left in TimelineEditorPage.jsx: ${rawLabelComparisons?.join(', ')}`,
    ).toBeNull();

    // Both comparison sites must route through the normaliser.
    const callSites = SOURCE.match(/selectedToolLabel\(\)/g) || [];
    expect(callSites.length).toBeGreaterThanOrEqual(4); // renderTools + 3 mask-overlay guards
  });
});
