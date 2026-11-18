/* eslint-disable */
import React from 'react';
import { PollOverlay } from "../vendored/scenes/poll-overlay";
// GENERATED from the RemotionUI docs usage example for "poll-overlay" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <PollOverlay
        badge="Poll"
        question="Which should we build next?"
        options={[
          { label: "Timeline editor", votes: 412 },
          { label: "Batch renders", votes: 268 },
          { label: "Team presets", votes: 143 },
        ]}
        totalLabel="823 votes · closes in 2m"
        holdSeconds={4}
       {...__o}/>
    </div>
  );
}
