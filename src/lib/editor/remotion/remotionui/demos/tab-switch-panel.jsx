/* eslint-disable */
import React from 'react';
import { TabSwitchPanel } from "../vendored/scenes/tab-switch-panel";
// GENERATED from the RemotionUI docs usage example for "tab-switch-panel" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <TabSwitchPanel
        windowTitle="Northstar Studio"
        tabs={[
          { label: "Overview", title: "1,284 renders", rows: [{ label: "Queued", value: "12" }] },
          { label: "Billing", title: "Studio plan", rows: [{ label: "Seats", value: "9 of 12" }] },
        ]}
        switchEverySeconds={0.9}
        holdSeconds={4}
       {...__o}/>
    </div>
  );
}
