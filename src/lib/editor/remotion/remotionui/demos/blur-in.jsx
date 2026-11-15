/* eslint-disable */
import React from 'react';
import { BlurIn } from "../vendored/primitives/blur-in";
// GENERATED from the RemotionUI docs usage example for "blur-in" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <BlurIn maxBlur={12} {...__o}>
        <h1>{__o.text1 ?? "Focus reveal"}</h1>
      </BlurIn>
    </div>
  );
}
