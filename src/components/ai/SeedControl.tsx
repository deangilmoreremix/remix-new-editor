/**
 * SeedControl
 *
 * Seed input with randomize button for SmartVideo.
 */

import type { SmartField } from '../../types/ai';

export interface SeedControlProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

export default function SeedControl({ field, value, onChange }: SeedControlProps) {
  const seedValue = typeof value === 'number' ? value : -1;

  const randomize = () => {
    onChange(Math.floor(Math.random() * 2_147_483_647));
  };

  const clear = () => {
    onChange(-1);
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-300">
        {field.label}
        {field.required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          value={seedValue}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder="-1 for random"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white focus:border-[#d9ff00] focus:outline-none"
        />
        <button
          type="button"
          onClick={randomize}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:border-[#d9ff00] hover:text-white"
        >
          🎲
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:border-red-500 hover:text-red-400"
        >
          ✕
        </button>
      </div>
      {field.description && (
        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
      )}
    </div>
  );
}
