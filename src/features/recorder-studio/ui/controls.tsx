import type { ReactNode } from "react";

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="rs-field">
    <span className="rs-label">{label}</span>
    {children}
    {hint ? <span className="rs-hint">{hint}</span> : null}
  </label>
);

export const TextInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <input className="rs-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
);

/** Seconds-based number input that stores frames. */
export const SecondsInput = ({ frames, onChange, fps = 30, min, step = 0.1 }: { frames: number; onChange: (frames: number) => void; fps?: number; min?: number; step?: number }) => (
  <input
    className="rs-input"
    type="number"
    step={step}
    min={min}
    value={Number((frames / fps).toFixed(2))}
    onChange={(e) => {
      const v = Number(e.target.value);
      if (Number.isFinite(v)) onChange(Math.round(v * fps));
    }}
  />
);

export const Select = <T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) => (
  <select className="rs-select" value={value} onChange={(e) => onChange(e.target.value as T)}>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export const Check = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <label className="rs-check">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);
