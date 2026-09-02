/**
 * SmartVideo Studio — DynamicModelForm
 *
 * Renders a schema-driven form for the selected model.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { loadModelSchema } from './svStudio/modelRegistry';
import { normalizeSchema, type SmartField, type NormalizedSchema } from './svStudio/schemaNormalizer';
import { estimateCost } from './svStudio/costEstimator';
import SmartFieldRenderer from './SmartFieldRenderer';
import type { ModelMeta } from './svStudio/modelRegistry';

interface FormState {
  [key: string]: unknown;
}

interface DynamicModelFormProps {
  modelId: string;
  onGenerate: (params: { modelId: string; values: Record<string, unknown>; cost: number }) => void;
  onReset?: () => void;
}

export default function DynamicModelForm({ modelId, onGenerate, onReset }: DynamicModelFormProps) {
  const [schema, setSchema] = useState<NormalizedSchema | null>(null);
  const [capabilities, setCapabilities] = useState<ModelMeta['capabilities'] | null>(null);
  const [values, setValues] = useState<FormState>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [costEstimate, setCostEstimate] = useState<{ cost: number; modelName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load schema when model changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setValues({});
      setCostEstimate(null);

      try {
        const [inputSchema, meta] = await Promise.all([
          loadModelSchema(modelId),
          import('./svStudio/modelRegistry').then(m => m.getModelById(modelId)),
        ]);

        if (cancelled) return;

        if (!meta) {
          setError(`Model "${modelId}" not found.`);
          setLoading(false);
          return;
        }

        const normalized = normalizeSchema(inputSchema, meta.capabilities);
        setSchema(normalized);
        setCapabilities(meta.capabilities);

        // Set default values
        const defaults: FormState = {};
        for (const field of normalized.fields) {
          if (field.defaultValue !== undefined) {
            defaults[field.key] = field.defaultValue;
          }
        }
        setValues(defaults);

        // Estimate cost
        const estimate = await estimateCost(modelId, defaults);
        if (!cancelled) {
          setCostEstimate({ cost: estimate.estimatedCost, modelName: estimate.modelName });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load model schema');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => { cancelled = true; };
  }, [modelId]);

  // Debounced cost estimation
  useEffect(() => {
    if (!schema || Object.keys(values).length === 0) return;

    const timer = setTimeout(async () => {
      try {
        const estimate = await estimateCost(modelId, values);
        setCostEstimate({ cost: estimate.estimatedCost, modelName: estimate.modelName });
      } catch {
        // Silent fail on cost estimate
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [values, modelId, schema]);

  const handleChange = useCallback((key: string, val: unknown) => {
    setValues(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);

    try {
      await onGenerate({ modelId, values, cost: costEstimate?.cost ?? 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [modelId, values, costEstimate, onGenerate]);

  const handleReset = useCallback(() => {
    setValues({});
    onReset?.();
  }, [onReset]);

  // Get example prompts from current model
  const examplePrompts = useMemo(() => {
    if (!schema) return [];
    const promptField = schema.fields.find(f => f.normalizedKey === 'prompt' || f.normalizedKey === 'text');
    if (!promptField) return [];
    const examples = promptField.schema.examples as string[] | undefined;
    return examples || [];
  }, [schema]);

  const enhancedPrompt = useMemo(() => {
    if (!enhancePrompt) return null;
    const promptValue = String(values['prompt'] ?? values['text'] ?? '');
    if (!promptValue.trim()) return null;
    return `${promptValue}, highly detailed, professional quality, 8k resolution, masterpiece`;
  }, [enhancePrompt, values]);

  const handleEnhancePrompt = useCallback(() => {
    setEnhancePrompt(prev => !prev);
  }, []);

  const renderPromptEnhancer = useCallback((sectionFields: SmartField[]) => {
    const hasPrompt = sectionFields.some(f => f.normalizedKey === 'prompt' || f.normalizedKey === 'text');
    if (!hasPrompt || !enhancePrompt || !enhancedPrompt) return null;

    return (
      <div className="smart-prompt-enhancer">
        <div className="smart-prompt-enhancer-label">Enhanced Prompt</div>
        <div className="smart-prompt-enhancer-text">{enhancedPrompt}</div>
      </div>
    );
  }, [enhancePrompt, enhancedPrompt]);

  const isFieldVisible = useCallback((field: SmartField): boolean => {
    if (!field.visibleWhen || field.visibleWhen.length === 0) return true;
    return field.visibleWhen.every(condition => {
      const dependentValue = values[condition.field];
      if (Array.isArray(condition.value)) {
        return condition.value.includes(dependentValue);
      }
      return dependentValue === condition.value;
    });
  }, [values]);

  const toggleAdvanced = useCallback(() => {
    setShowAdvanced(prev => !prev);
  }, []);

  const advancedFieldCount = useMemo(() => {
    return schema?.fields.filter(f => f.advanced).length ?? 0;
  }, [schema]);

  if (loading) {
    return (
      <div className="dynamic-form-loading">
        <div className="smart-skeleton" />
        <div className="smart-skeleton" />
        <div className="smart-skeleton" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dynamic-form-error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="smart-btn-secondary">
          Retry
        </button>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="dynamic-form-empty">
        <p>Select a model to see its parameters.</p>
      </div>
    );
  }

  // Group fields by section
  const sections = schema.sections;
  const unknownFields = schema.fields.filter(f => f.type === 'unknown');

  return (
    <div className="dynamic-form">
      {/* Example Prompts */}
      {examplePrompts.length > 0 && (
        <div className="dynamic-form-examples">
          <div className="dynamic-form-examples-label">Example Prompts</div>
          <div className="dynamic-form-examples-list">
            {examplePrompts.slice(0, 4).map((example, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleChange('prompt', example)}
                className="dynamic-form-example-chip"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form Sections */}
      {sections.map(section => {
        const fields = schema.fields.filter(f => {
          if (f.section !== section) return false;
          if (!isFieldVisible(f)) return false;
          if (f.advanced && !showAdvanced) return false;
          return true;
        });
        if (fields.length === 0) return null;

        const isPromptSection = section === 'prompt';
        const hasPrompt = fields.some(f => f.normalizedKey === 'prompt' || f.normalizedKey === 'text');

        return (
          <div key={section} className="dynamic-form-section">
            <div className="dynamic-form-section-header">
              <h3 className="dynamic-form-section-title">
                {section.charAt(0).toUpperCase() + section.slice(1)}
              </h3>
              {isPromptSection && hasPrompt && (
                <button
                  type="button"
                  onClick={handleEnhancePrompt}
                  className={`smart-enhance-btn ${enhancePrompt ? 'is-active' : ''}`}
                  aria-pressed={enhancePrompt}
                >
                  ✨ Enhance
                </button>
              )}
            </div>
            <div className="dynamic-form-fields">
              {fields.map(field => (
                <SmartFieldRenderer
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  onChange={val => handleChange(field.key, val)}
                />
              ))}
              {renderPromptEnhancer(fields)}
            </div>
          </div>
        );
      })}

      {/* Additional Parameters */}
      {unknownFields.length > 0 && (
        <div className="dynamic-form-section">
          <h3 className="dynamic-form-section-title">Additional Parameters</h3>
          <div className="dynamic-form-fields">
            {unknownFields.map(field => (
              <SmartFieldRenderer
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={val => handleChange(field.key, val)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Advanced Toggle */}
      {advancedFieldCount > 0 && (
        <button
          type="button"
          onClick={toggleAdvanced}
          className="smart-advanced-toggle"
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? 'Hide Advanced' : `Show Advanced (${advancedFieldCount})`}
        </button>
      )}

      {/* Generating Status */}
      {generating && (
        <div className="dynamic-form-status">
          <div className="dynamic-form-status-spinner" />
          <span>Generating your creation...</span>
        </div>
      )}

      {/* Footer Actions */}
      <div className="dynamic-form-footer">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !values['prompt'] && !values['text']}
          className="dynamic-form-generate-btn"
        >
          {generating ? 'Generating...' : 'Generate'}
        </button>
        <div className="dynamic-form-footer-meta">
          {costEstimate && (
            <span className="dynamic-form-cost">~{costEstimate.cost.toFixed(4)} credits</span>
          )}
          <button type="button" onClick={handleReset} className="smart-btn-ghost">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
