/**
 * DynamicModelForm
 *
 * Auto-renders the correct SmartVideo-native controls based on SmartField[].
 * Works for any MuAPI model without hard-coded model-specific UI.
 */

import { useState, useMemo, useCallback } from 'react';
import type { SmartField, SmartModel } from '../../types/ai';
import PromptComposer from './PromptComposer';
import AspectRatioPicker from './AspectRatioPicker';
import ResolutionPicker from './ResolutionPicker';
import DurationPicker from './DurationPicker';
import MediaImagePicker from './MediaImagePicker';
import MultiImagePicker from './MultiImagePicker';
import MediaVideoPicker from './MediaVideoPicker';
import MediaAudioPicker from './MediaAudioPicker';
import FirstFramePicker from './FirstFramePicker';
import LastFramePicker from './LastFramePicker';
import SliderField from './SliderField';
import SelectField from './SelectField';
import ChipSelector from './ChipSelector';
import ToggleField from './ToggleField';
import NumberField from './NumberField';
import TextField from './TextField';
import TextAreaField from './TextAreaField';
import SeedControl from './SeedControl';
import LoRASelector from './LoRASelector';
import CameraMotionSelector from './CameraMotionSelector';
import StrengthSlider from './StrengthSlider';
import OutputFormatSelector from './OutputFormatSelector';

export interface DynamicModelFormProps {
  model: SmartModel;
  schema?: SmartField[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  loading?: boolean;
  advanced?: boolean;
}

const FIELD_COMPONENTS = {
  prompt: PromptComposer,
  text: TextField,
  textarea: TextAreaField,
  number: NumberField,
  slider: SliderField,
  select: SelectField,
  chips: ChipSelector,
  toggle: ToggleField,
  image: MediaImagePicker,
  images: MultiImagePicker,
  video: MediaVideoPicker,
  audio: MediaAudioPicker,
  'aspect-ratio': AspectRatioPicker,
  resolution: ResolutionPicker,
  duration: DurationPicker,
  seed: SeedControl,
  lora: LoRASelector,
  'camera-motion': CameraMotionSelector,
  'first-frame': FirstFramePicker,
  'last-frame': LastFramePicker,
  strength: StrengthSlider,
  'output-format': OutputFormatSelector,
};

export default function DynamicModelForm({
  model,
  schema = [],
  values,
  onChange,
  onSubmit,
  submitLabel = 'Generate',
  loading = false,
  advanced = false,
}: DynamicModelFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(advanced);

  // Group fields by section
  const sections = useMemo(() => {
    const groups: Record<string, SmartField[]> = {};
    for (const field of schema) {
      if (field.hidden) continue;
      if (!showAdvanced && field.advanced) continue;

      // Conditional visibility
      if (field.visibleWhen && !isFieldVisible(field.visibleWhen, values)) {
        continue;
      }

      const section = field.section || 'Other';
      if (!groups[section]) groups[section] = [];
      groups[section].push(field);
    }
    return groups;
  }, [schema, values, showAdvanced]);

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      onChange({ ...values, [key]: value });
    },
    [values, onChange]
  );

  const hasAdvancedFields = schema.some((f) => f.advanced);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="space-y-6"
    >
      {Object.entries(sections).map(([sectionName, fields]) => (
        <div key={sectionName} className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            {sectionName}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={values[field.key] ?? field.defaultValue}
                onChange={(value) => handleFieldChange(field.key, value)}
                model={model}
              />
            ))}
          </div>
        </div>
      ))}

      {hasAdvancedFields && (
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="text-sm text-gray-400 hover:text-white"
        >
          {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
        </button>
      )}

      {onSubmit && (
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#d9ff00] px-6 py-3 font-semibold text-black hover:bg-[#c5e600] disabled:opacity-50"
        >
          {loading ? 'Generating...' : submitLabel}
        </button>
      )}
    </form>
  );
}

// ── Field Renderer ───────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model: SmartModel;
}

function FieldRenderer({ field, value, onChange, model }: FieldRendererProps) {
  const Component = FIELD_COMPONENTS[field.type];

  if (!Component) {
    // Generic fallback for unknown field types
    return <GenericField field={field} value={value} onChange={onChange} />;
  }

  return (
    <Component
      field={field}
      value={value}
      onChange={onChange}
      model={model}
    />
  );
}

function GenericField({ field, value, onChange }: { field: SmartField; value: unknown; onChange: (v: unknown) => void }) {
  if (field.type === 'select' || field.type === 'chips') {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">
          {field.label}
          {field.required && <span className="ml-1 text-red-400">*</span>}
        </label>
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
        >
          <option value="">Select...</option>
          {field.options?.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.description && (
          <p className="mt-1 text-xs text-gray-500">{field.description}</p>
        )}
      </div>
    );
  }

  if (field.type === 'toggle') {
    return (
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 rounded border-gray-700"
        />
        <label className="text-sm font-medium text-gray-300">{field.label}</label>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">
          {field.label}
          {field.required && <span className="ml-1 text-red-400">*</span>}
        </label>
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
        />
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-300">
        {field.label}
        {field.required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <input
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
      />
    </div>
  );
}

function isFieldVisible(
  condition: { field: string; equals: unknown },
  values: Record<string, unknown>
): boolean {
  const actual = values[condition.field];
  if (Array.isArray(condition.equals)) {
    return condition.equals.includes(actual);
  }
  return actual === condition.equals;
}
