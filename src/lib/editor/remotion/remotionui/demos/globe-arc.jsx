/* eslint-disable */
import React from 'react';
import { GlobeArc } from "../vendored/primitives/globe-arc";
// GENERATED from the RemotionUI docs usage example for "globe-arc" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <GlobeArc
        size={380}
        routes={[
          { from: { lng: -74, lat: 40.7, label: "NYC" }, to: { lng: -0.1, lat: 51.5, label: "London" } },
        ]}
       {...__o}/>
    </div>
  );
}
