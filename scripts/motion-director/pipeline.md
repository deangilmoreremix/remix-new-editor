# pipeline — Eight-Stage Production Pipeline

Eight stages; directional questions do not enter the expensive shot-by-shot stage.
The empirical details come from post-mortems of several delivered promos (for the template video see `template/`).

## Contents

- Stage 0: Product understanding and execution constraints
- Stage 1: Visual direction and styleframe
- Stage 2: Feature-to-shot mapping
- Stage 3: Storyboard and production release
- Stage 4: Final asset capture
- Stage 5: Shot-by-shot implementation
- Stage 6: Sound design
- Stage 7: Independent final review and delivery

This file is the complete pipeline for **autonomous free creation**: the judgments of stages 0–3 are made and recorded autonomously by the Agent based on the project content,
without waiting for user confirmation at each stage, and then it proceeds continuously into stages 4–7. Any
purpose, audience, features, aspect ratio, audio or data requirements the user has already given are hard constraints.

Using the Ink Press template directly does not enter this pipeline; execute following the original replacement
workflow in `template/TEMPLATE.md`; when the template docs reference stage 4, only borrow its asset capture method.

**When co-creation enters this file from `guided-free-creation.md`, do not rerun from the beginning.** That workflow
has already completed and confirmed stages 0–3; continue directly from stage 4 final asset capture, without re-asking or redesigning.

Two execution principles (absorbed from real-world post-mortems):

1. **The final design spec and the storyboard together constitute the production release.** The storyboard table lives inside the design spec
   (four columns `| # | Time | Shot | Key motion |`); confirming the release does not reopen already-confirmed
   business or creative questions, it only fills in open items necessary for implementation.
2. **Acceptance runs throughout; it is not the last stage.** Every shot task ends with `npx remotion still`
   still-frame visual acceptance (outputs archived by version in `out/qa/`), and after each round of feedback changes the whole video is re-rendered.
   Stage 7 merely upgrades this running practice into a formal self-check report against aesthetic-rules.md.

Also note the ordering flexibility: the styleframe can first use HTML and a small amount of safe pre-check assets; what matters is that **before shot-by-shot
implementation begins, the final assets must be captured according to the finalized storyboard** — if a wrong asset direction is only exposed
after reaching the shot-by-shot stage, the cost is scrapping the whole set of scenes.

---

## Stage 0: Product understanding and execution constraints

Before writing video code or capturing final assets, do a read-only inspection of the project's positioning, main features, page states, visual
tokens, startup method and data risks. Based on project evidence and the user's existing description, produce a product brief and a requirement-to-execution
decision table, making clear the purpose, audience, core selling points, features that must be shown, duration/aspect ratio/language, and the actual impact of audio and
data policy on this video.

In autonomous free creation the Agent makes dynamic judgments on unspecified items and writes them into the design spec, without pausing to ask the user to confirm.
When the user has specified BGM, first analyze the rhythm following `references/music-beat-sync.md`; when not specified, the Agent
selects it in stage 6 based on the product and publishing scenario. Public demo data may be used after its public nature is confirmed; customer,
personal, internal, secret, live or other sensitive data must always first be made fictional, anonymized or frozen.

**Output**: product brief; requirement-to-execution decision table; explicit data and audio constraints.

---

## Stage 1: Visual direction and styleframe

**Goal**: use the cheapest artifacts to lock the whole video's palette, fonts, light quality and camera-move temperament,
so that all directional debates happen before the first line of Remotion code is written.

**Concrete steps**:

1. Based on the current project, generate at most 3 text directions. Attach a set of **motion personality tokens** to each direction
   (for the derivation method see the "Brand → motion parameters" table below), but do not make Ink Press a fixed option.
2. The Agent autonomously selects the most suitable direction based on product visuals, purpose and audience, and writes the choice and trade-offs into the
   design spec; it does not pause to wait for the user to choose.
3. For the selected direction, **do not render video and do not write Remotion code**; write a pure HTML/CSS
   styleframe page containing 2–3 static 1920×1080 key frames.
