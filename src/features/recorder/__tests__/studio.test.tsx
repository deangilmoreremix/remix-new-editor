// @vitest-environment jsdom
// The browser parts of the Remotion Recorder port: project store (stands in for Remotion
// Studio's public folder and props), saving takes, in-browser captions, takes, scene editing,
// trimming, the end card profile and export.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

// jsdom has no object URLs or media decoding.
let urlSeq = 0;
globalThis.URL.createObjectURL = vi.fn(() => `blob:test/${++urlSeq}`);
globalThis.URL.revokeObjectURL = vi.fn();

vi.mock("../remotion/helpers/get-video-metadata", () => ({
  getVideoMetadata: vi.fn(async () => ({ dimensions: { width: 1280, height: 720 }, durationInSeconds: 4 })),
}));

const store = await import("../studio/project-store");
const { uploadFileToServer, ensureSceneForEachTake } = await import("../app/helpers/upload-file");
const { transcribeVideoOnServer, setTranscriber } = await import("../app/helpers/transcribe-video");
const { cancelTranscribeOnServer } = await import("../app/helpers/cancel-transcribe");
const { listTakes, importTakeFile, deleteTake } = await import("../studio/TakesPanel");
const { newScene, changeSceneType, moveItem, ScenesPanel } = await import("../studio/ScenesPanel");
const { videoConf } = await import("../config/scenes");
const { getStartEndFrame } = await import("../remotion/calculate-metadata/get-start-end-frame");
const { getChannel, getAvatar } = await import("../config/endcard");
const { emptyProjectProps, defaultVideoScene } = await import("../studio/project-defaults");
const { createFolder } = await import("../app/actions/create-folder");
const { fetchProjectFolders } = await import("../app/actions/fetch-project-folders");

const blob = (text: string, type = "video/webm") => new Blob([text], { type });

beforeEach(() => {
  store.__resetProjectStore();
  setTranscriber(null);
});
afterEach(() => vi.restoreAllMocks());

describe("project store (Remotion Studio file and props APIs)", () => {
  test("files are listed like getStaticFiles(), watched, and deleted", async () => {
    const seen: (string | null)[] = [];
    store.watchStaticFile("p/subs1.json", (f) => seen.push(f ? f.name : null));
    await store.writeStaticFile({ filePath: "/p/subs1.json", contents: "[]" });
    await store.writeStaticFile({ filePath: "p/webcam1.webm", contents: blob("v") });
    expect(store.getStaticFiles().map((f) => f.name)).toEqual(["p/subs1.json", "p/webcam1.webm"]);
    expect(store.getStaticFile("p/webcam1.webm")).toMatchObject({ sizeInBytes: 1, src: expect.stringMatching(/^blob:/) });
    expect(store.getFileBlob("p/subs1.json")?.type).toBe("application/json");
    await store.deleteStaticFile("p/subs1.json");
    expect(seen).toEqual(["p/subs1.json", null]);
    expect(store.listFolders()).toEqual(["p"]);
  });

  test("updateDefaultProps / saveDefaultProps update the project's props", async () => {
    await store.setProps("p", { scenes: [1, 2, 3] });
    await store.saveDefaultProps({
      compositionId: "p",
      defaultProps: ({ unsavedDefaultProps }) => ({ ...unsavedDefaultProps, scenes: (unsavedDefaultProps.scenes as number[]).filter((n) => n !== 2) }),
    });
    expect(store.getProps("p")).toEqual({ scenes: [1, 3] });
  });

  test("project files are referred to by name in saved props and resolved when drawn", async () => {
    await store.writeStaticFile({ filePath: "p/broll.png", contents: blob("img", "image/png") });
    const ref = store.projectSrc("p/broll.png");
    expect(ref).toBe("project:p/broll.png");
    expect(store.resolveProjectSrc(ref)).toBe(store.getStaticFile("p/broll.png")?.src);
    expect(store.resolveProjectSrc("https://x/y.png")).toBe("https://x/y.png");
  });

  test("projects are created with valid names only, and are listed", async () => {
    await expect(createFolder("bad name!")).rejects.toThrow(/letters, numbers/);
    await createFolder("launch-video");
    await expect(createFolder("launch-video")).rejects.toThrow(/already exists/);
    expect((await fetchProjectFolders()).folders).toEqual(["launch-video"]);
    expect(store.getProps("launch-video")).toMatchObject({ scenes: [], canvasLayout: "landscape" });
  });

  test("the scene list follows playback through focusDefaultPropsPath", () => {
    const onFocus = vi.fn();
    window.addEventListener(store.FOCUS_SCENE_EVENT, onFocus);
    store.focusDefaultPropsPath({ path: ["scenes", 2] });
    expect(onFocus.mock.calls[0]?.[0].detail).toEqual({ index: 2 });
    window.removeEventListener(store.FOCUS_SCENE_EVENT, onFocus);
  });
});

