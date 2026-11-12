import { __T, __S } from "../shim";
/**
 * Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 *
 * Happy coding and building amazing videos! 🎉
 */

"use client";

import { useCurrentFrame, useVideoConfig } from "../shim";

export default function GlitchText() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const glitchIntensity = Math.sin(frame / 10) * 10;
  const rgbOffset = Math.sin(frame / 5) * 5;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        fontSize: "5rem",
        fontWeight: "bold",
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          position: "absolute",
          color: "cyan",
          transform: `translate(${rgbOffset}px, ${glitchIntensity}px)`,
          mixBlendMode: "screen",
        }}
      >
        <__T i={1} d={"GLITCH"} />
      </div>
      <div
        style={{
          position: "absolute",
          color: "magenta",
          transform: `translate(${-rgbOffset}px, ${-glitchIntensity}px)`,
          mixBlendMode: "screen",
        }}
      >
        <__T i={2} d={"GLITCH"} />
      </div>
      <div style={{ color: "white", opacity: 0.8 }}><__T i={3} d={"GLITCH"} /></div>
    </div>
  );
}
