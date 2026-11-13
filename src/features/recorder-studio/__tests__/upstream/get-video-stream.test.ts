// Ported unchanged from remotion-dev/recorder tests/ (bun:test -> vitest, import paths rewired to this repo).
import { expect, test } from "vitest";
import {
  getAudioStreamConstraints,
  getCameraStreamConstraints,
} from "../../../../components/modals/recorder/capture.js";

test("requires the selected camera instead of accepting the browser default", () => {
  expect(
    getCameraStreamConstraints(
      {
        type: "camera",
        deviceId: "camo-camera-id",
        maxWidth: 1920,
        maxHeight: 1080,
        minFps: 30,
      },
      false,
    ),
  ).toMatchObject({
    deviceId: { exact: "camo-camera-id" },
  });
});

test("requires the selected microphone instead of accepting the browser default", () => {
  expect(
    getAudioStreamConstraints({
      recordAudio: true,
      selectedAudioSource: "camo-microphone-id",
    }),
  ).toEqual({
    deviceId: { exact: "camo-microphone-id" },
  });
});

test("does not request a microphone when audio recording is disabled", () => {
  expect(
    getAudioStreamConstraints({
      recordAudio: false,
      selectedAudioSource: "camo-microphone-id",
    }),
  ).toBeUndefined();
});
