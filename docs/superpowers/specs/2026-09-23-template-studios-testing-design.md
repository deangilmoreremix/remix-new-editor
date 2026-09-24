# Template Studios Production Readiness Testing

## Objective
Verify all features in `TemplateStudio` and `CinemaTemplateStudio` are working and production-ready through automated tests and a manual testing checklist.

## Scope
- `src/components/TemplateStudio.js`
- `src/components/CinemaTemplateStudio.js`
- `src/components/CinemaStudio.js` (shared cinema infrastructure)
- `src/lib/cinematicTemplates.js`
- `src/lib/templateEngine.js`
- Supporting modals and integration modules

## Approach
1. Expand unit test coverage for template studio features
2. Extend smoke tests with feature assertions
3. Triage pre-existing test failures that affect template studios
4. Create manual testing checklist

## Test Files
- `tests/unit/template-studio-generation.unit.spec.ts` — generation flows, form state, uploads, model picker, enhance tools, thumbnail modal, retry
- `tests/unit/cinema-template-studio.unit.spec.ts` — scene-builder, shot defaults, render handoff
- `tests/unit/template-studio-smoke.unit.spec.ts` — mount smoke with feature assertions
- `docs/testing/template-studios-manual-checklist.md` — manual test plan

## Pre-existing Issues To Fix
- `cinema-template-scene-builder.unit.spec.ts`: 3 toast string assertion failures (simple string mismatch)
- `studio-smoke.test.js`: `summaryTitle` TDZ in CinemaStudio (pre-existing crash)

## Verification
- `npx vitest run tests/unit/template-*`
- `npx vitest run tests/unit/cinema-template-*`
- Targeted test runs on changed files
