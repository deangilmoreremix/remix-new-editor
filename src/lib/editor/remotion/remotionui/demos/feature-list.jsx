/* eslint-disable */
import React from 'react';
import { FeatureList } from "../vendored/scenes/feature-list";
// GENERATED from the RemotionUI docs usage example for "feature-list" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const items = ["Design", "Build", "Ship"];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <FeatureList
        title="Why RemotionUI"
        items={["Own your components", "Live previews", "CLI workflow"]}
       {...__o}/>
    </div>
  );
}