4. Use Playwright/Puppeteer screenshots to verify fonts, palette, materials, composition, light quality and information density;
   easing and camera-move speed are still judged by tokens, Gallery samples or short motion tests. If there is already a strict brand guideline
   or an explicit reference video, the styleframe may be skipped after recording the reason.
5. If the user gave a reference video: download it and extract frames with ffmpeg (`select=eq(n,…)` to extract ~100 frames,
   `tile=4x5` to assemble a contact sheet), do a motion breakdown for each animation/transition/effect,
   and write it as a three-column "Technique | Reference implementation | Trade-off" table into the design spec — **adapt selectively,
   do not force-fit**. The same goes for image references: they describe the feel of "a certain kind of shot",
   not a style order for the whole video.

**Brand → motion parameter derivation**. Do not pick easing/durations by feel; first place the brand on two axes,
then start from the nearest preset:

- **Energy axis**: low (calm / premium / institutional) ↔ high (sports / startup / entertainment) —
  determines duration, overshoot and squash amplitude;
- **Tone axis**: serious (finance / healthcare / enterprise) ↔ playful (consumer / social / children) —
  determines path curvature and the amount of secondary action. The product's visuals themselves are evidence (sharp geometry → engineering feel,
  rounded corners + bright colors → soft and playful); brand words the user states override visual inference.

| Preset (category) | Main duration @30fps | Entrance easing | Overshoot | squash |
|---|---|---|---|---|
| Professional trust (fintech/enterprise/B2B) | ~21f | bezier(0,0,0.2,1) | 1.0 no bounce | 0 |
| Refined premium (luxury/fashion) | ~48f | bezier(0.4,0,0.6,1) | ≤1.02 | 0 |
| Energetic bold (sports/gaming/startup) | ~18f | bezier(0.16,1,0.3,1) | 1.12 | 0.25 |
| Playful joyful (consumer/social) | ~27f | bezier(0.34,1.56,0.64,1) | 1.08 | 0.18 |
| Calm caring (health/education) | ~42f | ease-in-out symmetric | 1.0 | ≤0.04 |
| Approachable friendly (small business/community) | ~26f | bezier(0.25,0.46,0.45,0.94) | 1.04 | 0.08 |

Usage: pick a preset → fine-tune along the two axes → write the tokens into the design spec. Two self-checks:
① describe the finished video's motion in three words — do they match the brand words; ② the same set of tokens must govern
entrance/transition/hold rhythm at the same time — one brand, one motion voice; mixing two sets reads as a patchwork.
Note that when preset values conflict with the library's hard precedents, the precedent wins: in situations where a landing should bounce, y1 must be >1;
"professional trust does not bounce" refers to fade-in/push-type actions without a landing metaphor.

**Output**: styleframe for the selected direction; palette/font/light tokens + motion personality tokens;
(when there is a reference video) motion breakdown table.

**Common pitfalls**:

- Using rendered video for style proposals: too expensive, and the psychological cost of changing direction is also high. Static frames are enough to set the tone.
- Applying a reference-driven style move globally across the board: stylized camera angles are decided shot by shot (information-dense
  list/stacking shots are more readable head-on).

---

## Stage 2: Feature-to-shot mapping

**Goal**: choose a suitable motion grammar for each feature that must be shown; do not write the complete storyboard ahead of time at this stage.

**Concrete steps**:

1. **First list the product feature inventory, and map each to a shot**. Missing a core feature means rework;
   one animation technique (fly-in/stacking/page-turn) is the star only once in the whole video; homogenization is a rework signal.
2. Scan the frontmatter of all cards in `references/shots/`, and based on purpose, energy, suggested duration,
   limitations and required page states, choose a preferred and a fallback card for each feature; the Agent finalizes autonomously and records the reasoning.
3. Read the selected cards in full, and locate the exact demo source code via "Reference implementation". When no suitable card exists you may write new code,
   but you must explain the scope and verification risks in the design spec.

**Output**: feature-to-shot mapping table; selected card names, variants, demo source code and reference sample locations.

---

## Stage 3: Storyboard and production release

