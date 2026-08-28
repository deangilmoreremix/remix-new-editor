/**
 * MediaAudioPicker
 *
 * Audio upload/library picker for SmartVideo.
 */

import type { SmartField } from '../../types/ai';

export interface MediaAudioPickerProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

export default function MediaAudioPicker({ field, value, onChange }: MediaAudioPickerProps) {
  const currentUrl = typeof value === 'string' ? value : '';

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">
        {field.label}
        {field.required && <span className="ml-1 text-red-400">*</span>}
      </label>

      <div className="flex flex-col gap-3">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 p-6 hover:border-gray-600">
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const url = URL.createObjectURL(file);
              onChange(url);
            }}
          />
          <span className="text-sm text-gray-400">Click to upload audio</span>
        </label>

        <input
          type="text"
          placeholder="Or paste audio URL..."
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
        />

        {currentUrl && (
          <audio src={currentUrl} controls className="w-full" />
        )}
      </div>

      {field.description && (
        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
      )}
    </div>
  );
}
