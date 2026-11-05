import { describe, it, expect } from "vitest";
import { dropBlobUrls } from "../store";

describe("persisted Motion Director state", () => {
  it("never writes blob: URLs, which are dead after a reload", () => {
    const json = JSON.stringify(
      { clips: [{ props: { file: "blob:http://x/abc", fit: "contain" } }, { props: { file: "https://cdn/x.mp4" } }] },
      dropBlobUrls,
    );
    expect(json).not.toContain("blob:");
    expect(json).toContain("https://cdn/x.mp4");
  });
});

import { vi } from "vitest";
import { prepareMedia, attachWhenReady } from "../lib/mediaUpload";
import { useStore } from "../store";

describe("attaching media", () => {
  it("waits for the duration probe before placing the clip", async () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => "blob:http://x/v") as never;
    const before = useStore.getState().project.tracks.reduce((n, t) => n + t.clips.length, 0);
    const prepared = prepareMedia([new File(["x"], "a.mp4", { type: "video/mp4" })]);
    prepared.forEach((a) => (a.durationSec = undefined));
    const done = attachWhenReady(prepared);
    const count = () => useStore.getState().project.tracks.reduce((n, t) => n + t.clips.length, 0);
    expect(count()).toBe(before); // not inserted synchronously
    await vi.advanceTimersByTimeAsync(5000);
    await done;
    expect(count()).toBe(before + 1);
    vi.useRealTimers();
  });
});
