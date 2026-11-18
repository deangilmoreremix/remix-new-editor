/* eslint-disable */
import React from 'react';
import { CodeDiffWipe } from "../vendored/scenes/code-diff-wipe";
// GENERATED from the RemotionUI docs usage example for "code-diff-wipe" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const before = "const total = items.map((i) => i.price).reduce((a, b) => a + b, 0);";
  const after = "const total = sum(items, (i) => i.price);";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <CodeDiffWipe before={before} after={after} title="render.ts"  {...__o}/>
    </div>
  );
}
