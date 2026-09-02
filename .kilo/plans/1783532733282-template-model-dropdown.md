# Template Model Dropdown Plan

## Problem
`TemplateStudio.js` hardcodes `template.model` for every generation. Users cannot override which muapi model to use, unlike `VideoStudio.js` which has a full model picker.

## Scope
- **In scope:** Add a model dropdown to `TemplateStudio.js` that lets users override the per-template default model.
- **Out of scope:** Changing template engine routing, adding t2v-to-i2v conversion, or modifying `templates.js` data.

## Decision
Filter the dropdown by the template's existing `modelType` so routing stays consistent:
- `modelType: 'i2v'` → populate from `i2vModels`
- `modelType: 'i2i'` → populate from `i2iModels`
- `modelType: 't2i'` → populate from `t2iModels`

This mirrors `VideoStudio`'s behavior (separate model pools per generation mode) and avoids breaking the `generateI2V`/`generateI2I`/`generateImage` dispatch in `muapi.js`.

## Implementation Steps

### 1. Add imports to `TemplateStudio.js`
```js
import {
  t2iModels,
  i2iModels,
  i2vModels,
  getModelById,
  getI2IModelById,
  getI2VModelById
} from '../lib/models.js';
```

### 2. Add a `selectedModel` state variable
Near the existing state declarations (around line 40):
```js
let selectedModel = template.model;
```

### 3. Build and insert the model dropdown
After the template inputs are rendered (after the `allInputs.forEach` loop, before the AI Enhancer section), add a model selector:

```js
if (template.outputType === 'video' || template.modelType === 'i2i' || template.modelType === 't2i') {
  const modelWrapper = document.createElement('div');
  modelWrapper.className = 'mt-6';
  
  let modelList = [];
  if (template.modelType === 'i2v') modelList = i2vModels;
  else if (template.modelType === 'i2i') modelList = i2iModels;
  else if (template.modelType === 't2i') modelList = t2iModels;
  
  modelWrapper.innerHTML = `
    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Model</div>
    </div>
    <select id="templateModelSelect" class="h-11 w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 text-sm text-white outline-none transition focus:border-emerald-400/50 appearance-none cursor-pointer">
      ${modelList.map(m => `<option value="${m.id}" class="bg-zinc-950 text-white" ${m.id === template.model ? 'selected' : ''}>${m.name} (${m.id})</option>`).join('')}
    </select>
  `;
  
  const select = modelWrapper.querySelector('#templateModelSelect');
  select.value = template.model;
  select.onchange = () => { selectedModel = select.value; };
  
  leftPanel.insertBefore(modelWrapper, enhancerSection);
}
```

### 4. Update the generation code
In the `genBtn.onclick` handler, replace:
```js
const params = { model: template.model, ...(template.defaultParams || {}) };
```
with:
```js
const params = { model: selectedModel || template.model, ...(template.defaultParams || {}) };
```

### 5. Ensure `selectedModel` initializes correctly
On template load, `selectedModel` is set to `template.model`. The dropdown defaults to that value.

## Edge Cases
- Template model not found in the filtered list: fallback to `template.model` and still show it in the dropdown (the dropdown is built from the full model list, so this shouldn't happen for valid templates).
- User clears selection: `selectedModel` stays as `template.model` because we use `||` fallback.

## Validation
- Open any video template → model dropdown appears with i2v models pre-selected.
- Open any image template → model dropdown appears with i2i or t2i models.
- Switch model → generation uses the new model ID.
- Generate → result comes back successfully (model ID is valid in the filtered list).
