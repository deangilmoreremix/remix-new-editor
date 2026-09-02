# Phase 4B — Dropped Stash Recovery, Object Forensics, and Permanent Preservation

**Date:** 2026-08-29  
**Repository:** `remix-new-editor`  
**Branch:** `develop`  
**Status:** COMPLETE — no production code modified, all critical objects preserved via local recovery branches.

---

## 1. Executive Summary

**Unreachable commits inspected:** 147  
**Likely stash commits found:** 4 high-confidence, 1 valuable  
**Historical audited stashes identified:** 3 critical + 1 valuable  
**Critical recovery refs created:** 3  
**Valuable recovery refs created:** 1  
**Objects still unidentified:** remaining unreachable commits are noise/worktree artifacts with no unique application code value.

**Conclusion:** The important historical work from the dropped stashes is recoverable and has been permanently preserved via local Git branches. The three critical objects (OpenMontage/Backlot rewrite, extended studio/service suite, and large model-registry snapshot) are all present and protected. One additional valuable object (Director security hardening) was also preserved. No garbage collection was performed. `develop` remains unchanged.

---

## 2. Current Protected Develop State

| Item | Value |
|------|-------|
| Current branch | `develop` |
| `develop` HEAD SHA | `40bc3637b81de5c6a455b41c23fe1b9dbf0ae4be` |
| Recovery commit 1 | `95022df5b` — `chore: apply working tree changes from prior stash operations` |
| Recovery commit 2 | `40bc3637b` — `fix(landing): restore prerender.mjs SmartVideo branding and smartvid.app URLs` |
| Remote `origin` fetch URL | `https://github.com/calesthio/OpenMontage.git` (incorrect for this project) |
| Remote `deangilmoreremix` URL | `https://github.com/deangilmoreremix/remix-new-editor.git` (correct) |
| `develop` upstream | `origin/develop` |
| Working tree status | Clean |
| Stash list | Empty |
| Recovery branches created | `recovery/dropped-openmontage-96c9b419`, `recovery/dropped-feature-suite-ae224d96`, `recovery/dropped-model-registry-66320271`, `recovery/dropped-director-security-130a9e34` |

**Verification:**
- `git merge-base --is-ancestor 95022df5b develop` → true
- `git merge-base --is-ancestor 40bc3637b develop` → true
- `git status --short --branch` → clean working tree, `develop...origin/develop [ahead 2]`

---

## 3. Garbage Collection Safety

**No Git cleanup/garbage collection was performed during this phase.**

Specifically, the following commands were **NOT** run:
- `git gc`
- `git gc --aggressive`
- `git prune`
- `git prune-packed`
- `git repack -Ad`
- `git maintenance run`
- `git maintenance start`
- `git reflog expire`

No automated repository cleanup was triggered. No IDE/tool was allowed to perform Git optimization.

**Evidence:** All 147 unreachable commits from `git fsck --full --unreachable` remain intact and have been made reachable via recovery branches where valuable.

---

## 4. Recovered Historical Stash Map

| Old Audit Identity | Recovered SHA | Recovery Branch | Confidence | Status |
|-------------------|---------------|-----------------|------------|--------|
| old stash0 — OpenMontage large rewrite | `96c9b419ca8b98091e4fa28d4e9f3127cabc8495` | `recovery/dropped-openmontage-96c9b419` | HIGH | PRESERVED |
| old stash5 — extended studio/service suite | `ae224d960f15b8cee630dc3eff524e47a3661715` | `recovery/dropped-feature-suite-ae224d96` | HIGH | PRESERVED |
| old stash9 — model registry snapshot | `66320271ed0110b3621cf938fea8ac8b8517a79b` | `recovery/dropped-model-registry-66320271` | HIGH | PRESERVED |
| Director security hardening | `130a9e344aae4caff2d073c1cb7aa0f218455f96` | `recovery/dropped-director-security-130a9e34` | HIGH | PRESERVED |
| old stash6 — landing-fix/prerender | `171f6c1dd85e36c4df2b03acb8438d445f49b9e0` | Already applied as `40bc3637b` | — | SUPERSEDED |
| old stash8 — restore personalization | `7db9de44dff72653b562bc20cd4cbea042066b16` | Not preserved (files already in `develop`) | — | SUPERSEDED |
| old stash1 — attachment toolbar fragment | `c9062d0e6d3846d6cdb7ab5f65cd4ded2cd6786d` | Unreachable, small fragment | LOW | NOISE |
| old stash2 — mixed studio/landing sweep | `d4386dac2872d5a1a23b4a90b31fade237c918c5` | Unreachable, superseded by current | LOW | SUPERSEDED |
| old stash3 — modal constants | `6cdf00c8be25f9bf8d65b52eae79e8f3bd15be75` | Unreachable, 1 file | LOW | NOISE |
| old stash4 — empty | `338ae9e79ad31b62cf6868ba18f7a0022b41ea66` | Unreachable, empty/minor | LOW | EMPTY |

