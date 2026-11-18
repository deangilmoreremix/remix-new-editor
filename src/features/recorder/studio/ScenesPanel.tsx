// The scene list and per-scene settings. Replaces the Remotion Studio props sidebar Recorder
// is edited in: every field of config/scenes.ts can be changed here.
import React, { useEffect, useRef, useState } from "react";
import { brand, platform as platforms } from "../config/endcard";
import { canvasLayout as canvasLayouts } from "../config/layout";
import type { BRoll, SelectableScene } from "../config/scenes";
import { music as musics } from "../config/sounds";
import { theme as themes } from "../config/themes";
import type { MainProps } from "../remotion/Main";
import { defaultVideoScene } from "./project-defaults";
import { FOCUS_SCENE_EVENT, projectSrc, writeStaticFile } from "./project-store";

type SceneType = SelectableScene["type"];

export const SCENE_TYPES: { type: SceneType; label: string }[] = [
  { type: "videoscene", label: "Video (a take)" },
  { type: "title", label: "Title" },
  { type: "tableofcontents", label: "Table of contents" },
  { type: "endcard", label: "End card" },
  { type: "recorder", label: "Recorder intro" },
];

const WEBCAM_POSITIONS = ["previous", "top-left", "top-right", "bottom-left", "bottom-right"] as const;

/** A new scene of a type, with the schema's defaults. */
export const newScene = (type: SceneType): SelectableScene => {
  const base = { music: "previous" as const, transitionToNextScene: true };
  if (type === "videoscene") return defaultVideoScene();
  if (type === "title") return { ...base, type, title: "Title", subtitle: null, durationInFrames: 50 };
  if (type === "endcard") return { ...base, type, durationInFrames: 200, channel: "custom", links: [], profile: { avatar: "", youtube: null, linkedin: null, instagram: null, discord: null, x: null, isLinkedInBusinessPage: false } };
  if (type === "tableofcontents") return { ...base, type, durationInFrames: 200 };
  return { ...base, type: "recorder", durationInFrames: 90 };
};

/** Keep what a scene shares (music, transition) when its type changes. */
export const changeSceneType = (scene: SelectableScene, type: SceneType): SelectableScene => ({
  ...newScene(type),
  music: scene.music,
  transitionToNextScene: scene.transitionToNextScene,
} as SelectableScene);

export const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
};

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white outline-none focus:border-primary/60";

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[11px] font-semibold text-white/60">{label}</span>
    {children}
    {hint ? <span className="text-[10px] text-white/40">{hint}</span> : null}
  </label>
);

const Select: React.FC<{ value: string; options: readonly string[]; onChange: (v: string) => void; name?: string }> = ({ value, options, onChange, name }) => (
  <select className={inputCls} value={value} name={name} onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => (
      <option key={o} value={o} className="bg-neutral-900">
        {o}
      </option>
    ))}
  </select>
);

const Num: React.FC<{ value: number; onChange: (v: number) => void; min?: number; step?: number; name?: string }> = ({ value, onChange, min = 0, step = 1, name }) => (
  <input
    className={inputCls}
    type="number"
    name={name}
    min={min}
    step={step}
    value={Number.isFinite(value) ? value : 0}
    onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
  />
);

const Text: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; name?: string }> = ({ value, onChange, placeholder, name }) => (
  <input className={inputCls} name={name} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
);

const Check: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; name?: string }> = ({ label, checked, onChange, name }) => (
  <label className="flex items-center gap-2 text-xs text-white/80">
    <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#d9ff00]" />
    {label}
  </label>
);

const BRollsEditor: React.FC<{ folder: string; bRolls: BRoll[]; onChange: (b: BRoll[]) => void }> = ({ folder, bRolls, onChange }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: BRoll[] = [];
    for (const file of Array.from(files)) {
      const name = `${folder}/${file.name.replace(/[^\w.-]+/g, "_")}`;
      await writeStaticFile({ filePath: name, contents: file });
      added.push({ source: projectSrc(name), durationInFrames: 90, from: 30 });
    }
    onChange([...bRolls, ...added]);
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold text-white/60">B-roll (images or videos over this take)</span>
      {bRolls.map((b, i) => (
        <div key={i} className="grid grid-cols-[1fr_70px_70px_auto] items-end gap-2">
          <Field label="Source">
            <span className="truncate text-[11px] text-white/70" title={b.source}>
              {b.source.replace(/^project:[^/]+\//, "")}
            </span>
          </Field>
          <Field label="From (frame)">
            <Num value={b.from} onChange={(v) => onChange(bRolls.map((x, j) => (j === i ? { ...x, from: v } : x)))} />
          </Field>
          <Field label="Frames">
            <Num value={b.durationInFrames} min={1} onChange={(v) => onChange(bRolls.map((x, j) => (j === i ? { ...x, durationInFrames: v } : x)))} />
          </Field>
          <button type="button" className="mb-1 text-[11px] text-red-300 hover:text-red-200" onClick={() => onChange(bRolls.filter((_, j) => j !== i))}>
            Remove
          </button>
        </div>
      ))}
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => add(e.target.files)} />
      <button type="button" className="self-start rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-white hover:border-primary/60" onClick={() => fileRef.current?.click()}>
        + Add B-roll
      </button>
      <span className="text-[10px] text-white/40">You can also drop files onto the video preview.</span>
    </div>
  );
};

