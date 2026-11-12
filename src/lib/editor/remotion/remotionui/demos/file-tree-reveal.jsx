/* eslint-disable */
import React from 'react';
import { FileTreeReveal } from "../vendored/scenes/file-tree-reveal";
// GENERATED from the RemotionUI docs usage example for "file-tree-reveal" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <FileTreeReveal
        title="northstar-studio"
        nodes={[
          { name: "src", children: [{ name: "index.ts" }] },
          { name: "package.json" },
        ]}
        selectedPath="src/index.ts"
        holdSeconds={4}
       {...__o}/>
    </div>
  );
}
