/* eslint-disable */
import React from 'react';
import { RoadmapLanes } from "../vendored/scenes/roadmap-lanes";
// GENERATED from the RemotionUI docs usage example for "roadmap-lanes" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const items = ["Design", "Build", "Ship"];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <RoadmapLanes
        title="What we are building"
        lanes={[
          { title: "Shipped", color: "#9BD4A0", done: true, items: [{ label: "Render API" }] },
          {
            title: "Building",
            color: "#E8B86D",
            showProgress: true,
            items: [{ label: "Timeline scrubber", progress: 0.72 }],
          },
          { title: "Planned", color: "#7A828F", dashed: true, items: [{ label: "Stem export" }] },
        ]}
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
