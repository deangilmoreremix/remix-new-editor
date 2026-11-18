/* eslint-disable */
import React from 'react';
import { KanbanMove } from "../vendored/scenes/kanban-move";
// GENERATED from the RemotionUI docs usage example for "kanban-move" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <KanbanMove
        columns={["Backlog", "In progress", "Shipped"]}
        cards={[
          { title: "Caption presets", meta: "RUI-218 · Ana", column: 0 },
          {
            title: "Render queue retries",
            meta: "RUI-204 · Piotr",
            column: 0,
            moveTo: 1,
            moveAtSeconds: 0.95,
          },
          { title: "Theme tokens", meta: "RUI-177 · Kit", column: 1 },
        ]}
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
