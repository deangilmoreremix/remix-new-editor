import { useRef } from "react";
import type { BRoll, SelectableScene } from "../composition/config/scenes";
import { FPS } from "../composition/config/fps";
import { COMPOSITION_ID } from "../project-store";
import type { RecorderProject } from "../project";
import { staticFile, writeStaticFile } from "../studio-shim";
import { Check, Field, Select, SecondsInput, TextInput } from "./controls";

type VideoScene = Extract<SelectableScene, { type: "videoscene" }>;

const MUSIC = [
  { value: "previous", label: "Keep previous" },
  { value: "none", label: "No music" },
  { value: "soft", label: "Soft" },
  { value: "epic", label: "Epic" },
  { value: "euphoric", label: "Euphoric" },
] as const;

const POSITIONS = [
  { value: "previous", label: "Same as previous" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
] as const;

export const sceneLabel = (scene: SelectableScene, videoNumber: number): string => {
  switch (scene.type) {
    case "videoscene":
      return `Recording ${videoNumber}`;
    case "title":
      return scene.title || "Title";
    case "endcard":
      return "End card";
    case "tableofcontents":
      return "Table of contents";
    case "recorder":
      return "Intro";
    default:
      return "Scene";
  }
};

const KIND: Record<string, string> = { videoscene: "Video", title: "Title", endcard: "End card", tableofcontents: "Chapters" };

const BRollEditor = ({ scene, onChange }: { scene: VideoScene; onChange: (bRolls: BRoll[]) => void }) => {
  const input = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: BRoll[] = [];
    for (const file of Array.from(files)) {
      const path = `${COMPOSITION_ID}/broll-${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      await writeStaticFile({ filePath: path, contents: await file.arrayBuffer() });
      added.push({ source: staticFile(path), durationInFrames: 3 * FPS, from: FPS });
    }
    onChange([...scene.bRolls, ...added]);
  };

  return (
    <div className="rs-field">
      <span className="rs-label">B-roll</span>
      {scene.bRolls.map((b, i) => (
        <div className="rs-card" key={`${b.source}-${i}`}>
          <div className="rs-row">
            <Field label="Starts at (s)">
              <SecondsInput frames={b.from} min={0} onChange={(from) => onChange(scene.bRolls.map((x, j) => (j === i ? { ...x, from } : x)))} />
            </Field>
            <Field label="Length (s)">
              <SecondsInput frames={b.durationInFrames} min={0.5} onChange={(durationInFrames) => onChange(scene.bRolls.map((x, j) => (j === i ? { ...x, durationInFrames } : x)))} />
            </Field>
            <button className="rs-btn danger" onClick={() => onChange(scene.bRolls.filter((_, j) => j !== i))} aria-label="Remove B-roll">
              ✕
            </button>
          </div>
        </div>
      ))}
      <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      <button className="rs-btn" onClick={() => input.current?.click()}>
        + Add B-roll image or video
      </button>
      <span className="rs-hint">Appears over the recording at the chosen time.</span>
    </div>
  );
};

const SceneForm = ({ project, index, scene }: { project: RecorderProject; index: number; scene: SelectableScene }) => {
  const patch = (p: Partial<SelectableScene>) => project.updateScene(index, p);
  const common = (
    <>
      <Field label="Music">
        <Select value={scene.music} options={[...MUSIC]} onChange={(music) => patch({ music })} />
      </Field>
      <Check checked={scene.transitionToNextScene} onChange={(transitionToNextScene) => patch({ transitionToNextScene })} label="Animated transition to the next scene" />
    </>
  );

  if (scene.type === "videoscene") {
    return (
      <>
        <Field label="Facecam position">
          <Select value={scene.webcamPosition} options={[...POSITIONS]} onChange={(webcamPosition) => patch({ webcamPosition })} />
        </Field>
        <div className="rs-row">
          <Field label="Trim start (s)" hint="+ starts later">
            <SecondsInput frames={scene.startOffset} onChange={(startOffset) => patch({ startOffset })} />
          </Field>
          <Field label="Trim end (s)" hint="+ ends later">
            <SecondsInput frames={scene.endOffset} onChange={(endOffset) => patch({ endOffset })} />
          </Field>
        </div>
        <span className="rs-hint">With captions generated, silence before the first and after the last word is cut automatically. Trim adds to that.</span>
        <Field label="Chapter title" hint="Shows a chapter marker at the start of this recording.">
          <TextInput value={scene.newChapter ?? ""} onChange={(newChapter) => patch({ newChapter })} placeholder="e.g. Getting started" />
        </Field>
        <Check checked={Boolean(scene.stopChapteringAfterThis)} onChange={(stopChapteringAfterThis) => patch({ stopChapteringAfterThis })} label="Stop chapters after this recording" />
        {common}
        <BRollEditor scene={scene} onChange={(bRolls) => patch({ bRolls })} />
      </>
    );
  }

  if (scene.type === "title") {
    return (
      <>
        <Field label="Title">
          <TextInput value={scene.title} onChange={(title) => patch({ title })} />
        </Field>
        <Field label="Subtitle">
          <TextInput value={scene.subtitle ?? ""} onChange={(subtitle) => patch({ subtitle: subtitle || null })} />
        </Field>
        <Field label="Length (s)">
          <SecondsInput frames={scene.durationInFrames} min={1} onChange={(durationInFrames) => patch({ durationInFrames })} />
        </Field>
        {common}
      </>
    );
  }

  if (scene.type === "endcard" || scene.type === "tableofcontents") {
    return (
      <>
        <Field label="Length (s)">
          <SecondsInput frames={scene.durationInFrames} min={1} onChange={(durationInFrames) => patch({ durationInFrames })} />
        </Field>
        {scene.type === "endcard" ? (
          <div className="rs-field">
            <span className="rs-label">Links</span>
            {scene.links.map((l, i) => (
              <div className="rs-row" key={i}>
                <TextInput value={l.link} placeholder="example.com/subscribe" onChange={(link) => patch({ links: scene.links.map((x, j) => (j === i ? { link } : x)) })} />
                <button className="rs-btn danger" onClick={() => patch({ links: scene.links.filter((_, j) => j !== i) })} aria-label="Remove link">
                  ✕
                </button>
              </div>
            ))}
            <button className="rs-btn" onClick={() => patch({ links: [...scene.links, { link: "" }] })}>
              + Add link
            </button>
            <span className="rs-hint">Your channel name and avatar are set under Style.</span>
          </div>
        ) : (
          <span className="rs-hint">Lists the chapters you add to your recordings.</span>
        )}
        {common}
      </>
    );
  }

  return <span className="rs-hint">This scene has no settings.</span>;
};

export const ScenesPanel = ({
  project,
  scenes,
  selected,
  setSelected,
  liveIndex,
}: {
  project: RecorderProject;
  scenes: SelectableScene[];
  selected: number;
  setSelected: (i: number) => void;
  liveIndex: number | null;
}) => {
  let videoCount = 0;
  const current = scenes[selected];

  return (
    <>
      <div className="rs-scenes">
        {scenes.map((scene, i) => {
          if (scene.type === "videoscene") videoCount += 1;
          return (
            <button key={i} className={`rs-scene${i === selected ? " sel" : ""}${i === liveIndex ? " live" : ""}`} onClick={() => setSelected(i)}>
              <span>{sceneLabel(scene, videoCount)}</span>
              <span className="rs-kind">{KIND[scene.type] ?? scene.type}</span>
            </button>
          );
        })}
        {scenes.length === 0 ? <span className="rs-hint">No scenes yet. Record a take, or add a title below.</span> : null}
      </div>

      <div className="rs-row">
        <button className="rs-btn" onClick={() => project.addScene({ type: "title", title: "Title", subtitle: null, durationInFrames: 50, music: "previous", transitionToNextScene: true })}>
          + Title
        </button>
        <button className="rs-btn" onClick={() => project.addScene({ type: "tableofcontents", durationInFrames: 200, music: "previous", transitionToNextScene: true })}>
          + Chapters
        </button>
        <button className="rs-btn" onClick={() => project.addScene({ type: "endcard", durationInFrames: 200, channel: "custom", links: [], music: "previous", transitionToNextScene: true })}>
          + End card
        </button>
      </div>

      {current ? (
        <>
          <div className="rs-divider" />
          <div className="rs-row">
            <span className="rs-label" style={{ marginRight: "auto" }}>
              Scene settings
            </span>
            <button className="rs-btn" disabled={selected === 0} onClick={() => { if (project.moveScene(selected, -1)) setSelected(selected - 1); }} aria-label="Move up">
              ↑
            </button>
            <button className="rs-btn" disabled={selected === scenes.length - 1} onClick={() => { if (project.moveScene(selected, 1)) setSelected(selected + 1); }} aria-label="Move down">
              ↓
            </button>
            <button
              className="rs-btn danger"
              onClick={() => {
                if (current.type === "videoscene" && !window.confirm("Delete this recording and its scene? This removes the recorded files.")) return;
                void project.removeScene(selected);
                setSelected(Math.max(0, selected - 1));
              }}
            >
              Delete
            </button>
          </div>
          <SceneForm key={selected} project={project} index={selected} scene={current} />
        </>
      ) : null}
    </>
  );
};
