/* eslint-disable */
import React from 'react';
import { SubtitleTranslate } from "../vendored/primitives/subtitle-translate";
// GENERATED from the RemotionUI docs usage example for "subtitle-translate" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SubtitleTranslate
        cues={[
          {
            text: "The transcript is the edit.",
            translation: "La transcripción es el montaje.",
            startMs: 0,
            endMs: 1450,
          },
        ]}
        languageLabels={["EN", "ES"]}
       {...__o}/>
    </div>
  );
}