**Goal**: arrange the finalized feature and shot mapping into a complete shot sequence with an energy curve, and convert it into a frame-level
implementation plan. In autonomous free creation the Agent releases it itself, without pausing to wait for confirmation.

**Concrete steps**:

1. First check `references/sequences/` for an applicable segment template; if there is one, allocate segment slots
   and frame budgets following its fill-in process, then arrange the mapped shots as low-energy opening → feature segments alternating with breathing slots → high-energy close.
2. **When a BGM has already been specified**: first produce the music structure table (full-energy start / breakdown beat numbers,
   see music-beat-sync.md §2), anchor all shot boundaries to beat numbers, and give the strongest hits to
   the video's 2–3 big slams; the breakdown section is naturally the brand breathing slot.
3. Write the complete storyboard table: shot order, duration, feature information, concrete page state, shot card and variant, main action,
   asset source, caption, transition and SFX. Each shot tells only one main motion.
4. When laying out the timeline, **reserve hold/rest frame budgets**: brand wordmark settles with hold ≥1s (30f),
   batch motion ends with 0.5s of stillness, the opening subject's action ≥3s. Rhythm rework is one-directional —
   too fast always means rework, slowing down has never been rejected.
5. After the Agent checks that the storyboard is consistent with the product brief, requirement decisions, visual direction and shot mapping, it releases it itself,
   and translates the storyboard into a frame-level timeline in the implementation plan:
   `| shot | from | duration | content |` (for beat-synced videos, express from/to entirely with `beatF(n)`),
   and assign each shot a source file and acceptance frame numbers.

**Output**: design spec (including style tokens + motion breakdown + storyboard table);
frame-level timeline.

**Common pitfalls**:

- Arranging shots by feel without checking the feature inventory: core features get missed and animation techniques become homogeneous; both mean rework.
- Being greedy in the opening: opening information should be sparse and focused — one hero, one complete action arc.
- Duration budget not including breathing slots: motion fills every frame, and adding holds shot by shot later means shifting frames across the whole line.

---

## Stage 4: Final asset capture

**Precondition**: the final design spec and storyboard have been released. Co-creation takes user confirmation as the release; autonomous
free creation takes the Agent completing and recording the consistency check as the release. Any small number of safe
screenshots captured earlier for the styleframe can only serve as direction validation and must not directly substitute for final assets.

**Goal**: strictly following the final storyboard, obtain the real page assets needed for all shots, including full-page textures, element
slices and the coordinate table, laying the foundation for 2.5D camera moves and page-space animation.

**Concrete steps**:

1. Start the product's local dev server (for desktop products use a window screenshot tool, which likewise produces the three-piece set).
2. Copy `assets/scripts/capture-template.mjs` into the project, change BASE_URL and the selectors,
   and run it once to produce the three-piece set:
   - **Full-page 2x screenshot**: viewport 1920×1080, `deviceScaleFactor: 2`; before screenshotting,
     `document.fonts.ready` + 600ms settle; for live-sync pages wait an extra 1.5–2s.
   - **per-element cutout**: screenshot element by element via semantic selectors; floating pieces use a transparent background; shots that need
     "a card flying into an empty board" additionally capture an empty backplate.
   - **layout.json**: records each element's `{x,y,w,h}` bbox in the full-page coordinate system and each page's
     `pageH`, used directly for flight target positions, mask positions and entrance areas.
3. Support incremental re-capture per page/per element. Live data sources are first frozen, made fictional or anonymized according to the stage 0 data policy,
   and only then is the final capture performed.

**Output**: full-page images, element slices and empty backplates in `public/textures/`; `layout.json`;
a re-runnable capture script.

**Common pitfalls**:

- Doing a full capture before the storyboard is released: page states and asset scope are not yet determined, causing repeated capture.
- Hand-building HTML to reproduce an existing page: reproduction defaults to real screenshots; hand-built UI is only for non-reproduction scenarios.
- Not locking live data sources, or only screenshotting full pages without recording layout coordinates.

---

## Stage 5: Shot-by-shot implementation

