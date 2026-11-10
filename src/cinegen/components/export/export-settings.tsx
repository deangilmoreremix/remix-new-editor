

import { useState } from 'react';
import type { ExportPreset } from '@cinegen/types/export';
// [remix] OpenChatCut export bitrate modes (export/bitrate.ts) and auto-QA preference (export/autoQa.ts)
import { DEFAULT_CUSTOM_BITRATE_MBPS, MAX_VIDEO_BITRATE_MBPS, MIN_VIDEO_BITRATE_MBPS, requestedVideoBitrateBps, type VideoBitrateMode } from '../../../openchatcut/export/bitrate';
// [remix] OpenChatCut master-quality policy (media/qualityPolicy.ts): master → high default bitrate
import { defaultBitrateModeForQuality, getQualityMode, setQualityMode } from '../../../openchatcut/media/qualityPolicy';
import { loadExportAutoQaPreference, saveExportAutoQaPreference } from '../../../openchatcut/export/autoQa';

export interface ExportExtras { videoBitrate?: number; qa: boolean; aspect?: string }
const ASPECTS: Array<[string, string]> = [['16:9', '16:9 landscape'], ['9:16', '9:16 vertical'], ['1:1', '1:1 square'], ['4:5', '4:5 portrait'], ['21:9', '21:9 cinema']];
function aspectFrame(w: number, h: number, aspect: string): [number, number] {
  const [a, b] = aspect.split(':').map(Number); const r = a / b; const short = Math.min(w, h);
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return r >= 1 ? [even(short * r), short] : [short, even(short / r)];
}
const PRESET_SIZE: Record<ExportPreset, [number, number]> = { draft: [1280, 720], standard: [1920, 1080], high: [3840, 2160] };

interface ExportSettingsProps {
  hasClips: boolean;
  onRender: (preset: ExportPreset, fps: 24 | 30 | 60, extras: ExportExtras) => void;
}

export function ExportSettings({ hasClips, onRender }: ExportSettingsProps) {
  const [preset, setPreset] = useState<ExportPreset>('standard');
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [aspect, setAspect] = useState('16:9');
  const [bitrateMode, setBitrateMode] = useState<VideoBitrateMode>(() => defaultBitrateModeForQuality());
  const [master, setMaster] = useState(() => getQualityMode() === 'master');
  const [customMbps, setCustomMbps] = useState(DEFAULT_CUSTOM_BITRATE_MBPS);
  const [qa, setQa] = useState(() => loadExportAutoQaPreference().enabled);
  const [pw, ph] = PRESET_SIZE[preset];
  const [w, h] = aspectFrame(pw, ph, aspect);
  const requested = requestedVideoBitrateBps({ mode: bitrateMode, width: w, height: h, fps, customMbps });

  const presets: { value: ExportPreset; label: string; resolution: string }[] = [
    { value: 'draft', label: 'Draft', resolution: '720p' },
    { value: 'standard', label: 'Standard', resolution: '1080p' },
    { value: 'high', label: 'High Quality', resolution: '4K' },
  ];

  return (
    <div className="export-settings">
      <div className="export-settings__section">
        <div className="export-settings__label">Preset</div>
        <div className="export-settings__presets">
          {presets.map((p) => (
            <button
              key={p.value}
              className={`export-settings__preset-card${preset === p.value ? ' export-settings__preset-card--active' : ''}`}
              onClick={() => setPreset(p.value)}
            >
              <div className="export-settings__preset-name">{p.label}</div>
              <div className="export-settings__preset-res">{p.resolution}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="export-settings__section">
        <div className="export-settings__label">Frame Rate</div>
        <select
          className="export-settings__fps-select"
          value={fps}
          onChange={(e) => setFps(Number(e.target.value) as 24 | 30 | 60)}
        >
          <option value={24}>24 fps</option>
          <option value={30}>30 fps</option>
          <option value={60}>60 fps</option>
        </select>
      </div>

      <div className="export-settings__section">
        <div className="export-settings__label">Aspect ratio</div>
        <select className="export-settings__fps-select" data-testid="export-aspect" value={aspect} onChange={(e) => setAspect(e.target.value)}>
          {ASPECTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span style={{ fontSize: 11, opacity: 0.65, marginLeft: 8 }}>{w}×{h}</span>
      </div>

      <div className="export-settings__section">
        <div className="export-settings__label">Video bitrate</div>
        <select className="export-settings__fps-select" data-testid="export-bitrate-mode" value={bitrateMode} onChange={(e) => setBitrateMode(e.target.value as VideoBitrateMode)}>
          <option value="auto">Auto</option>
          <option value="compact">Compact (smaller file)</option>
          <option value="recommended">Recommended</option>
          <option value="high">High (larger file)</option>
          <option value="custom">Custom…</option>
        </select>
        {bitrateMode === 'custom' && (
          <input className="export-settings__fps-select" type="number" data-testid="export-bitrate-custom" min={MIN_VIDEO_BITRATE_MBPS} max={MAX_VIDEO_BITRATE_MBPS} value={customMbps} onChange={(e) => setCustomMbps(Number(e.target.value))} style={{ width: 90, marginLeft: 8 }} />
        )}
        {requested ? <span style={{ fontSize: 11, opacity: 0.65, marginLeft: 8 }}>{(requested / 1_000_000).toFixed(1)} Mbps</span> : null}
      </div>

      <div className="export-settings__section">
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
          <input type="checkbox" data-testid="export-master-quality" checked={master} onChange={(e) => { const m = e.target.checked ? 'master' : 'balanced'; setMaster(e.target.checked); setQualityMode(m); setBitrateMode(defaultBitrateModeForQuality(m)); }} />
          Master quality (higher default bitrate)
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
          <input type="checkbox" data-testid="export-auto-qa" checked={qa} onChange={(e) => { setQa(e.target.checked); saveExportAutoQaPreference({ enabled: e.target.checked }); }} />
          Check the finished export (duration, size, black / frozen frames, silence, peak level)
        </label>
      </div>

      <button
        className="export-settings__render-btn"
        disabled={!hasClips}
        onClick={() => onRender(preset, fps, { videoBitrate: requested, qa, aspect })}
        title={hasClips ? undefined : 'Add clips to the timeline first'}
      >
        Render
      </button>
    </div>
  );
}
