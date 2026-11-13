/* eslint-disable */
import React from 'react';
import { StaggerChildren } from "../vendored/primitives/stagger-children";
import { SlideLeft } from "../vendored/primitives/slide-left";
// GENERATED from the RemotionUI docs usage example for "stagger-children" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const items = ["Design", "Build", "Ship"];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <StaggerChildren staggerInFrames={8} exitStaggerInFrames={6} {...__o}>
        {items.map((item) => (
          <SlideLeft key={item} exit><span>{item}</span></SlideLeft>
        ))}
      </StaggerChildren>
    </div>
  );
}
