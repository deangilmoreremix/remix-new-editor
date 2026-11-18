/* eslint-disable */
import React from 'react';
import { KaraokeCaptions } from "../vendored/primitives/karaoke-captions";
import { createTikTokStyleCaptions } from "@remotion/captions";
// GENERATED from the RemotionUI docs usage example for "karaoke-captions" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const captions = ["Ship", "the", "scene", "on", "Friday", "with", "confidence"].map((t, i) => ({ text: (i ? " " : "") + t, startMs: i * 450, endMs: i * 450 + 420, timestampMs: i * 450 + 210, confidence: 1 }));
  const [page] = createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 1500 }).pages;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <KaraokeCaptions page={page} mode="scale"  {...__o}/>
    </div>
  );
}