**Note:** The old stash numbers (0–9) no longer exist in the repository. The mapping above is based on original stash message content, file changes, and base commit ancestry, not on current stash index position.

---

## 5. Critical Recovery References

All recovery branches are local-only and have **not** been pushed.

| Branch Name | Target SHA | Description |
|-------------|------------|-------------|
| `recovery/dropped-openmontage-96c9b419` | `96c9b419ca8b98091e4fa28d4e9f3127cabc8495` | OpenMontage/Backlot large rewrite |
| `recovery/dropped-feature-suite-ae224d96` | `ae224d960f15b8cee630dc3eff524e47a3661715` | Extended studio/service suite |
| `recovery/dropped-model-registry-66320271` | `66320271ed0110b3621cf938fea8ac8b8517a79b` | Large model-registry snapshot |
| `recovery/dropped-director-security-130a9e34` | `130a9e344aae4caff2d073c1cb7aa0f218455f96` | Director security hardening |

**Verification:**
```bash
$ git branch --contains 96c9b419ca8b98091e4fa28d4e9f3127cabc8495
  recovery/dropped-openmontage-96c9b419

$ git branch --contains ae224d960f15b8cee630dc3eff524e47a3661715
  recovery/dropped-feature-suite-ae224d96

$ git branch --contains 66320271ed0110b3621cf938fea8ac8b8517a79b
  recovery/dropped-model-registry-66320271

$ git branch --contains 130a9e344aae4caff2d073c1cb7aa0f218455f96
  recovery/dropped-director-security-130a9e34
```

---

## 6. OpenMontage Findings

**Recovered SHA:** `96c9b419ca8b98091e4fa28d4e9f3127cabc8495`  
**Base SHA:** `c187131adc203cc2185eca72d16c212a446c433d`  
**Date:** 2026-08-28 15:05:38 -0400  
**Author:** Kilo  
**Message:** `On develop: WIP: pre-existing changes before main merge`  
**Parent structure:** 2 parents (base + index state)  
**Parents:**
- `c187131adc203cc2185eca72d16c212a446c433d` (base — `feat(attachments): add unified attachment toolbar to chat and all creation studios`)
- `672326b59824794ba05f60817a3b64d51d6ef12a` (index state)

**Changed files:**
- `data/storyboards-state.json` — minor data change
- `src/components/OpenMontagePage.js` — **+899 insertions, -203 deletions**

**Unique capabilities identified:**
- `clip-factory` pipeline ID added to `PIPELINES` array
- `escapeHtml()` utility function
- `getStatusStyle()` status formatter
- `formatCredits()` credit formatter
- Extended stage tracker with numbered circles and status indicators
- Storyboard content renderer (`renderStoryboardContent`)
- Enhanced filmstrip with duration/labels
- Accessibility improvements (`aria-label`, `role="slider"`, keyboard navigation)

**Relationship to current develop:**  
Current `develop` has an `OpenMontagePage.js` that differs from this recovered version. This recovered commit represents a **large rewrite** with Backlot-inspired design and pipeline extensions that are not fully present in current `develop`.

**Relationship to other OpenMontage candidates:**  
A second candidate (`d4386dac...`) also modified `OpenMontagePage.js` but was a mixed studio/landing sweep and is superseded by current committed code. The `96c9b419...` commit is the **primary OpenMontage rewrite** and is the correct recovery target.

---

## 7. Extended Studio Suite Findings

**Recovered SHA:** `ae224d960f15b8cee630dc3eff524e47a3661715`  
**Base SHA:** `71912b8f1c1c81474311f08b844fdb7b8822197c`  
**Date:** 2026-08-27 07:23:16 -0400  
**Author:** Kilo  
**Message:** `WIP on implement-clerk-billing-access-control: 71912b8f1 feat: add Smart Video Lead Finder studio with full personalization`  
**Parent structure:** 2 parents (base + index state)  
**Parents:**
- `71912b8f1c1c81474311f08b844fdb7b8822197c` (base — `feat: add Smart Video Lead Finder studio with full personalization`)
- `aa9ae29c7b34a2516b9afb4e775598cc1d3bad39` (index state)

**Feature inventory:**

