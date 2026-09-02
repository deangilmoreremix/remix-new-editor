/**
 * Ported from CineGen: src/components/create/nodes/composition-plan-node.tsx
 * Original: https://github.com/deangilmoremix/CineGen/blob/main/src/components/create/nodes/composition-plan-node.tsx
 *
 * Real per-node UI for composition plan nodes: global positive/negative
 * style fields, plus a dynamic list of sections each with name, styles,
 * duration, and lyrics.
 */

import { memo, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { BaseNodeWrapper } from './base-node.jsx';

const DURATION_OPTIONS = [3000, 5000, 10000, 15000, 20000, 30000, 45000, 60000, 90000, 120000];
const DURATION_LABELS = {
  3000: '3s', 5000: '5s', 10000: '10s', 15000: '15s', 20000: '20s',
  30000: '30s', 45000: '45s', 60000: '1m', 90000: '1.5m', 120000: '2m',
};

const DEFAULT_SECTION = { name: 'intro', positiveStyles: '', negativeStyles: '', durationMs: 15000, lines: '' };

export function CompositionPlanNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();

  const positiveGlobal = String(data.config?.positiveGlobalStyles ?? '');
  const negativeGlobal = String(data.config?.negativeGlobalStyles ?? '');
  const sections = Array.isArray(data.config?.sections) ? data.config.sections : [{ ...DEFAULT_SECTION }];

  const updateConfig = useCallback(
    (partial) => {
      updateNodeData(id, { config: { ...data.config, ...partial } });
    },
    [id, data.config, updateNodeData],
  );

  const updateSections = useCallback(
    (newSections) => updateConfig({ sections: newSections }),
    [updateConfig],
  );

  const updateSection = useCallback(
    (index, partial) => {
      updateSections(sections.map((s, i) => (i === index ? { ...s, ...partial } : s)));
    },
    [sections, updateSections],
  );

  const addSection = useCallback(() => {
    updateSections([...sections, { ...DEFAULT_SECTION, name: `section ${sections.length + 1}` }]);
  }, [sections, updateSections]);

  const removeSection = useCallback(
    (index) => {
      if (sections.length <= 1) return;
      updateSections(sections.filter((_, i) => i !== index));
    },
    [sections, updateSections],
  );

  return (
    <BaseNodeWrapper nodeType="compositionPlan" selected={!!selected}>
      <div className="comp-plan-node__globals">
        <div className="comp-plan-node__field">
          <label className="comp-plan-node__label">Global Styles</label>
          <input
            type="text"
            className="comp-plan-node__input nodrag"
            placeholder="orchestral, cinematic, epic..."
            value={positiveGlobal}
            onChange={(e) => updateConfig({ positiveGlobalStyles: e.target.value })}
          />
        </div>
        <div className="comp-plan-node__field">
          <label className="comp-plan-node__label">Exclude Styles</label>
          <input
            type="text"
            className="comp-plan-node__input nodrag"
            placeholder="electronic, pop..."
            value={negativeGlobal}
            onChange={(e) => updateConfig({ negativeGlobalStyles: e.target.value })}
          />
        </div>
      </div>

      <div className="comp-plan-node__sections">
        {sections.map((section, i) => (
          <div key={i} className="comp-plan-node__section">
            <div className="comp-plan-node__section-header">
              <input
                type="text"
                className="comp-plan-node__name-input nodrag"
                value={section.name}
                onChange={(e) => updateSection(i, { name: e.target.value })}
                placeholder="Section name"
              />
              <div className="comp-plan-node__section-controls">
                <select
                  className="comp-plan-node__duration nodrag nowheel"
                  value={section.durationMs}
                  onChange={(e) => updateSection(i, { durationMs: Number(e.target.value) })}
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>{DURATION_LABELS[d]}</option>
                  ))}
                </select>
                {sections.length > 1 && (
                  <button
                    type="button"
                    className="comp-plan-node__remove-btn nodrag"
                    onClick={() => removeSection(i)}
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
            <input
              type="text"
              className="comp-plan-node__input nodrag"
              placeholder="Styles: quiet, mysterious..."
              value={section.positiveStyles}
              onChange={(e) => updateSection(i, { positiveStyles: e.target.value })}
            />
            <textarea
              className="comp-plan-node__textarea nodrag nowheel"
              rows={2}
              placeholder="Lyrics (empty for instrumental)..."
              value={section.lines}
              onChange={(e) => updateSection(i, { lines: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="comp-plan-node__add-btn nodrag"
        onClick={addSection}
      >
        + Add Section
      </button>
    </BaseNodeWrapper>
  );
}

export default memo(CompositionPlanNode);
