/* eslint-disable */
import React from 'react';
import { TranscriptScroll } from "../vendored/primitives/transcript-scroll";
import { parseSubtitles } from "../vendored/lib/caption-utils";
// GENERATED from the RemotionUI docs usage example for "transcript-scroll" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const vttSource = "WEBVTT\n\n00:00.000 --> 00:02.000\nHello there\n\n00:02.000 --> 00:04.500\nThis is a sample caption\n\n00:04.500 --> 00:07.000\nShip it on Friday";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <TranscriptScroll cues={parseSubtitles(vttSource)} width={740} height={400}  {...__o}/>
    </div>
  );
}
