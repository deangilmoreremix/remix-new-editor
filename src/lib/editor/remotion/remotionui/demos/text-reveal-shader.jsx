/* eslint-disable */
import React from 'react';
import { TextRevealShader } from "../vendored/primitives/text-reveal-shader";
// GENERATED from the RemotionUI docs usage example for "text-reveal-shader" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <TextRevealShader text={"LIQUID\nCHROME"} bandWidth={0.022} settle={0.16}  {...__o}/>
    </div>
  );
}
