/* eslint-disable */
import React from 'react';
import { DataStory } from "../vendored/compositions/data-story";
// GENERATED from the RemotionUI docs usage example for "data-story" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const metrics = [{ label: "Views", value: 124000 }, { label: "Watch time (h)", value: 8200 }, { label: "Subscribers", value: 3150 }];
  const barData = [{ label: "Shorts", value: 124000 }, { label: "Long-form", value: 86000 }, { label: "Live", value: 41000 }];
  const steps = [{ title: "Plan", description: "Outline the story" }, { title: "Build", description: "Compose the scenes" }, { title: "Ship", description: "Render and publish" }];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <DataStory barData={barData} metrics={metrics} steps={steps}  {...__o}/>
    </div>
  );
}
