/**
 * PromptComposer
 *
 * Enhanced prompt input for SmartVideo.
 * Supports prompt, negative prompt, and optional enhancements.
 */

import { useState } from 'react';

export interface PromptComposerProps {
  field: {
    key: string;
    label: string;
    required?: boolean;
    description?: string;
  };
  value: unknown;
  onChange: (value: unknown) => void;
  model?: {
    displayName: string;
  };
}

export default function PromptComposer({ field, value, onChange, model }: PromptComposerProps) {
  const [enhanceMode, setEnhanceMode] = useState(false);

  const promptValue = typeof value === 'string' ? value : '';
  const negativeValue = typeof value === 'object' && value !== null && 'negative' in value
    ? String((value as Record<string, unknown>).negative)
    : '';

  return (
    <div className="space-y-3">
      <label className="mb-1 block text-sm font-medium text-gray-300">
        {field.label}
        {field.required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <textarea
        value={promptValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Describe what you want ${model?.displayName || ''} to generate...`}
        rows={4}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-[#d9ff00] focus:outline-none"
      />

      {enhanceMode && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-400">
            Negative Prompt
          </label>
          <textarea
            value={negativeValue}
            onChange={(e) =>
              onChange({ ...(typeof value === 'object' ? value : {}), negative: e.target.value })
            }
            placeholder="What to exclude..."
            rows={2}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setEnhanceMode((prev) => !prev)}
        className="text-xs text-gray-400 hover:text-[#d9ff00]"
      >
        {enhanceMode ? 'Hide Advanced' : 'Enhance Prompt'}
      </button>
    </div>
  );
}