**Precondition**: a runnable Remotion project must already exist (30fps, 1920×1080, `src/index.ts`
registering the Composition; a new project can be initialized with `npx create-video@latest` and then have the
`assets/lib/` components copied in; on the template route start directly from `template/`).

**Goal**: implement shot by shot according to the frame-level timeline, with each shot proving its own quality as soon as it is done —
acceptance starts at this stage and is not left to the end.

**Concrete steps**:

1. **For each shot, resolve first, then read three things** (hard rule, cannot be skipped): use
   `gallery/api/library.json` to validate the card name and `style-key` → read the corresponding recipe card in full →
   locate via the card's "Reference implementation" and read the exact demo TSX in full → copy the corresponding `assets/lib/`
   components into the project. At the same time save the path to that style's Gallery reference sample, for comparison during implementation and the final review.
   Styles marked "reference only, requires custom implementation" are not recommended by default; they may be implemented only after the user explicitly names them, and the
   risk must be noted; styles marked "missing preview" must not be claimed to have been reproduced from a motion sample.
   The demo code is the truth of the tuned parameters (easing, timing ratios,
   unmasking timing, workarounds for known pitfalls are all in there) — adaptive
   changes for the target product are allowed, but parameters marked on the recipe card as "Known pitfalls / critical points" must not be downgraded; quality standards only go up, never down.
   Writing new code from the card name and your understanding = throwing away all the accumulated tuning; in practice the texture is a grade worse.
2. **PageCam is the foundation of every "real page" shot**: full-page texture + keyframed 2.5D camera +
   page-space overlay; children are positioned in page CSS px, sharing a coordinate system with layout.json.
3. **Still-frame acceptance (the most frequent action)**: for each shot, hard-code 2 acceptance frame numbers in the plan;
   on completion run `npx remotion still src/index.ts <Comp> out/qa/<name>.png
   --frame=<N>`, and only count it as done after visually checking composition/continuity errors/text sharpness yourself.
   Still-frame outputs are archived by iteration version in `out/qa/`, so when the user posts frame feedback it can be matched directly.
4. **Render the whole video after each round of changes**: `npx remotion render src/index.ts <Comp>
   out/promo.mp4`, then use `ffmpeg -i out/promo.mp4 -vf "select=eq(n,…)"`
   to extract key frames from the finished video to review. The actual practice is "whichever shot you change, still those few frames,
   then re-render the whole video"; the cost is acceptable and it eliminates seam surprises.
5. Keep small tools for pixel-level self-checks: crop and zoom to check text sharpness (crop), pixel diff of two frames,
   measure element bboxes to check composition.
6. **Iron law of deterministic rendering**: ban `Date.now()` / `Math.random()` / argument-less `new Date()`.
   All pseudo-randomness uses fixed seeds (mulberry32/hash functions, seed derived from index),
   guaranteeing frame-by-frame reproducibility and zero jitter between renders.
7. Self-check against `references/aesthetic-rules.md` as you go (do not wait for stage 7):
   for easing where a landing should bounce y1 must be >1, clip light effects into rounded corners, and when text is blurry in 3D first check the
   rasterization path (CSS `zoom` layout-level magnification rather than transform scale) rather than adjusting DoF.
8. For user feedback with ambiguous references ("the first title"), confirm the target before acting; if you change the wrong thing, immediately revert the whole
   commit and redo it, do not patch on top of the wrong version — each change is an independent commit
   so it can be rolled back cleanly.
9. **Leave the interface ready for the post-delivery motion workbench** (`references/workbench.md` §2–3): write the schedule only once
   (`SHOTS` is the single source of truth; the caption table / SFX frame pins / transition points are derived from it and `export`ed); make a shot's context-level
   parameters (copy / color / font size / position) into props with default values, and keep rhythm-critical values as constants;
   in `src/workbench.ts` import these tables and add `component` / `props` / `schema` for each unit.
   The template route already includes it (`template/src/workbench.ts`); free creation adds it after the timeline is finalized,
   and before delivery runs `cd workbench && npm run parity` to prove the split is lossless.

