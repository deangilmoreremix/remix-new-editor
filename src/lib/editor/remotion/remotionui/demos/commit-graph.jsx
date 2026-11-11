/* eslint-disable */
import React from 'react';
import { CommitGraph } from "../vendored/scenes/commit-graph";
// GENERATED from the RemotionUI docs usage example for "commit-graph" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <CommitGraph
        commits={[
          { message: "Seed the registry manifest", hash: "9c41f0a" },
          { message: "Add render queue worker", hash: "3ab77e2" },
          { message: "Branch: retry backoff", hash: "d0e91c4", lane: 1, parent: 1 },
          { message: "Cap retries at five", hash: "51b2fa8", lane: 1 },
          { message: "Ship caption presets", hash: "7f30dd1", lane: 0, parent: 1 },
          { message: "Merge retry backoff", hash: "b8c4e05", parent: 4, mergeFrom: 3, ref: "main" },
        ]}
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
