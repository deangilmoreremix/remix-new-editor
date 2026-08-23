// Minimal studio prefill bridge.
// Stages prefill data before navigation and lets destination studios consume it.

let stagedPrefill = null;

export function stageStudioPrefill(data = {}) {
  stagedPrefill = { ...data };
}

export function consumeStudioPrefill(route) {
  if (!stagedPrefill) return null;
  if (route && stagedPrefill.route && stagedPrefill.route !== route) return null;
  const prefill = { ...stagedPrefill };
  stagedPrefill = null;
  return prefill;
}
