/* eslint-disable */
import React from 'react';
import { CaptionEmojiBeat } from "../vendored/primitives/caption-emoji-beat";
// GENERATED from the RemotionUI docs usage example for "caption-emoji-beat" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <CaptionEmojiBeat
        text="Punctuate the beat, not the sentence"
        beats={[
          { emoji: "🔥", atInFrames: 10, x: 22, y: 26, rotate: -8 },
          { emoji: "🚀", atInFrames: 80, x: 50, y: 16, scale: 96 },
        ]}
       {...__o}/>
    </div>
  );
}
