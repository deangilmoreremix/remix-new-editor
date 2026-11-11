/* eslint-disable */
import React from 'react';
import { WaterfallChart } from "../vendored/primitives/waterfall-chart";
// GENERATED from the RemotionUI docs usage example for "waterfall-chart" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const steps = [{ title: "Plan", description: "Outline the story" }, { title: "Build", description: "Compose the scenes" }, { title: "Ship", description: "Render and publish" }];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <WaterfallChart
        steps={[
          { label: "Q1 open", value: 320, isTotal: true },
          { label: "New", value: 180 },
          { label: "Churn", value: -74 },
          { label: "Q2 close", value: 484, isTotal: true },
        ]}
        staggerInFrames={15}
       {...__o}/>
    </div>
  );
}
