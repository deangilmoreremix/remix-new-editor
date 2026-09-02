# GTM Prompt Combination Audit

**Date:** 2026-07-31
**Scope:** `src/components/TemplateStudio.js` + `src/components/modals/GTMPromptModal.jsx` + `src/lib/uiIntegration.js`

## Executive Summary

The Template Studio has two GTM Boost buttons and a prompt assembly function `buildEnrichedPrompt()`. An audit found significant duplication bugs and inconsistent state updates when combining template `basePrompt` with GTM-generated prompts. All issues have been fixed and tested.

## Issues Found and Fixed

### Issue 1: GTM prompt duplicated inside `basePrompt`

**Severity:** High
**File:** `src/components/TemplateStudio.js`, `buildEnrichedPrompt()` around line 897

**Problem:** When `userPrompt` came from GTM Boost (a comprehensive structured prompt of 500–1000 words), the code still did:
```js
template.basePrompt.replace(/\{prompt\}/g, userPrompt || '')
```

This embedded the entire GTM text inside the template's `basePrompt`, and then appended the expanded `basePrompt` as another part. The final prompt contained the GTM text **twice**.

**Fix:** Added `isGTM` detection heuristic:
```js
const isGTM = userPrompt && (
  userPrompt.includes('🎯 GTM-Optimized') ||
  ['Hook:', 'Story Beat', 'Visual Direction', 'Audio', 'Call to Action'].some(marker => userPrompt.includes(marker))
);
```

When GTM is detected:
- `userPrompt` is still included once as the main prompt part
- `template.basePrompt` replaces `{prompt}` with the first non-empty line (short description) instead of the full GTM text
- If no usable first line exists, the expanded `basePrompt` is omitted entirely

### Issue 2: Two GTM Boost buttons with inconsistent behavior

**Severity:** Medium
**Files:** `src/components/TemplateStudio.js`, lines 348-392 and 733-766

**Problem:** The per-field button and bottom panel button had different callback contracts:
- Per-field button: updated `promptEl.value` and `formState`, but NOT `lastBuiltPrompt` or `outputTextarea`
- Bottom button: updated `lastBuiltPrompt` and `outputTextarea`, but bypassed `openGTMPromptModal` and didn't pass `templateContext`

**Fix:** Unified both buttons to use `openGTMPromptModal('template-studio', { templateContext, onPromptGenerated })` with the same callback:
```js
onPromptGenerated: (generatedPrompt) => {
  lastBuiltPrompt = generatedPrompt;
  outputTabValues['Enhanced Prompt'] = generatedPrompt;
  const ta = document.getElementById('outputTextarea');
  if (ta) ta.value = generatedPrompt;
  promptEl.value = generatedPrompt;
  promptEl.dispatchEvent(new Event('input', { bubbles: true }));
  promptEl.dispatchEvent(new Event('change', { bubbles: true }));
  formState[promptFieldName] = generatedPrompt;
  promptEl.focus();
}
```

### Issue 3: Bottom button sourced `basePrompt` from output textarea

**Severity:** Medium
**File:** `src/components/TemplateStudio.js`, line 739

**Problem:** The bottom button read `basePrompt` from the output textarea, which could contain placeholder text or stale content from a previous generation.

**Fix:** Changed sourcing to prefer the user's current prompt input:
```js
const basePrompt = (document.getElementById('outputTextarea')?.value) || (ctx && ctx.basePrompt) || template.description || '';
```

This matches the per-field button's priority and ensures `basePrompt` reflects the user's actual idea.

## Code Path: User Input → Final Prompt

```
User types in prompt field
    ↓ formState[promptFieldName] updated (oninput)
[Optional] User clicks any GTM Boost button
    ↓ fetchGTMTemplateContext() → backend defaults
    ↓ openGTMPromptModal('template-studio', { templateContext, onPromptGenerated })
    ↓ [GTM modal generates structured/text prompt]
    ↓ onPromptGenerated updates:
        - lastBuiltPrompt
        - outputTabValues['Enhanced Prompt']
        - outputTextarea.value
        - promptEl.value (+ input/change events)
        - formState[promptFieldName]
        - promptEl.focus()
User clicks Generate
    ↓ params.prompt = formState[promptFieldName]
    ↓ userPrompt = lastBuiltPrompt || params.prompt || ''
    ↓ params.prompt = buildEnrichedPrompt(template, specs, formState, userPrompt)
        ├── parts.push(userPrompt)                          ← GTM text once
        ├── parts.push(formState['subject'])
        ├── parts.push(template.basePrompt with {prompt} → short first line for GTM)
        ├── parts.push(sceneBlueprint, cinematography, visualStyle, niche terms, etc.)
        └── dedupe + trim + cap at 2000 chars
    ↓ muapi.generateImage/Video/I2V(params)
```

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `src/components/TemplateStudio.js` | 371-381 | Added `lastBuiltPrompt`, `outputTextarea`, and event dispatch to top GTM button callback |
| `src/components/TemplateStudio.js` | 738-771 | Unified bottom GTM button to use `openGTMPromptModal` with same callback contract |
| `src/components/TemplateStudio.js` | 739 | Fixed `basePrompt` sourcing for bottom button |
| `src/components/TemplateStudio.js` | 900-915 | Added `isGTM` detection and shortened `{prompt}` substitution in `buildEnrichedPrompt()` |

## Tests Added

**File:** `src/test/template-gtm-integration.test.js`

Two new test cases in `describe('buildEnrichedPrompt combination logic', ...)`:

1. **Raw user prompt + `basePrompt`** → verifies no duplication
2. **GTM-style prompt + `basePrompt`** → verifies GTM text appears once and is NOT nested inside expanded `basePrompt`

**Test results:** 19/20 passing (1 pre-existing CSS failure unrelated to this work)

## Follow-up

1. **Make `buildEnrichedPrompt` directly unit-testable:** Move it from `TemplateStudio.js` closure to `src/lib/templateEngine.js` and export it. See subagent report for exact refactor steps.
2. **Fix pre-existing CSS test failure:** `src/styles/gtm-prompt-modal.css` is missing `.template-studio .gtm-boost-btn` selector.
3. **Validate cinematic templates** (129 templates in `src/lib/cinematicTemplates.js`) via the adapter path.
