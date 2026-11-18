'use client';

import React from 'react';

/** Small form pieces shared by the designer panels (dark panel look used across the Thumbnail step). */

export const inputStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' };
export const TRANSPARENT = 'rgba(0,0,0,0)';

export const chip = (active: boolean): React.CSSProperties => ({
  background: active ? 'rgba(217,255,0,0.12)' : 'rgba(255,255,255,0.04)',
  color: active ? '#d9ff00' : 'rgba(255,255,255,0.5)',
  border: `1px solid ${active ? 'rgba(217,255,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
});

/** A #rrggbb value for a colour input from #rgb, #rrggbb or rgb()/rgba() strings. */
export function toHex(color: string, fallback = '#000000'): string {
  const c = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
  if (m) return `#${[m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}`;
  return fallback;
}

export function isTransparent(color: string): boolean {
  const c = color.trim().toLowerCase();
  if (c === 'transparent') return true;
  const m = /^rgba\(\s*\d+[\s,]+\d+[\s,]+\d+[\s,/]+([\d.]+)\s*\)$/.exec(c);
  return !!m && Number(m[1]) === 0;
}

export function withAlpha(hex: string, alpha: number): string {
  const h = toHex(hex);
  return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${alpha})`;
}

export function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-[10px] text-white/40">{label}</span>
      {children}
    </label>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[11px] font-medium text-white/40">{title}</p>
      {children}
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <Field label={label}>
      <input type="color" aria-label={label} value={toHex(value)} onChange={(e) => onChange(e.target.value)} className="h-8 w-full cursor-pointer rounded-lg" />
    </Field>
  );
}

export function SliderField({ label, value, min, max, step = 1, onChange, unit = '' }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; unit?: string }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[10px] text-white/40">{label}</span>
      <div className="flex items-center gap-2">
        <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full min-w-0 accent-[#d9ff00]" />
        <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-white/50">{Math.round(value * 100) / 100}{unit}</span>
      </div>
    </div>
  );
}

export function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#d9ff00]" />
      <span className="text-[10px] text-white/60">{label}</span>
    </label>
  );
}

export function ToggleGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label}>
      <span className="mb-1 block text-[10px] text-white/40">{label}</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className="flex-1 rounded-lg py-1.5 text-[10px] font-medium capitalize transition-all" style={chip(value === o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}
