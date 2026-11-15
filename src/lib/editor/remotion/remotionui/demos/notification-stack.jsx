/* eslint-disable */
import React from 'react';
import { NotificationStack } from "../vendored/scenes/notification-stack";
// GENERATED from the RemotionUI docs usage example for "notification-stack" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <NotificationStack
        align="top-right"
        toasts={[
          { title: "Render finished", body: "launch-teaser.mp4", tone: "success", meta: "now" },
          { title: "Storage at 86%", tone: "warn", meta: "2m" },
        ]}
        lifeSeconds={2.3}
       {...__o}/>
    </div>
  );
}
