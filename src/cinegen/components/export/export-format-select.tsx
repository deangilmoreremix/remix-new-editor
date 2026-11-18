// [remix] Stage 11 (port J): output format picker for the Export tab (video containers + audio-only). Offers only what this browser can write
// (lib/export/containers.ts probes); an unavailable format is listed disabled with the reason instead of failing later.
import { useEffect, useState } from 'react';
import { EXPORT_CONTAINERS, browserProbes, supportedContainers, isAudioOnlyContainer, type ExportContainer } from '@cinegen/lib/export/containers';

export function ExportFormatSelect({ value, onChange }: { value: ExportContainer; onChange: (c: ExportContainer) => void }) {
  const [ok, setOk] = useState<Record<ExportContainer, boolean> | null>(null);
  useEffect(() => {
    let live = true;
    void browserProbes().then(supportedContainers).then((r) => { if (live) setOk(r); }).catch(() => { if (live) setOk(null); });
    return () => { live = false; };
  }, []);
  const avail = (id: ExportContainer) => ok === null || ok[id];
  return (
    <div className="export-settings__section">
      <div className="export-settings__label">Format</div>
      <select className="export-settings__fps-select" data-testid="export-format" aria-label="Output format" value={value} onChange={(e) => onChange(e.target.value as ExportContainer)}>
        <optgroup label="Video">
          {EXPORT_CONTAINERS.filter((c) => !c.audioOnly).map((c) => <option key={c.id} value={c.id} disabled={!avail(c.id)}>{c.label}{avail(c.id) ? '' : ' (not supported by this browser)'}</option>)}
        </optgroup>
        <optgroup label="Audio only">
          {EXPORT_CONTAINERS.filter((c) => c.audioOnly).map((c) => <option key={c.id} value={c.id} disabled={!avail(c.id)}>{c.label}{avail(c.id) ? '' : ' (not supported by this browser)'}</option>)}
        </optgroup>
      </select>
      {isAudioOnlyContainer(value) && <span data-testid="export-format-note" style={{ fontSize: 11, opacity: 0.65, marginLeft: 8 }}>Mixes the timeline sound only (volume, fades, speed, EQ, track mute / solo and master volume apply).</span>}
    </div>
  );
}
