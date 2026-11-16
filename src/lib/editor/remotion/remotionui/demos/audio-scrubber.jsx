/* eslint-disable */
import React from 'react';
import { AudioScrubber } from "../vendored/primitives/audio-scrubber";
// GENERATED from the RemotionUI docs usage example for "audio-scrubber" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <AudioScrubber
        durationInFrames={120}
        marks={[{ atInFrames: 66, label: "Quote" }]}
       {...__o}/>
    </div>
  );
}
