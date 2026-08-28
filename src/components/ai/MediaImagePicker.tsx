/**
 * MediaImagePicker
 *
 * Image upload/library picker for SmartVideo.
 * Reuses existing SmartVideo media library when available.
 */

import type { SmartField } from '../../types/ai';

export interface MediaImagePickerProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

export default function MediaImagePicker({ field, value, onChange }: MediaImagePickerProps) {
  const currentUrl = typeof value === 'string' ? value : (value as Record<string, unknown>)?.url as string || '';

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">
        {field.label}
        {field.required && <span className="ml-1 text-red-400">*</span>}
      </label>

      {currentUrl ? (
        <div className="relative inline-block">
          <img
            src={currentUrl}
            alt="Reference"
            className="h-32 w-32 rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 p-6 hover:border-gray-600">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // TODO: Upload to SmartVideo media library
                const url = URL.createObjectURL(file);
                onChange(url);
              }}
            />
            <span className="text-sm text-gray-400">Click to upload image</span>
          </label>

          <div className="text-center text-xs text-gray-500">or</div>

          <input
            type="text"
            placeholder="Paste image URL..."
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
          />
        </div>
      )}

      {field.description && (
        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
      )}
    </div>
  );
}
