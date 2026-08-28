/**
 * ChipSelector
 *
 * Chip-based selector for SmartVideo.
 */

import type { SmartField } from '../../types/ai';

export interface ChipSelectorProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

export default function ChipSelector({ field, value, onChange }: ChipSelectorProps) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  const toggle = (optValue: unknown) => {
    const strValue = String(optValue);
    if (selected.includes(strValue)) {
      onChange(selected.filter((v) => v !== strValue));
    } else {
      onChange([...selected, strValue]);
    }
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">
        {field.label}
        {field.required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {field.options?.map((opt) => {
          const isSelected = selected.includes(String(opt.value));
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-all ${
                isSelected
                  ? 'border-[#d9ff00] bg-[#d9ff00]/10 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {field.description && (
        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
      )}
    </div>
  );
}
