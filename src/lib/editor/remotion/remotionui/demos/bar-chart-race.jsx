/* eslint-disable */
import React from 'react';
import { BarChartRace } from "../vendored/primitives/bar-chart-race";
// GENERATED from the RemotionUI docs usage example for "bar-chart-race" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const steps = [{ title: "Plan", description: "Outline the story" }, { title: "Build", description: "Compose the scenes" }, { title: "Ship", description: "Render and publish" }];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <BarChartRace
        series={[
          { label: "Studio", values: [42, 58, 66, 72, 78, 84] },
          { label: "Motion", values: [18, 34, 57, 76, 92, 108] },
        ]}
        steps={["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"]}
        framesPerStep={18}
       {...__o}/>
    </div>
  );
}
