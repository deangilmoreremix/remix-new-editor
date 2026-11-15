/* eslint-disable */
import React from 'react';
import { FormFillSequence } from "../vendored/scenes/form-fill-sequence";
// GENERATED from the RemotionUI docs usage example for "form-fill-sequence" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <FormFillSequence
        title="Create your workspace"
        fields={[
          { label: "Full name", value: "Ada Lovelace", placeholder: "Your name" },
          { label: "Work email", value: "ada@northstar.dev" },
        ]}
        submitLabel="Create workspace"
        successLabel="Workspace created"
        holdSeconds={4}
       {...__o}/>
    </div>
  );
}
