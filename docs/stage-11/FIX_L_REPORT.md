# Fix L: semantic scene search ranking robustness

## Defect
CLIP ViT-B/32 scene search ranked a beach photo that contains a book titled "New York City" above the real city scene for "a city street with buildings" (22% vs 21%). CLIP reads text in images, so a text-heavy frame scores high for many queries.

## What changed (`src/cinegen/lib/local-ai/scene-index.ts`; no new models, no network, no paid API)
1. **Prompt ensemble**: the query is embedded with 4 templates ("a photo of X", "a video frame of X", "X", "a still from a video showing X"); the unit-normalised mean is the query vector. `clipPrompt` still returns "a photo of X"; `embedQuery` keeps its signature.
2. **Neutral-baseline subtraction**: mean embedding of 5 generic prompts ("a photo", "a photo of something", "an image", "a video frame", "a picture"), embedded once per index in the same worker round trip as the first query. Score = `cos(scene,query) - 0.75 * (cos(scene,baseline) - 0.2)`. The 0.2 constant keeps scores on the familiar scale so the panel's "match %" still reads naturally. Frames that match every caption (text-heavy, busy) are penalised.
3. **minScore**: 0.18 for raw cosine (unchanged when no baseline), 0.22 with the baseline. In the 8-scene real data, queries for things not in the video topped out at about 0.225 and real matches started at about 0.234.
4. **Caption/tag lexical bonus** (`captionBonus`): +0.02 per query content word found as a whole word in the scene caption or tags (cap 0.04). Only affects scenes with a SmolVLM caption or tags. Unit-tested only (see "Unverified").
5. Existing public API kept (`SceneSearchIndex.index/search/embedQuery/ready/vectors/size`, `rankByEmbedding(scenes, vectors, queryVec, minScore?)`, `mergeSearch`, `clipPrompt`). `rankByEmbedding` gained an optional 5th `opts` argument. One existing assertion in `pipeline.test.ts` was relaxed: the embed-text request now carries several prompts, so it checks `texts[0] === 'a photo of a person'` instead of the whole array.
6. `scenes-panel.tsx` needed no change (it calls `index.search`).

Considered and not done: per-query z-score / softmax (monotone per query, so it cannot change the order; the baseline subtraction is what changes it); multiple frames per scene (needs a second thumbnail per scene and a SceneInfo/thumb-cache schema change, not cheap).

## How the tuning was chosen
Raw CLIP vectors of 8 scenes and 118 prompts were dumped from the real worker, then variants were scored offline (top-1 correct over 8 queries with known answers, and the margin between the best correct and best wrong scene divided by the score std):

| variant | top-1 | mean margin | worst margin |
|---|---|---|---|
| single "a photo of X" | 7/8 | +0.85 | -0.49 |
| 2 templates | 7/8 | +0.88 | -0.07 |
| 4 templates | 8/8 | +0.98 | +0.06 |
| 4 templates + baseline (5 neutrals, weight 0.75) | 8/8 | +1.38 | +0.25 |

Weight 0.5 to 1.0 all stayed 8/8; 1.25 started to degrade. This is a small test set (8 scenes, 8 queries): the choice is evidence-backed but not a statistical guarantee.

## Real before/after (headless Chromium, real CLIP via the Local AI worker, scene detection + indexing + search UI)
Test video `scenes8b.mp4`: 8 two-second stills, 960x640, in this order: 0:00 beach with a large "NEW YORK CITY / a guide to the streets" book composited on it (decoy, made with PIL), 0:02 city street, 0:04 plain beach, 0:06 Quebec downtown, 0:08 tiger, 0:10 football, 0:12 beach with a small "NEW YORK CITY" book (decoy), 0:14 football 2. Percentages are the panel's "match %" (score x 100); BEFORE = code at 2b7c6bddb, AFTER = this change. A "-" means the scene was below the minimum score.

