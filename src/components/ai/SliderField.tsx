/**
 * SliderField
 *
 * Numeric slider for SmartVideo.
 */

import type { SmartField } from '../../types/ai';

export interface SliderFieldProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

export default function SliderField({ field, value, onChange }: SliderFieldProps) {
  const numValue = typeof value === 'number' ? value : Number(field.defaultValue ?? field.min ?? 0);
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const step = field.step ?? 1;

  return (
    <div>
      <label className="mb-2 flex items-center justify-between text-sm font-medium text-gray-300">
        <span>
          {field.label}
          {field.required && <span className="ml-1 text-red-400">*</span>}
        </span>
        <span className="font-mono text-xs text-gray-400">{numValue}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#d9ff00]"
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {field.description && (
        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
      )}
    </div>
  );
}
