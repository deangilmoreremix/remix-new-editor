/* eslint-disable */
import React from 'react';
import { SplitTextChars } from "../vendored/primitives/split-text-chars";
import { useSplitText } from "../vendored/lib/text-split";
// GENERATED from the RemotionUI docs usage example for "split-text-chars" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SplitTextChars text="Ship it on Friday" mode="chars" order="center"  {...__o}/>
    </div>
  );
}
