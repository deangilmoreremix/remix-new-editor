/* eslint-disable */
import React from 'react';
import { TimelineSteps } from "../vendored/scenes/timeline-steps";
// GENERATED from the RemotionUI docs usage example for "timeline-steps" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const steps = [{ title: "Plan", description: "Outline the story" }, { title: "Build", description: "Compose the scenes" }, { title: "Ship", description: "Render and publish" }];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <TimelineSteps steps={[{ title: "Record" }, { title: "Render" }]}  {...__o}/>
    </div>
  );
}