const SceneFields: React.FC<{ folder: string; scene: SelectableScene; onChange: (s: SelectableScene) => void }> = ({ folder, scene, onChange }) => {
  const set = (patch: Partial<SelectableScene>) => onChange({ ...scene, ...patch } as SelectableScene);
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {scene.type === "videoscene" ? (
        <>
          <Field label="Webcam position">
            <Select name="webcamPosition" value={scene.webcamPosition} options={WEBCAM_POSITIONS} onChange={(v) => set({ webcamPosition: v as typeof scene.webcamPosition })} />
          </Field>
          <Field label="New chapter" hint="Starts a chapter here">
            <Text name="newChapter" value={scene.newChapter ?? ""} onChange={(v) => set({ newChapter: v })} placeholder="Chapter title" />
          </Field>
          <Field label="Start offset (frames)" hint="Trim after the first word">
            <Num name="startOffset" value={scene.startOffset} min={-1000} onChange={(v) => set({ startOffset: v })} />
          </Field>
          <Field label="End offset (frames)" hint="Trim after the last word">
            <Num name="endOffset" value={scene.endOffset} min={-1000} onChange={(v) => set({ endOffset: v })} />
          </Field>
          <div className="col-span-2">
            <Check label="Stop chapters after this scene" checked={Boolean(scene.stopChapteringAfterThis)} onChange={(v) => set({ stopChapteringAfterThis: v })} />
          </div>
          <div className="col-span-2">
            <BRollsEditor folder={folder} bRolls={scene.bRolls} onChange={(bRolls) => set({ bRolls })} />
          </div>
        </>
      ) : null}
      {scene.type === "title" ? (
        <>
          <Field label="Title">
            <Text name="title" value={scene.title} onChange={(v) => set({ title: v })} />
          </Field>
          <Field label="Subtitle">
            <Text name="subtitle" value={scene.subtitle ?? ""} onChange={(v) => set({ subtitle: v || null })} />
          </Field>
        </>
      ) : null}
      {scene.type === "endcard" ? (
        <>
          <Field label="Channel">
            <Select value={scene.channel} options={brand.options} onChange={(v) => set({ channel: v as typeof scene.channel })} />
          </Field>
          {scene.channel === "custom" ? (
            <>
              <Field label="Avatar image URL">
                <Text value={scene.profile?.avatar ?? ""} placeholder="https://…" onChange={(v) => set({ profile: { ...newSceneProfile(scene), avatar: v } })} />
              </Field>
              {(["youtube", "linkedin", "x", "instagram", "discord"] as const).map((k) => (
                <Field key={k} label={k === "x" ? "X" : k[0]?.toUpperCase() + k.slice(1)}>
                  <Text value={scene.profile?.[k] ?? ""} placeholder={k === "youtube" ? "@channel" : "handle"} onChange={(v) => set({ profile: { ...newSceneProfile(scene), [k]: v || null } })} />
                </Field>
              ))}
              <div className="col-span-2">
                <Check label="LinkedIn is a company page" checked={Boolean(scene.profile?.isLinkedInBusinessPage)} onChange={(v) => set({ profile: { ...newSceneProfile(scene), isLinkedInBusinessPage: v } })} />
              </div>
            </>
          ) : null}
          <div className="col-span-2 flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-white/60">Links</span>
            {scene.links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Text value={l.link} onChange={(v) => set({ links: scene.links.map((x, j) => (j === i ? { link: v } : x)) })} placeholder="example.com/page" />
                <button type="button" className="text-[11px] text-red-300" onClick={() => set({ links: scene.links.filter((_, j) => j !== i) })}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="self-start rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-white hover:border-primary/60" onClick={() => set({ links: [...scene.links, { link: "" }] })}>
              + Add link
            </button>
          </div>
        </>
      ) : null}
      {"durationInFrames" in scene ? (
        <Field label="Length (frames)" hint="30 frames = 1 second">
          <Num name="durationInFrames" value={scene.durationInFrames} min={1} onChange={(v) => set({ durationInFrames: v } as Partial<SelectableScene>)} />
        </Field>
      ) : null}
      <Field label="Music">
        <Select name="music" value={scene.music} options={musics.options} onChange={(v) => set({ music: v as SelectableScene["music"] })} />
      </Field>
      <div className="col-span-2">
        <Check name="transitionToNextScene" label="Transition to the next scene" checked={scene.transitionToNextScene} onChange={(v) => set({ transitionToNextScene: v })} />
      </div>
    </div>
  );
};

