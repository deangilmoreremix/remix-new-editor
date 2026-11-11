/* eslint-disable */
import React from 'react';
import { SpeakerLabelCaptions } from "../vendored/primitives/speaker-label-captions";
import { parseSubtitles } from "../vendored/lib/caption-utils";
// GENERATED from the RemotionUI docs usage example for "speaker-label-captions" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const vttSource = "WEBVTT\n\n00:00.000 --> 00:02.000\nHello there\n\n00:02.000 --> 00:04.500\nThis is a sample caption\n\n00:04.500 --> 00:07.000\nShip it on Friday";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SpeakerLabelCaptions
        cues={parseSubtitles(vttSource)}
        speakers={[
          { name: "Nadia", color: "#e8b86d", align: "left" },
          { name: "Sam", color: "#2dd4bf", align: "right" },
        ]}
       {...__o}/>
    </div>
  );
}
