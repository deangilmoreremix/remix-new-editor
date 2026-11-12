/* eslint-disable */
import React from 'react';
import { Typewriter } from "../vendored/primitives/typewriter";
// GENERATED from the RemotionUI docs usage example for "typewriter" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <Typewriter
        text="Build videos with React.[pause:0.5] One frame at a time."
        charFrames={2}
        humanize
        respectPunctuation
        cursorStyle="block"
       {...__o}/>
    </div>
  );
}