const newSceneProfile = (scene: Extract<SelectableScene, { type: "endcard" }>) => ({
  avatar: "",
  youtube: null,
  linkedin: null,
  instagram: null,
  discord: null,
  x: null,
  isLinkedInBusinessPage: false,
  ...(scene.profile ?? {}),
});

export const ScenesPanel: React.FC<{
  folder: string;
  props: MainProps;
  onChange: (p: MainProps) => void;
  onSeekToScene?: (index: number) => void;
}> = ({ folder, props, onChange, onSeekToScene }) => {
  const [open, setOpen] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [addType, setAddType] = useState<SceneType>("videoscene");
  const scenes = props.scenes;

  useEffect(() => {
    const onFocus = (e: Event) => {
      const index = (e as CustomEvent<{ index: number }>).detail?.index;
      if (typeof index === "number") setFocused(index);
    };
    window.addEventListener(FOCUS_SCENE_EVENT, onFocus);
    return () => window.removeEventListener(FOCUS_SCENE_EVENT, onFocus);
  }, []);

  const setScenes = (next: SelectableScene[]) => onChange({ ...props, scenes: next });

  return (
    <div className="flex flex-col gap-3" data-recorder="scenes-panel">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Layout">
          <Select name="canvasLayout" value={props.canvasLayout} options={canvasLayouts.options} onChange={(v) => onChange({ ...props, canvasLayout: v as MainProps["canvasLayout"] })} />
        </Field>
        <Field label="Theme">
          <Select name="theme" value={props.theme} options={themes.options} onChange={(v) => onChange({ ...props, theme: v as MainProps["theme"] })} />
        </Field>
        <Field label="Platform">
          <Select name="platform" value={props.platform} options={platforms.options} onChange={(v) => onChange({ ...props, platform: v as MainProps["platform"] })} />
        </Field>
      </div>
      <ol className="flex flex-col gap-2">
        {scenes.map((scene, i) => (
          <li
            key={i}
            data-scene-index={i}
            className={`rounded-xl border p-2.5 ${focused === i ? "border-primary/60 bg-primary/[0.05]" : "border-white/10 bg-white/[0.02]"}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 text-[11px] font-bold text-white/40">{i + 1}</span>
              <select
                aria-label={`Scene ${i + 1} type`}
                className={`${inputCls} flex-1`}
                value={scene.type}
                onChange={(e) => setScenes(scenes.map((s, j) => (j === i ? changeSceneType(s, e.target.value as SceneType) : s)))}
              >
                {SCENE_TYPES.map((t) => (
                  <option key={t.type} value={t.type} className="bg-neutral-900">
                    {t.label}
                  </option>
                ))}
              </select>
              <button type="button" title="Play from here" className="text-xs text-white/60 hover:text-white" onClick={() => onSeekToScene?.(i)}>
                ▶
              </button>
              <button type="button" title="Move up" className="text-xs text-white/60 hover:text-white disabled:opacity-30" disabled={i === 0} onClick={() => setScenes(moveItem(scenes, i, i - 1))}>
                ↑
              </button>
              <button type="button" title="Move down" className="text-xs text-white/60 hover:text-white disabled:opacity-30" disabled={i === scenes.length - 1} onClick={() => setScenes(moveItem(scenes, i, i + 1))}>
                ↓
              </button>
              <button type="button" className="text-[11px] text-white/70 hover:text-white" onClick={() => setOpen(open === i ? null : i)}>
                {open === i ? "Done" : "Edit"}
              </button>
              <button type="button" title="Delete scene" className="text-[11px] text-red-300 hover:text-red-200" onClick={() => setScenes(scenes.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
            {open === i ? (
              <div className="mt-2.5">
                <SceneFields folder={folder} scene={scene} onChange={(s) => setScenes(scenes.map((x, j) => (j === i ? s : x)))} />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <select aria-label="New scene type" className={`${inputCls} flex-1`} value={addType} onChange={(e) => setAddType(e.target.value as SceneType)}>
          {SCENE_TYPES.map((t) => (
            <option key={t.type} value={t.type} className="bg-neutral-900">
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-recorder="add-scene"
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-black"
          onClick={() => {
            setScenes([...scenes, newScene(addType)]);
            setOpen(scenes.length);
          }}
        >
          + Add scene
        </button>
      </div>
    </div>
  );
};
