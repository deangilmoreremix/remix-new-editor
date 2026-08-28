/**
 * MultiImagePicker
 *
 * Multi-image upload/library picker for SmartVideo.
 */

import type { SmartField } from '../../types/ai';

export interface MultiImagePickerProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

export default function MultiImagePicker({ field, value, onChange }: MultiImagePickerProps) {
  const urls: string[] = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];

  const addUrl = (url: string) => {
    if (url && !urls.includes(url)) {
      onChange([...urls, url]);
    }
  };

  const removeUrl = (url: string) => {
    onChange(urls.filter((u) => u !== url));
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">
        {field.label}
        {field.required && <span className="ml-1 text-red-400">*</span>}
      </label>

      <div className="flex flex-wrap gap-2">
        {urls.map((url) => (
          <div key={url} className="relative">
            <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => removeUrl(url)}
              className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-xs text-white"
            >
              ×
            </button>
          </div>
        ))}

        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-600">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              for (const file of files) {
                const url = URL.createObjectURL(file);
                addUrl(url);
              }
            }}
          />
          <span className="text-xs text-gray-400">+</span>
        </label>
      </div>

      <input
        type="text"
        placeholder="Or paste URLs (one per line)..."
        onChange={(e) => {
          const lines = e.target.value.split('\n').filter(Boolean);
          lines.forEach((line) => addUrl(line.trim()));
        }}
        className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
      />

      {field.description && (
        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
      )}
    </div>
  );
}
