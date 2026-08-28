/**
 * SelectField
 *
 * Dropdown select for SmartVideo.
 */

import type { SmartField } from '../../types/ai';

export interface SelectFieldProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

export default function SelectField({ field, value, onChange }: SelectFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-300">
        {field.label}
        {field.required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-[#d9ff00] focus:outline-none"
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
