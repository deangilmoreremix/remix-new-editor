// Camera effects for the webcam view (browser studio addition; Recorder has none): background
// blur, virtual background and touch-up, run on-device (src/lib/recorder/effects.js) and recorded
// into the take. Recorder's own Mirror toggle stays a preview-only mirror.
import React, { useEffect, useRef, useState } from "react";
// @ts-expect-error JS module without types
import { BUILTIN_BACKGROUNDS, effectsSettings, loadEffects, saveEffects } from "../../../lib/recorder/effects.js";

export const EFFECTS_CHANGED_EVENT = "recorder:effects-changed";

type Fx = { mode: "none" | "blur" | "background"; background: string; blur: number; touchUp: number; mirror: boolean };

const chip = (on: boolean) =>
  `rounded-lg border px-2 py-1 text-xs ${on ? "border-[#d9ff00] text-[#d9ff00]" : "border-white/15 text-white/80 hover:text-white"}`;

export const CameraEffects: React.FC<{ disabled: boolean }> = ({ disabled }) => {
  const [open, setOpen] = useState(false);
  const [fx, setFx] = useState<Fx>(() => loadEffects());
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const change = (patch: Partial<Fx>) => {
    const next = effectsSettings({ ...fx, ...patch }) as Fx;
    setFx(next);
    saveEffects(next);
    // Sliders fire often: restart the camera once they settle.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => window.dispatchEvent(new Event(EFFECTS_CHANGED_EVENT)), 250);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const active = fx.mode !== "none" || fx.touchUp > 0;
  const custom = fx.mode === "background" && !BUILTIN_BACKGROUNDS.some((b: { id: string }) => b.id === fx.background);
  return (
    <div className="relative" data-recorder="camera-effects">
      <button
        type="button"
        disabled={disabled}
        title="Background blur, virtual background and touch-up"
        className={`rounded-md px-2 py-1.5 text-sm disabled:opacity-50 ${active ? "text-[#d9ff00]" : "text-white/80 hover:text-white"}`}
        onClick={() => setOpen(!open)}
      >
        ✨
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-50 flex w-72 flex-col gap-2 rounded-xl border border-white/10 bg-[#141414] p-3 shadow-xl">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(fx.mode === "none")} onClick={() => change({ mode: "none" })}>None</button>
            <button type="button" className={chip(fx.mode === "blur")} onClick={() => change({ mode: "blur" })}>Blur</button>
            {BUILTIN_BACKGROUNDS.map((b: { id: string; label: string }) => (
              <button key={b.id} type="button" className={chip(fx.mode === "background" && fx.background === b.id)} onClick={() => change({ mode: "background", background: b.id })}>
                {b.label}
              </button>
            ))}
            <button type="button" className={chip(custom)} onClick={() => fileRef.current?.click()}>
              {custom ? "Your image ✓" : "Upload…"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const r = new FileReader();
                r.onload = () => change({ mode: "background", background: String(r.result) });
                r.readAsDataURL(file);
              }}
            />
          </div>
          {fx.mode === "blur" ? (
            <label className="flex items-center gap-2 text-xs text-white/70">
              <span className="w-16">Blur</span>
              <input type="range" min={0} max={1} step={0.05} value={fx.blur} onChange={(e) => change({ blur: Number(e.target.value) })} className="flex-1" />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-xs text-white/70">
            <span className="w-16">Touch-up</span>
            <input type="range" min={0} max={1} step={0.05} value={fx.touchUp} onChange={(e) => change({ touchUp: Number(e.target.value) })} className="flex-1" />
          </label>
          <span className="text-[10px] text-white/40">Runs on your device and is recorded into the take.</span>
        </div>
      ) : null}
    </div>
  );
};