**Output**: per-shot commits; `out/qa/` still-frame archive; a whole-video render mp4 per round; the `src/workbench.ts` manifest.

**Stage output**: whole-video rendered video (one version per iteration) + key stills. Autonomous free creation does not pause on this output
to wait for confirmation; when the user proactively gives feedback, it is incorporated into the next round.
The user may give feedback by "taking frames from the finished video and posting images"; both sides review based on frames.

**Common pitfalls**:

- Handing the first review to the user: before delivery you must extract frames and watch the video yourself; problems like "the camera angle is bad,
  and there's a slight jitter" should not be discovered by the user.
- Skipping the demo code and writing directly: the parameters were tuned through several rounds of real judgments;
  a newly written version almost inevitably steps back into known pitfalls.
- Product promos do not add handheld shake by default; camera noise is only used when explicitly pursuing a documentary feel.
- Mass decorative glints/blooms: batches of elements enter through the motion itself. A single high-quality light effect is fine;
  doing it en masse is cheap.
- Text blurring during 3D push-ins: the root cause is texture source resolution / rasterization path; first check the asset chain
  (2x textures + CSS zoom + separate 4x screenshots of key elements), don't touch the camera and depth of field first.
- Fly-in animation ending suspended in mid-air: elements must land into real slots in the page layout (embedding, returning to place,
  joining the scroll flow); floating above the page without landing looks fake.

---

## Stage 6: Sound design

**Goal**: BGM sets the whole video's energy skeleton, SFX are pinned beat by beat to motion keyframes,
and the timbres fit the "product promo" genre rather than UI event semantics.

**Precondition (the most expensive ordering lesson)**: **start only after the picture timeline is locked.**
Every time the picture moves, the whole frame-pin table has to be realigned. If the picture really did change again, the wrap-up action always
includes "realign the SFX frame numbers across the whole table"; audio-picture misalignment is a must-check item.

**Concrete steps** (details and precedents in `references/sound-design.md`):

1. Read `references/sound-design.md`, and copy sound effects from `assets/audio/sfx/<category>/`
   (free commercial-use license, sources in `assets/audio/ATTRIBUTION.md`). Sound effects are divided by scenario into 16
   category directories; first decide the category by the action needed (camera move → transition, landing → impact,
   typing → text, page-turn → paper, light effect → **light** …), then pick the timbre within the category.
   Note that the vocabulary term `sparkle` corresponds to the directory name `light/`; there is no `sparkle/` in the library.
2. **BGM**: user has specified → rhythm analysis was already done in stage 0, here only mix
   (lower the volume to ~0.34 to leave headroom for SFX, interpolate fade-in and fade-out at start and end).
   Not specified → by genre choose an electronic bed with strong drums and strong rhythm (tech-house type); the criterion is
   the temperament of "a typical product promo video", not "sounds nice"; candidate tracks must be laid under the finished video for listening,
   choosing by listening to the track alone is unreliable; `assets/audio/bgm/` has strong-rhythm candidates.
   Wrap the BGM `<Audio>` separately with a boolean inputProp (e.g. `bgm`, default `true`),
   decoupled from SFX — the final render must produce both with-BGM / without-BGM versions from the same timeline.
3. **Choose SFX by shot language using cinematic vocabulary**: camera move = whoosh, landing = impact,
   build-up = riser, light effect = sparkle (directory `light/`), transition = transition;
   game sound pack **timbres** are banned (synth pluck/bloop, cartoon bounces break immersion at first listen).
   Note that "banning game sounds" bans the timbre, not the action — if the picture really has a click/toggle/shatter it should get
   its foley; for the deciding question see aesthetic-rules S1. But **`ui/` must be auditioned one by one and cannot be
   approved as a whole directory**: of its 18 files only a few such as `switch-*` are real switch foley; more than half are
   synthesized feedback sounds (tone/bleep/notification), exactly the texture S1 excludes — the per-file
   keep/drop table is in sound-design 3.3. `glass/` is real shattering material sound and is not on the banned list.
