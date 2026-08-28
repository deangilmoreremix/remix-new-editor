/**
 * DurationPicker
 *
 * Visual duration selector for SmartVideo.
 */

import type { SmartField } from '../../types/ai';

export interface DurationPickerProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

const COMMON_DURATIONS = [
  { value: 3, label: '3s' },
  { value: 5, label: '5s' },
  { value: 8, label: '8s' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
];

export default function DurationPicker({ field, value, onChange }: DurationPickerProps) {
  const options = field.options && field.options.length > 0 ? field.options : COMMON_DURATIONS;

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">
        {field.label}
        {field.required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
              value === opt.value
                ? 'border-[#d9ff00] bg-[#d9ff00]/10 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {field.description && (
        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
      )}
    </div>
  );
}
