/* eslint-disable */
import React from 'react';
import { ChangelogEntry } from "../vendored/scenes/changelog-entry";
// GENERATED from the RemotionUI docs usage example for "changelog-entry" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <ChangelogEntry
        version="v2.4.0"
        date="16 August"
        summary="Captions, webhooks, and a queue that stops sulking."
        changes={[
          { kind: "added", text: "Caption presets for nine languages" },
          { kind: "fixed", text: "Retry backoff no longer stalls the queue" },
          { kind: "removed", text: "Legacy waveform atom" },
        ]}
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
