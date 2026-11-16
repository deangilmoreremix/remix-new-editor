// Teleprompter over the webcam view (browser studio addition; Recorder has none). The script,
// speed and font size are shared with the Video Outreach recorder (src/lib/recorder/teleprompter.js).
// It is DOM over the preview, so it is never recorded. Scrolls while recording.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createTeleprompterClock,
  loadTeleprompter,
  readingPosition,
  saveTeleprompter,
  scriptLines,
  teleprompterSettings,
  // @ts-expect-error JS module without types
} from "../../../lib/recorder/teleprompter.js";

type Settings = { on: boolean; script: string; wpm: number; fontSize: number; follow: boolean };

export const TeleprompterButton: React.FC<{ settings: Settings; onChange: (s: Settings) => void; disabled: boolean }> = ({ settings, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Settings>) => {
    const next = teleprompterSettings({ ...settings, ...patch }) as Settings;
    saveTeleprompter(next);
    onChange(next);
  };
  return (
    <div className="relative" data-recorder="teleprompter">
      <button
        type="button"
        title="Teleprompter"
        disabled={disabled}
        className={`rounded-md px-2 py-1.5 text-sm disabled:opacity-50 ${settings.on ? "text-[#d9ff00]" : "text-white/80 hover:text-white"}`}
        onClick={() => setOpen(!open)}
      >
        📜
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-50 flex w-80 flex-col gap-2 rounded-xl border border-white/10 bg-[#141414] p-3 shadow-xl">
          <label className="flex items-center gap-2 text-xs text-white/80">
            <input type="checkbox" checked={settings.on} onChange={(e) => set({ on: e.target.checked })} />
            Show the teleprompter
          </label>
          <textarea
            rows={6}
            value={settings.script}
            placeholder="Paste or write your script."
            onChange={(e) => set({ script: e.target.value, on: true })}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs text-white"
          />
          <label className="flex items-center gap-2 text-xs text-white/70">
            <span className="w-16">Speed</span>
            <input type="range" min={60} max={260} step={10} value={settings.wpm} onChange={(e) => set({ wpm: Number(e.target.value) })} className="flex-1" />
            <span className="w-14 text-right">{settings.wpm} wpm</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <span className="w-16">Font size</span>
            <input type="range" min={14} max={48} value={settings.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} className="flex-1" />
            <span className="w-14 text-right">{settings.fontSize}px</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-white/80">
            <input type="checkbox" checked={settings.follow} onChange={(e) => set({ follow: e.target.checked })} />
            Follow my voice (scrolls as you speak; recognised on this device)
          </label>
          <span className="text-[10px] text-white/40">Scrolls while you record. Not recorded.</span>
        </div>
      ) : null}
    </div>
  );
};

export const TeleprompterOverlay: React.FC<{ settings: Settings; recording: boolean }> = ({ settings, recording }) => {
  const lines: string[] = useMemo(() => scriptLines(settings.script), [settings.script]);
  const [ms, setMs] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const clock = useRef(createTeleprompterClock());
  useEffect(() => {
    const c = clock.current;
    c.onFrame(setMs);
    if (recording) {
      c.reset();
      c.start();
    } else c.pause();
    return () => c.pause();
  }, [recording]);
  // Follow my voice (src/lib/recorder/voiceFollow.js): the line you are reading, from the mic.
  const [followAt, setFollowAt] = useState(0);
  const follow = useRef<{ words: Array<{ w: string; line: number }>; lineFor: (w: Array<{ w: string; line: number }>, i: number) => number } | null>(null);
  useEffect(() => {
    if (!settings.follow || !recording) return;
    let stop: (() => void) | null = null;
    let mic: MediaStream | null = null;
    let cancelled = false;
    setFollowAt(0);
    (async () => {
      // @ts-expect-error JS module without types
      const vf = await import("../../../lib/recorder/voiceFollow.js");
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelled) { mic.getTracks().forEach((t) => t.stop()); return; }
      const words = vf.scriptWords(lines);
      follow.current = { words, lineFor: vf.lineForWord };
      let at = 0;
      const l = await vf.listen(mic.getAudioTracks()[0], { onHeard: (text: string) => { at = vf.advance(words, at, text); setFollowAt(at); } });
      stop = () => l.stop();
    })().catch(() => {});
    return () => { cancelled = true; stop?.(); mic?.getTracks().forEach((t) => t.stop()); };
  }, [settings.follow, recording, lines]);
  if (!settings.on || !lines.length) return null;
  let { index, progress } = readingPosition(lines, ms, settings.wpm);
  if (settings.follow && follow.current) {
    index = follow.current.lineFor(follow.current.words, followAt);
    progress = 0;
  }
  // Measured, so a line that wraps onto two rows still scrolls right.
  const cur = box.current?.children[Math.min(index, lines.length - 1)] as HTMLElement | undefined;
  const offset = cur ? cur.offsetTop + (index < lines.length ? progress : 1) * cur.offsetHeight : 0;
  return (
    <div
      data-recorder="teleprompter-overlay"
      style={{ position: "absolute", left: 0, right: 0, top: 0, height: "40%", overflow: "hidden", pointerEvents: "none", zIndex: 5, background: "linear-gradient(rgba(0,0,0,.78), rgba(0,0,0,.5))" }}
    >
      <div
        ref={box}
        style={{
          position: "absolute",
          left: "6%",
          right: "6%",
          top: "30%",
          fontSize: settings.fontSize,
          lineHeight: 1.35,
          fontWeight: 700,
          textAlign: "center",
          transform: `translateY(${-offset}px)`,
          transition: "transform .25s linear",
        }}
      >
        {lines.map((l, i) => (
          <div key={i} style={{ color: i === index ? "#fff" : "rgba(255,255,255,.45)" }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
};

export const useTeleprompterSettings = () => useState<Settings>(() => loadTeleprompter() as Settings);