| Feature | Found? | File | Backend Found? |
|---------|--------|------|----------------|
| PexelsMediaPage | YES | `src/components/PexelsMediaPage.js` | N/A |
| PhotoStudioPage | YES | `src/components/PhotoStudioPage.js` | YES — `backend/services/photoStudioService.js` |
| CampaignWizard | YES | `src/components/CampaignWizard.js` | YES — `backend/services/campaignService.js` |
| BrandStudio | YES | `src/components/BrandStudio.js` | YES — `backend/services/brandService.js` |
| AnimatePage | PARTIAL | `backend/services/animateService.js` modified | YES |
| AssetCanvasEditor | YES | `src/components/AssetCanvasEditor.js` | N/A |
| BrandDnaEditor | YES | `src/components/BrandDnaEditor.js` | N/A |
| LibraryPage | YES | `src/components/LibraryPage.js` | N/A |
| ContentLibraryPage | YES | `src/components/ContentLibraryPage.js` | N/A |
| ExampleGallery changes | YES | `src/components/studios/ExampleGallery.js` | N/A |
| brand service | YES | `backend/services/brandService.js` | — |
| campaign service | YES | `backend/services/campaignService.js` | — |
| scraper service | YES | `backend/services/scraperService.js` | — |
| photoStudio service | YES | `backend/services/photoStudioService.js` | — |

**Additional files in suite:**
- `src/lib/photoStudio.js`
- `src/lib/models.js` (9522 lines)
- `lib/models.js` (170 lines)
- `src/lib/brandApi.js`
- `src/lib/muapi.js`
- `src/lib/openaiService.js`
- `src/lib/router.js` (modified)
- `src/lib/studioRoutes.js` (modified)
- `src/components/CinemaTemplateStudio.js` (modified)
- `src/components/DirectorPage.js` (modified)
- `src/components/TimelineEditorPage.jsx` (modified)

**Relationship to current develop:**  
The suite represents the **extended studio/service expansion** that was stashed during the `implement-clerk-billing-access-control` branch work. Many of these components and services are not fully present in current `develop`. This is the **primary historical feature suite** and is distinct from the current studio set.

**Third parent / untracked files:**  
No third parent (untracked files) exists for this commit. The index parent `aa9ae29c7...` contains only staged index state, no unique untracked file content.

---

## 8. Model Registry Findings

**Recovered SHA:** `66320271ed0110b3621cf938fea8ac8b8517a79b`  
**Base SHA:** `3247129cab68cdc969874e9581c4a3069df267f1`  
**Date:** 2026-08-25 18:07:47 -0400  
**Author:** Kilo  
**Message:** `On develop: temp-stash-before-push`  
**Parent structure:** 2 parents (base + index state)  
**Parents:**
- `3247129cab68cdc969874e9581c4a3069df267f1` (base — `feat: integrate SmartVideo branding, Cloudflare BYOC, and OpenThorn sync`)
- `168a7e9417fac6af9607ecd6a0b6675932a728cf` (index state)

**File:** `src/lib/models.js`  
**Diff stat:** +20,056 insertions, -4,127 deletions (24,183 lines changed)  
**Current `src/lib/models.js` line count:** 9,534 lines  
**Recovered `src/lib/models.js` line count:** 23,884 lines

**Provider/model scope identified:**
- 404 provider entries
- 24 unique providers: `alibaba`, `blackforest`, `bytedance`, `google`, `grok`, `happy-horse`, `hidream`, `hunyuan`, `ideogram`, `kling`, `leonardoai`, `lightricks`, `luma`, `midjourney`, `minimax`, `mmaudio`, `muapi`, `openai`, `pixverse`, `reve`, `runway`, `stability`, `topaz`, `vidu`
- Model IDs include: `nano-banana`, `flux-dev`, `flux-dev-lora`, `flux-kontext-dev-t2i`, `hidream-i1-fast`, `hidream-i1-dev`, Civitai LoRA references, and many others
- Contains `provider`, `provider_name`, model capability schemas, and parameter definitions

**Associated changed files in same commit:**
- `backend/server.js`
- `netlify.toml`
- `package-lock.json`
- `package.json`
- `render.yaml`
- `scripts/clerk-optimize-entry.js`
- `src/components/AudioStudio.js`
- `src/components/AvatarStudio.js`
- `src/components/CharacterStudio.js`
- `src/components/EditStudio.js`
- `src/components/ImageStudio.js`
- `src/components/InfluencerStudio.js`
- `src/components/LandingPage.js`
- `src/components/LipSyncStudio.js`
- `src/components/VideoStudio.js`
- `src/components/VideoToolsStudio.js`
- `src/lib/models.js`
- `tsconfig.json`
- `vite.config.js`
- `vitest.config.js`

