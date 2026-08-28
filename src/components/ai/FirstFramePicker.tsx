/**
 * FirstFramePicker
 *
 * First frame image picker for SmartVideo.
 */

import type { SmartField } from '../../types/ai';
import MediaImagePicker from './MediaImagePicker';

export interface FirstFramePickerProps {
  field: SmartField;
  value: unknown;
  onChange: (value: unknown) => void;
  model?: { displayName: string };
}

export default function FirstFramePicker({ field, value, onChange }: FirstFramePickerProps) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
        First Frame
      </h4>
      <MediaImagePicker field={field} value={value} onChange={onChange} model={undefined} />
    </div>
  );
}
