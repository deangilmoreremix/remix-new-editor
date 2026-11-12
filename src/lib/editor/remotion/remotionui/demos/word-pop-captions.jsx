/* eslint-disable */
import React from 'react';
import { WordPopCaptions } from "../vendored/primitives/word-pop-captions";
import { groupCaptionsIntoPages } from "../vendored/lib/caption-utils";
// GENERATED from the RemotionUI docs usage example for "word-pop-captions" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const captions = ["Ship", "the", "scene", "on", "Friday", "with", "confidence"].map((t, i) => ({ text: (i ? " " : "") + t, startMs: i * 450, endMs: i * 450 + 420, timestampMs: i * 450 + 210, confidence: 1 }));
  const [page] = groupCaptionsIntoPages(captions, 4000);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <WordPopCaptions page={page} strokeWidth={4}  {...__o}/>
    </div>
  );
}