describe("saving a take (replaces the local server upload)", () => {
  test("each source is saved as <folder>/<prefix><endDate>.<ext> and a scene is added per webcam take", async () => {
    await store.setProps("p", { ...emptyProjectProps(), scenes: [newScene("title"), newScene("endcard")] });
    await uploadFileToServer({ blob: blob("cam"), endDate: 1000, prefix: "webcam", selectedFolder: "p", expectedFrames: 90, mimeType: "video/webm;codecs=vp8,opus" });
    await uploadFileToServer({ blob: blob("scr"), endDate: 1000, prefix: "display", selectedFolder: "p", expectedFrames: 90, mimeType: "video/webm;codecs=vp8" });
    expect(store.getStaticFiles().map((f) => f.name)).toEqual(["p/display1000.webm", "p/webcam1000.webm"]);
    const types = (store.getProps("p") as { scenes: { type: string }[] }).scenes.map((s) => s.type);
    // The new video scene goes before the end card.
    expect(types).toEqual(["title", "videoscene", "endcard"]);
    await ensureSceneForEachTake("p");
    expect((store.getProps("p") as { scenes: unknown[] }).scenes).toHaveLength(3);
  });
});

describe("captions in the browser (replaces Whisper.cpp on the server)", () => {
  test("transcribes the webcam take and saves Recorder caption JSON as subs<endDate>.json", async () => {
    await store.writeStaticFile({ filePath: "p/webcam1000.webm", contents: blob("cam") });
    const transcriber = vi.fn(async (_src: string, opts: { onProgress?: (p: { stage: string; progress: number }) => void }) => {
      opts.onProgress?.({ stage: "download", progress: 0.5 });
      return { captions: [{ text: "Hi", startMs: 0, endMs: 300, timestampMs: 150, confidence: 1 }] };
    });
    setTranscriber(transcriber);
    const statuses: string[] = [];
    await transcribeVideoOnServer({ endDate: 1000, selectedFolder: "p", onProgress: (s) => statuses.push(`${s.title} ${s.description}`) });
    expect(transcriber.mock.calls[0]?.[0]).toBe(store.getStaticFile("p/webcam1000.webm")?.src);
    expect(statuses).toContain("Downloading Whisper model 50%");
    const saved = store.getFileBlob("p/subs1000.json");
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(saved as Blob);
    });
    expect(JSON.parse(text)).toEqual([{ text: "Hi", startMs: 0, endMs: 300, timestampMs: 150, confidence: 1 }]);
  });

  test("Abort stops the run and reports it the way Recorder expects", async () => {
    await store.writeStaticFile({ filePath: "p/webcam1000.webm", contents: blob("cam") });
    setTranscriber((_src, opts) => new Promise((_resolve, reject) => {
      opts.signal?.addEventListener("abort", () => reject(Object.assign(new Error("stopped"), { name: "AbortError" })));
    }));
    const run = transcribeVideoOnServer({ endDate: 1000, selectedFolder: "p", onProgress: () => {} });
    await new Promise((r) => setTimeout(r, 0));
    await cancelTranscribeOnServer();
    await expect(run).rejects.toThrow("aborted by user");
    expect(store.getStaticFile("p/subs1000.json")).toBeNull();
  });

  test("a missing take is an error", async () => {
    await expect(transcribeVideoOnServer({ endDate: 5, selectedFolder: "p", onProgress: () => {} })).rejects.toThrow(/No webcam take/);
  });
});