| query | BEFORE (top 3) | AFTER (top 3) |
|---|---|---|
| a city skyline | **book decoy 25%**, city 24%, book decoy 23% | **city 24%**, book decoy 23%, book decoy 23% (3 results) |
| a city street with buildings | city 27%, book decoy 25%, book decoy 23% | city 27%, book decoy 24%, book decoy 24% (4 results) |
| buildings in a city | city 27%, book decoy 25%, book decoy 23% | city 27%, book decoy 23%, book decoy 23% |
| a street | city 24%, book decoy 24%, plain beach 23% (8 results) | city 24%, book decoy 22% (2 results) |
| a tiger | tiger 30%, then 22% | tiger 28% (only result) |
| a beach | plain beach 28%, book decoy 26%, book decoy 26% | plain beach 27%, book decoy 26%, book decoy 24% |
| a football match | football 2 26%, football 25%, 24% (plain beach/other) | football 2 26%, football 25%, 22% |
| people playing soccer | football 2 26%, **plain beach 25%**, football 25% | football 2 26%, football 25%, plain beach 23% |
| a dog (not in the video) | (not run before) | tiger 22% (1 weak false positive) |

Result: the exact defect class (a text-bearing beach decoy outranking the city scene) reproduced for "a city skyline" with the old code and is fixed; the city query now ranks the city scene first, and tiger / beach / football still rank first. The original photos were gone, so the original 22% vs 21% case could not be recreated exactly: with my decoy the old code already put the city first for "a city street with buildings" (27% vs 25%), and the margin only widens by about 1 point. Margins are still small in absolute terms (1 to 3 points) for the city queries; the improvement is real but not dramatic. The result lists are shorter (fewer irrelevant scenes shown), which is by design of the new minScore.

## Images (all downloaded from Wikimedia Commons; scenes are 2-second stills)
| use | file | licence | author |
|---|---|---|---|
| tiger | Panthera tigris altaica 13 - Buffalo Zoo.jpg | Public domain | Dave Pape |
| beach (and decoy base) | Parasols, Evening, Beach, Rincon de la Victoria, Andalusia, Spain.jpg | CC0 | Jebulon |
| city street | Lime Street buildings, City of London.jpg | CC0 | Robert von Oliva (naruciakk) |
| city (Quebec) | Québec city downtown.jpg | CC BY-SA 4.0 | Wilfredor |
| football | Sheffield Wednesday Players 18102025 (7).jpg | CC0 | Timmy96 |
| football 2 | Sheffield Wednesday Players 18102025 (2).jpg | CC0 | Timmy96 |
The two decoys are derivative works of the CC0 beach photo with a synthetic "New York City" book drawn on it. Images and the test videos are not committed (they live in the session scratchpad).

## Reproduce
`docs/stage-11/smoke/fixl-rank-harness.cjs` (env `SMOKE_PORT`, `VIDEO`, optional `QUERIES`, `OUT`, `DUMP`): launches Chromium with a persistent profile (so the CLIP download is cached), downloads CLIP through the consent UI, detects scenes, indexes and prints the card order with match %.

## Verification
- `npx vitest run src/cinegen/__tests__/localai`: 5 files, 64 tests pass (new: `scene-ranking.test.ts`, 14 tests with synthetic vectors incl. an end-to-end `SceneSearchIndex.search` with a fake worker).
- eslint on the changed files: 0 errors (9 pre-existing style warnings about constructor parameters).

## Unverified
- The caption/tag bonus was not run with real SmolVLM captions (unit tests only); the 0.02/0.04 weights are not tuned.
- Only 8 stills and about 15 queries; real footage (motion, several frames per scene, varied lighting) was not tested. Thresholds 0.22 / weight 0.75 may need adjustment on other content. "a dog" (absent) still returns one weak 22% hit.
- Only the `wasm` backend path in headless Chromium (software GL); WebGPU not exercised.
- Vectors already persisted in IndexedDB stay valid (only the text side changed).
