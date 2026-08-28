/**
 * NumberField
 *
 * Numeric input for SmartVideo.
 */

import type { SmartField } from '../../types/ai';

export interface NumberFieldProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

export default function NumberField({ field, value, onChange }: NumberFieldProps) {
  const numValue = typeof value === 'number' ? value : Number(field.defaultValue ?? 0);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-300">
        {field.label}
        {field.required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={numValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-[#d9ff00] focus:outline-none"
      />
      {field.description && (
        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
      )}
    </div>
  );
}
