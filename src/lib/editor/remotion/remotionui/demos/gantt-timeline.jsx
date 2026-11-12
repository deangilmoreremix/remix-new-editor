/* eslint-disable */
import React from 'react';
import { GanttTimeline } from "../vendored/primitives/gantt-timeline";
// GENERATED from the RemotionUI docs usage example for "gantt-timeline" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <GanttTimeline
        tasks={[
          { label: "Registry build", start: 1, end: 4, progress: 0.8 },
          { label: "Launch", start: 7.6, end: 7.6, milestone: true },
        ]}
        columns={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"]}
        markerAt={5.5}
        markerLabel="Today"
       {...__o}/>
    </div>
  );
}