**Relationship to current develop:**  
The recovered `models.js` is **2.5x larger** than current `develop`'s version, indicating this is the **expanded model-registry snapshot** that was dropped. The current registry appears to be a reduced subset. This object is safely preserved and available for selective forward-porting.

**Third parent / untracked files:**  
No third parent exists. The index parent `168a7e941...` contains only staged index state.

---

## 9. Other Recovered Objects

### Director Security Hardening (VALUABLE)

**Recovered SHA:** `130a9e344aae4caff2d073c1cb7aa0f218455f96`  
**Base SHA:** `969db7886ac3d1a79e2080cee39fcfdfe7f2768d`  
**Date:** 2026-07-31 11:13:35 -0400  
**Author:** git stash  
**Message:** `WIP on backend-real-outputs: 969db788 fix(director): security, memory, tests — SSRF, eviction, rate-limit, XSS, cancel race`  
**Parent structure:** 2 parents  
**Parents:**
- `969db7886ac3d1a79e2080cee39fcfdfe7f2768d` (base — already in `develop`)
- `f23c4c96b96affd961769374bd7afb6059b36f05` (index state)

**Files changed (incremental over base):**
- `backend/server.js` — +13 lines
- `backend/services/agentActionsService.js` — +95/-42 lines
- `backend/services/videoDbProxyService.js` — +17 lines
- `src/components/DirectorPage.js` — +57/-42 lines
- Plus modifications to 22 studio components and `src/lib/muapi.js`, `src/lib/analytics.js`, `vite.config.js`

**Significance:**  
This commit contains **incremental security hardening** on top of the already-committed `969db7886`. The base commit is in `develop`, but the uncommitted incremental changes (SSRF protections, eviction improvements, rate-limiting, XSS fixes, cancel-race fixes) are **not** in current `develop`. This is valuable security work that should be forward-ported.

**Recovery branch:** `recovery/dropped-director-security-130a9e34`

### Restore-Personalization Stash (SUPERSEDED)

**SHA:** `7db9de44dff72653b562bc20cd4cbea042066b16`  
**Status:** Not preserved as separate branch. The rebranding files (`usePageTitle.ts`, `DirectorPage.js`, `ProjectBuilderPage.tsx`, `vite.config.ts`) are already present in current `develop` via other commits. The third parent (`0980959db...`) contained untracked generated artifacts (`.netlify/functions/*.zip`, `.playwright-mcp/` logs/screenshots, `public/smartvideo-*` built assets) which are **noise** and do not need preservation.

### Landing Repo Video Gallery (SUPERSEDED)

**SHA:** `b01c23a5242a21ee93fe67bc07c6841f7e2884b0`  
**Status:** Superseded. Landing sections (`CinematicVideoHero.jsx`, `RepoShowcase.jsx`, `ShowcaseRepoVideo.jsx`, etc.) are already present in current `develop`. The commit also contained a large merge of `.agents/skills/` files which are environment-specific and not application code.

---

## 10. Superseded / Unimportant Objects

| SHA | Reason |
|-----|--------|
| `171f6c1dd85e36c4df2b03acb8438d445f49b9e0` | Already applied as `40bc3637b` |
| `7db9de44dff72653b562bc20cd4cbea042066b16` | Files already in `develop`; untracked parent is noise |
| `b01c23a5242a21ee93fe67bc07c6841f7e2884b0` | Landing sections already in `develop` |
| `d4386dac2872d5a1a23b4a90b31fade237c918c5` | Mixed sweep, superseded by current |
| `c9062d0e6d3846d6cdb7ab5f65cd4ded2cd6786d` | Small attachment toolbar fragment |
| `6cdf00c8be25f9bf8d65b52eae79e8f3bd15be75` | Single modal constants file |
| `338ae9e79ad31b62cf6868ba18f7a0022b41ea66` | Empty/minor |
| Remaining unreachable commits | Worktree artifacts, `.kilo/` plans, `.agents/skills/`, build artifacts, CI configs — NOISE |

---

## 11. Unresolved Objects

| Status | Count | Description |
|--------|-------|-------------|
| NOISE | ~140 | Worktree artifacts, `.kilo/` plans, `.agents/skills/`, build outputs, CI configs, temporary files |
| POSSIBLY_GARBAGE_COLLECTED | 0 | All high-value objects have been positively identified and preserved |
| SEARCH_INCOMPLETE | 0 | Full `git fsck --full --unreachable` scan completed; all 147 unreachable commits were inspected via automated and manual methods |
| OBJECT_IDENTITY_UNCERTAIN | 0 | All critical objects have been positively identified by SHA, parent structure, file content, and unique string signatures |