4. **Centrally managed declarative frame-pin table + relative frame pins**: a single file with a `{ from, src, volume }[]`
   array, each entry commented with its corresponding picture action, each entry wrapped in `<Sequence from={s.from}>`.
   **from is always written as a relative expression** — `SHOTS.x.from + offset`, for beat-synced videos
   `beatF(n)` — never a bare numeric frame number. When the timeline shifts, the frame-pin table follows automatically,
   avoiding re-pinning the whole table. **Long samples (>5s, 21 in the library) must be given an explicit `durationInFrames`**
   — truncate via Sequence rather than editing the audio file; if omitted they keep sounding after the action ends.
   The list and truncation criteria are in sound-design 4.1.
5. Three tricks against the machine-gun effect in rapid fire: alternate between two samples, step volume down (e.g. six pops
   0.40→0.25), accelerate intervals following the animation curve (when it gets so dense it blurs together, let the sound fade out into a swoosh).
6. Beyond generic sounds, leave "picture-specific custom" slots: distinctive picture actions get their own foley
   (typing visuals get keyboard sounds, items dropping in one by one get individual pops); a generic swoosh can't cover them.
7. For videos with strong-drum BGM, be restrained with SFX: the drums are themselves beat sounds; SFX only pin actions unique to the
   picture, and big slams are given only to 2–3 peaks.
