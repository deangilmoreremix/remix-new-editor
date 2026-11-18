import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill } from "remotion";
import { Spinner } from "./components/Spinner";
import type { SelectedSource } from "./helpers/get-selected-video-source";
import {
  getCameraStreamConstraints,
  getVideoStream,
} from "./helpers/get-video-stream";
import { Prefix } from "./helpers/prefixes";
import { useMediaSources } from "./state/media-sources";
import { EFFECTS_CHANGED_EVENT } from "./CameraEffects";
// @ts-expect-error JS module without types
import { applyCameraEffects, effectsSettings, loadEffects } from "../../../lib/recorder/effects.js";

// Browser studio addition: camera effects (blur, virtual background, touch-up) on camera sources.
// Recorder's Mirror stays a preview-only toggle, so the effects' mirror is not used here.
const withCameraEffects = async (stream: MediaStream, source: SelectedSource): Promise<MediaStream> => {
  if (source.type !== "camera") return stream;
  try {
    const fx = await applyCameraEffects(stream, effectsSettings({ ...loadEffects(), mirror: false }));
    return fx.stream as MediaStream;
  } catch (e) {
    console.error("Camera effects failed", e);
    return stream;
  }
};

const container: React.CSSProperties = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
};

export type ResolutionAndFps = {
  width: number;
  height: number;
  fps: number;
};

export const Stream: React.FC<{
  prefix: Prefix;
  setResolution: React.Dispatch<React.SetStateAction<ResolutionAndFps | null>>;
  recordAudio: boolean;
  selectedVideoSource: SelectedSource | null;
  selectedAudioSource: string | null;
  preferPortrait: boolean;
  mirror: boolean;
  clear: () => void;
}> = ({
  prefix,
  setResolution,
  recordAudio,
  selectedVideoSource,
  selectedAudioSource,
  preferPortrait,
  mirror,
  clear,
}) => {
  const { mediaSources, setMediaStream } = useMediaSources();
  const mediaStream = mediaSources[prefix];
  // Changing camera effects restarts the camera with the new settings.
  const [effectsVersion, setEffectsVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setEffectsVersion((v) => v + 1);
    window.addEventListener(EFFECTS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(EFFECTS_CHANGED_EVENT, onChange);
  }, []);

  const sourceRef = useRef<HTMLVideoElement>(null);

  const videoStyle: React.CSSProperties = useMemo(() => {
    return {
      opacity: mediaStream ? 1 : 0,
      height: "100%",
      transform: mirror ? "scaleX(-1)" : undefined,
    };
  }, [mediaStream, mirror]);

  useEffect(() => {
    if (mediaStream.streamState.type !== "loaded") {
      return;
    }

    const track = mediaStream.streamState.stream.getVideoTracks()[0];
    if (!track) {
      return;
    }

    track.onended = () => {
      setMediaStream(prefix, { type: "initial" });
    };
  }, [mediaStream, prefix, setMediaStream]);

  useEffect(() => {
    return () => {
      if (mediaStream.streamState.type !== "loaded") {
        return;
      }

      mediaStream.streamState.stream
        .getAudioTracks()
        .forEach((track) => track.stop());

      mediaStream.streamState.stream
        .getVideoTracks()
        .forEach((track) => track.stop());
    };
  }, [mediaStream]);

  useEffect(() => {
    const { current } = sourceRef;
    if (!current) {
      return;
    }

    if (selectedVideoSource === null) {
      setMediaStream(prefix, { type: "initial" });
      return;
    }

    setMediaStream(prefix, { type: "loading" });

    const cleanup: (() => void)[] = [];

    getVideoStream({
      preferPortrait,
      recordAudio,
      selectedAudioSource,
      selectedVideoSource,
    })
      .then((stream) => withCameraEffects(stream, selectedVideoSource))
      .then((stream) => {
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
          throw new Error("No video track");
        }

        videoTrack.addEventListener(
          "ended",
          () => {
            clear();
            setMediaStream(prefix, { type: "initial" });
          },
          { once: true },
        );

        const settings = videoTrack.getSettings();
        if (!settings) {
          throw new Error("No video settings");
        }

        setResolution({
          width: settings.width as number,
          height: settings.height as number,
          fps: settings.frameRate as number,
        });

        if (current) {
          current.srcObject = stream;
          current.play();
        }

        cleanup.push(() => {
          stream.getVideoTracks().forEach((track) => track.stop());
          stream.getAudioTracks().forEach((track) => track.stop());
          current.srcObject = null;
        });

        setMediaStream(prefix, { type: "loaded", stream });
      })
      .catch((e) => {
        const errMessage =
          e.name === "NotReadableError"
            ? "The selected device is not readable. This could be due to another app using this camera."
            : e.name === "OverconstrainedError"
              ? `Could not find a resolution satisfying these constraints: ${JSON.stringify(
                  getCameraStreamConstraints(
                    selectedVideoSource,
                    preferPortrait,
                  ),
                )}`
              : e.message || e.name;

        setMediaStream(prefix, {
          type: "error",
          error: errMessage,
        });
      });

    return () => {
      cleanup.forEach((f) => f());
    };
  }, [
    effectsVersion,
    clear,
    preferPortrait,
    prefix,
    recordAudio,
    selectedAudioSource,
    selectedVideoSource,
    setMediaStream,
    setResolution,
  ]);

  useEffect(() => {
    const { current } = sourceRef;

    if (!current) {
      return;
    }

    const onResize = () => {
      setResolution((r) => {
        if (r === null) {
          return null;
        }

        return {
          ...r,
          width: current.videoWidth,
          height: current.videoHeight,
        };
      });
    };

    current.addEventListener("resize", onResize);

    return () => {
      current.removeEventListener("resize", onResize);
    };
  }, [setResolution]);

  const onReset = useCallback(() => {
    setMediaStream(prefix, {
      type: "initial",
    });
    clear();
  }, [clear, prefix, setMediaStream]);

  return (
    <AbsoluteFill style={container} id={prefix + "-video-container"}>
      <video ref={sourceRef} muted style={videoStyle} />
      {mediaStream.streamState.type === "loading" ? <Spinner /> : null}
      {mediaStream.streamState.type === "error" ? (
        <AbsoluteFill
          style={{
            padding: 20,
            textWrap: "balance",
            color: "rgba(255, 255, 255, 0.5)",
            fontSize: 14,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {mediaStream.streamState.error}
          <a className="underline cursor-pointer" onClick={onReset}>
            Try again
          </a>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
