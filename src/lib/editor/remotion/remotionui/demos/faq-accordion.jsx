/* eslint-disable */
import React from 'react';
import { FaqAccordion } from "../vendored/scenes/faq-accordion";
// GENERATED from the RemotionUI docs usage example for "faq-accordion" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const items = ["Design", "Build", "Ship"];
  const source = "export function render(scene) {\n  const frame = useCurrentFrame();\n  const t = interpolate(frame, [0, 30], [0, 1]);\n  return scene(t);\n}";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <FaqAccordion
        title="Questions people ask"
        items={[
          { question: "Do I own the components?", answer: "Yes. The CLI copies the source into your repo." },
          { question: "Can I render on my own machine?", answer: "Renders run wherever Remotion runs." },
        ]}
        openOrder={[0, 1]}
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