describe("takes", () => {
  test("angles and captions are grouped with their webcam take, oldest first", async () => {
    for (const name of ["p/webcam2000.webm", "p/webcam1000.mp4", "p/display1000.mp4", "p/alternative11000.mp4", "p/subs1000.json", "q/webcam5.webm"]) {
      await store.writeStaticFile({ filePath: name, contents: blob("x") });
    }
    const takes = listTakes("p");
    expect(takes.map((t) => t.timestamp)).toEqual([1000, 2000]);
    expect(takes[0]).toMatchObject({ display: { name: "p/display1000.mp4" }, alternative1: { name: "p/alternative11000.mp4" }, captions: { name: "p/subs1000.json" }, alternative2: null });
    expect(takes[1]?.display).toBeNull();
    await deleteTake(takes[0] as (typeof takes)[number]);
    expect(store.getStaticFiles().filter((f) => f.name.startsWith("p/")).map((f) => f.name)).toEqual(["p/webcam2000.webm"]);
  });

  test("an outside recording becomes a take with a scene; a second angle joins an existing take", async () => {
    await store.setProps("p", emptyProjectProps());
    const ts = await importTakeFile({ folder: "p", file: new File(["v"], "talk.MOV", { type: "video/quicktime" }), timestamp: 42 });
    await importTakeFile({ folder: "p", file: new File(["s"], "screen.webm", { type: "video/webm" }), prefix: "display", timestamp: ts });
    expect(store.getStaticFiles().map((f) => f.name)).toEqual(["p/display42.webm", "p/webcam42.mov"]);
    expect((store.getProps("p") as { scenes: unknown[] }).scenes).toHaveLength(1);
  });
});

describe("scenes (replaces the Studio props sidebar)", () => {
  test("every new scene type is valid against Recorder's schema", () => {
    for (const type of ["videoscene", "title", "endcard", "tableofcontents", "recorder"] as const) {
      const props = { theme: "light", canvasLayout: "square", platform: "x", scenes: [newScene(type)] };
      expect(videoConf.safeParse(props).success, type).toBe(true);
    }
  });

  test("changing a scene's type keeps its music and transition; moving reorders", () => {
    const changed = changeSceneType({ ...defaultVideoScene(), music: "epic", transitionToNextScene: false }, "title");
    expect(changed).toMatchObject({ type: "title", music: "epic", transitionToNextScene: false });
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });

  test("the panel edits layout, adds scenes and edits a scene's fields", () => {
    let props = { ...emptyProjectProps(), scenes: [defaultVideoScene()] };
    const onChange = vi.fn((p) => {
      props = p;
    });
    const { rerender } = render(<ScenesPanel folder="p" props={props} onChange={onChange} />);
    fireEvent.change(document.querySelector('select[name="canvasLayout"]') as Element, { target: { value: "square" } });
    expect(props.canvasLayout).toBe("square");
    rerender(<ScenesPanel folder="p" props={props} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("New scene type"), { target: { value: "title" } });
    fireEvent.click(screen.getByText("+ Add scene"));
    expect(props.scenes.map((s) => s.type)).toEqual(["videoscene", "title"]);
    rerender(<ScenesPanel folder="p" props={props} onChange={onChange} />);
    fireEvent.change(document.querySelector('input[name="title"]') as Element, { target: { value: "Welcome" } });
    expect(props.scenes[1]).toMatchObject({ type: "title", title: "Welcome" });
  });
});

