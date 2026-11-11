/* eslint-disable */
import React from 'react';
import { QuizQuestion } from "../vendored/scenes/quiz-question";
// GENERATED from the RemotionUI docs usage example for "quiz-question" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const source = "export function render(scene) {\n  const frame = useCurrentFrame();\n  const t = interpolate(frame, [0, 30], [0, 1]);\n  return scene(t);\n}";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <QuizQuestion
        question="What does the RemotionUI CLI actually do?"
        options={[
          "It bundles a runtime you ship",
          "It copies the source into your repo",
          "It renders on our servers",
        ]}
        correctIndex={1}
        pickedIndex={2}
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