8. Fixed ending phrase: riser (from the start of the assembly section) → impact (wordmark lands, the whole video's volume peak)
   → sparkle (afterglow, taken from `sfx/light/`).
9. **Set volume by the asset's measured peak, do not copy a range**: `volume` is a multiplier, not a target
   volume — the usual 0.2–0.6 presupposes that the asset's peak is near 0dB. The 7 quietly recorded assets in the library
   (peak <-12dB, the quietest -24.6dB) given 1.0 are still more than ten dB lower than the BGM and get buried by the drums:
   **the first choice is to swap for a well-recorded asset from the same category, or pre-normalize before adding to the library**; if necessary you can give
   gain >1 (Remotion supports real amplification, but the preview clamps to 1.0, so the peak must be verified on the rendered output
   to prevent clipping). The list and the three ways out are in sound-design 4.1.

**Output**: whole video with sound; SFX frame-pin table (relative frame expression + source + volume + comment);
audio files added to the repo with their source licenses recorded.

**Stage output**: whole-video render with sound. Autonomous free creation continues into the final review without pausing to wait for confirmation.

**Common pitfalls**:

- Laying down sound effects before the picture is locked: the knock-on cost of realigning the whole table (see precondition).
- Choosing timbres by UI event semantics (synth confirmation/minimize prompt sounds): genre mismatch, the whole batch gets thrown out.
  But don't overcorrect to "giving interactive actions no sound at all" — that violates S4 foley-first.
- Not giving long samples durationInFrames: the sound overruns subsequent shots (21 in the library are >5s).
- Copying the 0.2–0.6 volume range without looking at the asset's peak: pinning a quiet asset is as good as not pinning it.
- Scattering sound effects by feel without building a table: after frame numbers drift they can't be shifted as a whole, nor compared against the storyboard table.

---

## Stage 7: Acceptance

**Goal**: upgrade the still-frame/whole-video self-checks that ran throughout into one formal whole-video review,
while verifying whether the finished video faithfully executes the product brief, requirement-to-execution decision table, visual direction, shot mapping and storyboard confirmed or recorded in the current mode;
produce an item-by-item report against the final review and aesthetic rules, then do the final render and deliver.

**Concrete steps**:

1. Render the latest version of the whole video, and extract all key frames with ffmpeg (at least per shot: mid-entrance,
   action peak, after settling — three frames). Videos with BGM render both versions at this point — the with-BGM version
   and the without-BGM version (keeping SFX); the without-BGM version is rendered from the same timeline via the `bgm` inputProp reserved in stage 6:
   write a `props-nobgm.json` (content `{"bgm":false}`)
   then `npx remotion render … --props=props-nobgm.json` (reliable cross-platform;
   on macOS/Linux you can also inline `--props='{"bgm":false}'`, but Windows shells strip the double quotes from
   inline JSON, so you must use the file). Do not create a separate project, do not extract tracks with ffmpeg in post.
   Distinguish by name (e.g. `promo.mp4` / `promo-nobgm.mp4`).
2. **Independent final review (mandatory)**: dispatch a clean-context subagent to do a third-party review.
   Do not give it justifications from the production process, the change history, or hints that it "should pass"; only provide: the latest finished video
   (for videos with BGM include both versions, for A8 verification),
   the extracted key frames, creation mode, product brief, requirement-to-execution decision table, the confirmed or recorded visual direction/tokens, the styleframe or the reason for skipping it,
   the feature-to-shot mapping,
   Gallery card names and specific variants, the corresponding records in `library.json`, the exact
   demo TSX located via the card documents, the Gallery reference samples or key frames extracted from them, the final storyboard, the selected shot cards,
   `references/final-review.md` and `references/aesthetic-rules.md`.
3. The review Agent checks, following `final-review.md`, the product goals, feature completeness, visual direction consistency,
   shot card/variant fidelity, storyboard consistency, data safety, audio-picture sync and visual technical quality. Shot by shot
   it looks at frames + watches the video, giving conclusions like "F2 ✗ (frame 340 is missing the confirmed knowledge graph feature)" or
   "Q2 ✗ (text blurry at frame 615)", with each issue accompanied by verifiable frame numbers/screenshots.
   Shot card adaptation does not need to be pixel-identical to the Gallery sample, but must preserve the motion grammar, key timings,
   known-pitfall/critical parameters and the specific variant the user named.
4. Content-level self-check: for each shot ask "what new information does it give"; delete repeated shots/repeated taglines;
   rewrite the copy once against the final picture; pure animation segments also need explanatory captions — leave no mute segments.
5. Final audio-picture alignment check: play back each SFX against its frame to confirm no misalignment (if the timeline was changed after stage 6,
   realign first, then verify). For beat-synced videos do the post-render back-test per music-beat-sync.md §5;
   it passes only when all cut point errors are ≤3f.
6. Fix items from the review report go back to the small loops of stages 3/5/6: plan or storyboard deviations go back to stage 3, picture implementation
   problems go back to stage 5, sound problems go back to stage 6; until the checklist passes, then do the final render.
   The final render repeats step 1's dual-version rendering — videos with BGM deliver both with-BGM / without-BGM versions;
   the without-BGM version makes it easy for the user to add their own music later or use platform music.

**Output**: independent review report (final-review + aesthetic-rules checklist + frame-number evidence)
+ final rendered video (with-BGM / without-BGM versions).

**Deliverables**: review report + two versions of the finished video (with BGM + without BGM).

After delivery, first proactively open the motion workbench with `node workbench/scripts/open.mjs <project-dir>` (the browser automatically
splits the finished video into multiple tracks; the user can fine-tune visually and export directly; see `references/workbench.md`), then at the very end say
three things in order 1-2-3: ① when publishing, it is recommended (not required) to @ the
skill author in the description (all three platform accounts with links); ② invite them to put the finished video on the showcase page (say it in everyday
language; they can leave their own accounts); ③ the JianYing project file can be exported (if needed read
`references/jianying-export.md` and execute). For the exact wording of each item and the account links, see the "Delivery wrap-up" section of `SKILL.md`.

**Common pitfalls**:

- Treating acceptance as "the thing done only at the end": this stage is only the closing. If the first five stages did not do still-frame self-checks,
  the volume of problems piling up here will make the checklist meaningless — acceptance running throughout is the standard practice.
- Self-check reports degenerating into "all ✓": the user will read every word on screen and take frames to compare themselves —
  every conclusion in the report should come with verifiable frame numbers/screenshots.
- The production agent writing its own review report: confirmation bias is unavoidable; the independent subagent review
  cannot be omitted.
- Only checking "does it look good" and not "does it match the current mode's production baseline": missed features, visual direction drift,
  wrong shot variants and unconfirmed data all count as final review failures.
