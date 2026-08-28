/**
 * AspectRatioPicker
 *
 * Visual aspect ratio selector for SmartVideo.
 */

import type { SmartField } from '../../types/ai';

export interface AspectRatioPickerProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

const COMMON_RATIOS = [
  { value: '1:1', label: '1:1', icon: '□' },
  { value: '3:4', label: '3:4', icon: '▯' },
  { value: '4:3', label: '4:3', icon: '▬' },
  { value: '9:16', label: '9:16', icon: '▮' },
  { value: '16:9', label: '16:9', icon: '▬' },
  { value: '3:2', label: '3:2', icon: '▭' },
  { value: '21:9', label: '21:9', icon: '▬' },
];

export default function AspectRatioPicker({ field, value, onChange }: AspectRatioPickerProps) {
  const options = field.options && field.options.length > 0 ? field.options : COMMON_RATIOS;

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
            {opt.icon && <span className="mr-1">{opt.icon}</span>}
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