describe("trimming to speech", () => {
  test("trims to the first and last word, but keeps the whole take if captions fall outside it", async () => {
    const scene = defaultVideoScene();
    const words = [
      { text: "Hi", startMs: 1000, endMs: 1200, timestampMs: 1100, confidence: 1 },
      { text: " there", startMs: 1200, endMs: 1500, timestampMs: 1350, confidence: 1 },
    ];
    const trimmed = await getStartEndFrame({ scene, recordingDurationInSeconds: 4, captions: words });
    expect(trimmed.actualStartFrame).toBeGreaterThan(0);
    expect(trimmed.derivedEndFrame).toBeLessThan(120);
    const invented = words.map((w) => ({ ...w, startMs: w.startMs + 9000, endMs: w.endMs + 9000, timestampMs: w.timestampMs + 9000 }));
    expect(await getStartEndFrame({ scene, recordingDurationInSeconds: 4, captions: invented })).toEqual({ actualStartFrame: 0, derivedEndFrame: 120 });
  });
});

describe("end card", () => {
  test("a custom channel uses the scene's own profile", () => {
    const profile = { avatar: "https://x/me.png", youtube: "@me", linkedin: null, instagram: null, discord: null, x: "@me", isLinkedInBusinessPage: false };
    expect(getChannel("custom", profile)).toEqual({ youtube: "@me", linkedin: null, instagram: null, discord: null, x: "@me", isLinkedInBusinessPage: false });
    expect(getAvatar("custom", profile)).toBe("https://x/me.png");
    expect(getAvatar("custom", undefined)).toBe("");
    expect(getChannel("remotion").x).toBe("@remotion");
  });
});

describe("export", () => {
  test("renders the project with the first codec the browser supports, and returns its SRT", async () => {
    const { exportProject } = await import("../studio/export");
    await store.writeStaticFile({ filePath: "p/webcam1000.webm", contents: blob("cam") });
    await store.writeStaticFile({ filePath: "p/subs1000.json", contents: JSON.stringify([{ text: "Hello", startMs: 500, endMs: 900, timestampMs: 700, confidence: 1 }]) });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify([{ text: "Hello", startMs: 500, endMs: 900, timestampMs: 700, confidence: 1 }]))) as typeof fetch;
    await store.setProps("p", { ...emptyProjectProps(), scenes: [defaultVideoScene()] });
    const renderMediaOnWeb = vi.fn(async () => ({ getBlob: async () => new Blob(["mp4"]) }));
    const canRenderMediaOnWeb = vi.fn(async ({ container }: { container: string }) => ({ canRender: container === "webm" }));
    const progress: number[] = [];
    const result = await exportProject({ folder: "p", renderer: { renderMediaOnWeb, canRenderMediaOnWeb } as never, onProgress: (p) => progress.push(p) });
    const call = (renderMediaOnWeb.mock.calls[0] as unknown as [Record<string, any>])[0];
    expect(call).toMatchObject({ container: "webm", videoCodec: "vp8", licenseKey: expect.any(String), composition: { id: "p", width: 1920, height: 1080, fps: 30 } });
    expect(call.composition.durationInFrames).toBeGreaterThan(0);
    expect(result).toMatchObject({ mimeType: "video/webm", ext: "webm" });
    expect(result.blob.type).toBe("video/webm");
    expect(result.srt).toContain("Hello");
  });

  test("an empty project or an unsupported browser is explained", async () => {
    const { exportProject } = await import("../studio/export");
    await store.setProps("p", emptyProjectProps());
    const renderer = { renderMediaOnWeb: vi.fn(), canRenderMediaOnWeb: vi.fn(async () => ({ canRender: false })) } as never;
    await expect(exportProject({ folder: "p", renderer })).rejects.toThrow(/no scenes/);
    await store.setProps("p", { ...emptyProjectProps(), scenes: [newScene("title")] });
    await expect(exportProject({ folder: "p", renderer })).rejects.toThrow(/cannot export/);
  });
});
