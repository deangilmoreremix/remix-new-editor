/* eslint-disable */
import React from 'react';
import { SparklineRow } from "../vendored/primitives/sparkline-row";
// GENERATED from the RemotionUI docs usage example for "sparkline-row" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SparklineRow
        rows={[
          { label: "Renders / day", values: [180, 240, 320, 480, 610], delta: "+24%" },
          { label: "Median render", values: [92, 86, 74, 66, 61], delta: "-18%" },
        ]}
        staggerInFrames={20}
       {...__o}/>
    </div>
  );
}