**Note:** The `git fsck --full --unreachable` output contained many `commit-graph` parse errors. These are **not** unreachable commits — they are corrupted/missing entries in the commit-graph file. The actual unreachable commits were extracted via `grep "^unreachable commit "` and individually inspected. No GC was run, so all objects remain in the object database.

---

## 12. Final Git State

| Item | Value |
|------|-------|
| `develop` SHA before recovery phase | `40bc3637b81de5c6a455b41c23fe1b9dbf0ae4be` |
| `develop` SHA after recovery phase | `40bc3637b81de5c6a455b41c23fe1b9dbf0ae4be` (unchanged) |
| Working tree | Clean |
| Recovery branches created | 4 (all local, not pushed) |
| Tags created | 0 |
| Stash list | Empty |
| Commits on `develop` ahead of `origin/develop` | 2 (`95022df5b`, `40bc3637b`) |

**Develop protection verified:**
```bash
$ git status --short --branch
## develop...origin/develop [ahead 2]

$ git log --first-parent --oneline -5 develop
40bc3637b fix(landing): restore prerender.mjs SmartVideo branding and smartvid.app URLs
95022df5b chore: apply working tree changes from prior stash operations
98ede443a fix(ai-vfx): restore dev proxy, CSP, loading state, health check, and dev config
218b9db97 test(e2e): add attachment toolbar visibility tests for all studios
28fbb15e0 fix(attachments): correct container variables and default toolbar visibility
```

---

## 13. Recovery Branch Reference Details

### recovery/dropped-openmontage-96c9b419
- **SHA:** `96c9b419ca8b98091e4fa28d4e9f3127cabc8495`
- **Base:** `c187131adc203cc2185eca72d16c212a446c433d`
- **Parents:** `c187131ad` (base), `672326b59` (index)
- **Key files:** `src/components/OpenMontagePage.js` (+899/-203)
- **Unique strings:** `clip-factory`, `escapeHtml`, `getStatusStyle`, `formatCredits`

### recovery/dropped-feature-suite-ae224d96
- **SHA:** `ae224d960f15b8cee630dc3eff524e47a3661715`
- **Base:** `71912b8f1c1c81474311f08b844fdb7b8822197c`
- **Parents:** `71912b8f1` (base), `aa9ae29c7` (index)
- **Key files:** BrandStudio, CampaignWizard, PhotoStudioPage, AssetCanvasEditor, BrandDnaEditor, PexelsMediaPage, LibraryPage, ContentLibraryPage, ExampleGallery + 5 backend services

### recovery/dropped-model-registry-66320271
- **SHA:** `66320271ed0110b3621cf938fea8ac8b8517a79b`
- **Base:** `3247129cab68cdc969874e9581c4a3069df267f1`
- **Parents:** `3247129ca` (base), `168a7e941` (index)
- **Key files:** `src/lib/models.js` (+20,056/-4,127, 23,884 lines, 404 entries, 24 providers)

### recovery/dropped-director-security-130a9e34
- **SHA:** `130a9e344aae4caff2d073c1cb7aa0f218455f96`
- **Base:** `969db7886ac3d1a79e2080cee39fcfdfe7f2768d`
- **Parents:** `969db7886` (base), `f23c4c96b` (index)
- **Key files:** backend/server.js, agentActionsService.js, videoDbProxyService.js, DirectorPage.js (+140/-42)

---

## 14. Next Steps (For Future Integration Phase)

1. **Do not merge recovery branches directly into `develop`.** They point to historical stash commits with unusual parentage.
2. **Selective forward-porting:** Use `git show recovery/dropped-openmontage-96c9b419:src/components/OpenMontagePage.js` to extract specific capabilities (clip-factory pipeline, accessibility improvements) and port them forward.
3. **Model registry merge:** Compare `recovery/dropped-model-registry-66320271:src/lib/models.js` against current `src/lib/models.js` and selectively merge new providers/models.
4. **Studio suite extraction:** Port BrandStudio, CampaignWizard, PhotoStudioPage, and backend services from `recovery/dropped-feature-suite-ae224d96` after testing.
5. **Director security port:** Forward-port the incremental security fixes from `recovery/dropped-director-security-130a9e34` into current backend/server.js and DirectorPage.js.
6. **Delete recovery branches only after integration is complete and tested.**

---

*Report generated by automated forensic recovery scan and manual verification.*  
*No production code was modified during this phase.*
