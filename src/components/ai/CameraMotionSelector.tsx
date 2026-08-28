/**
 * CameraMotionSelector
 *
 * Camera motion selector for SmartVideo.
 */

import type { SmartField } from '../../types/ai';

export interface CameraMotionSelectorProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

const COMMON_MOTIONS = [
  { value: 'none', label: 'None' },
  { value: 'pan_left', label: 'Pan Left' },
  { value: 'pan_right', label: 'Pan Right' },
  { value: 'tilt_up', label: 'Tilt Up' },
  { value: 'tilt_down', label: 'Tilt Down' },
  { value: 'zoom_in', label: 'Zoom In' },
  { value: 'zoom_out', label: 'Zoom Out' },
  { value: 'dolly_forward', label: 'Dolly Forward' },
  { value: 'dolly_back', label: 'Dolly Back' },
  { value: 'orbit', label: 'Orbit' },
];

export default function CameraMotionSelector({ field, value, onChange }: CameraMotionSelectorProps) {
  const options = field.options && field.options.length > 0 ? field.options : COMMON_MOTIONS;

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-300">
        {field.label}
        {field.required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-[#d9ff00] focus:outline-none"
      >
        <option value="">None</option>
        {options.map((opt) => (
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
