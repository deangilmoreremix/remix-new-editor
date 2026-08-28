/**
 * ToggleField
 *
 * Toggle switch for SmartVideo.
 */

import type { SmartField } from '../../types/ai';

export interface ToggleFieldProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

export default function ToggleField({ field, value, onChange }: ToggleFieldProps) {
  const checked = Boolean(value);

  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="text-sm font-medium text-gray-300">
          {field.label}
          {field.required && <span className="ml-1 text-red-400">*</span>}
        </label>
        {field.description && (
          <p className="text-xs text-gray-500">{field.description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-[#d9ff00]' : 'bg-gray-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
