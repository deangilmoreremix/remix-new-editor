# Adapter spec — SmartVideo GO AI, Phase 1 upstream templates

**Status:** contract. The integration agent implements against this document; the upstream files in
this folder are **frozen** and must not be edited.

**Audience:** the agent writing the Phase 1 personalization template layer
(`src/shared/personalization/templates/catalog.ts` + the design components) in the
`OpenHiggsBolt` repo, branch `personalization-upgrades`.

**Target repo Remotion stack:** `remotion@4.0.499`, `@remotion/player@4.0.499`,
`@remotion/media@4.0.499`, `@remotion/web-renderer@4.0.499`, `react@19`. There is **no**
`@remotion/google-fonts`, **no** `zod`, **no** `@remotion/zod-types` and **no**
`@remotion/transitions` in the target repo, and none may be added.

---

## 0. Global contract

### 0.1 Where the design layer is mounted (read this first)

The shared design registry already exists in the target repo
(`src/shared/personalization/templates/{types,registry,index}.ts`). The composition mounts a
registered design in `src/shared/personalization/preview/PersonalizationComposition.tsx`:

```tsx
const design = getRemotionDesignTemplate(layer.designId)
const slots = resolveDesignTextSlots(design, layer, brand)   // by slot.key
const media = resolveDesignMedia(design, layer, brand)        // by media role
…
<AbsoluteFill
  key={layer.id}
  style={{
    left: box.leftPx, top: box.topPx, width: box.widthPx,
    height: box.heightPx ?? '100%',
    transform: transformParts.join(' ') || undefined,   // entrance animation
    opacity: layer.opacity * entrance.opacity,
    pointerEvents: 'none',
  }}
>
  <DesignComponent
    text={…} textSlots={slots} colors={…} media={…}
    box={{ leftPx, topPx, widthPx, heightPx }}
    width={compW} height={compH} frame={frame} fps={settings.fps}
    opacity={layer.opacity} color={textColor} fontFamily={layer.fontFamily}
  />
</AbsoluteFill>
```

and the box comes from `toBox()` in `src/shared/personalization/preview/presets.ts`:

```ts
// layer.kind === 'design'
const widthPx  = Math.round(scale * width)      // scale = layer.scale
const heightPx = Math.round(scale * height)
const leftPx   = Math.round(x * width  - widthPx / 2)
const topPx    = Math.max(0, Math.round(y * height - heightPx / 2))
```

**Three consequences that drive every decision in this document.**

1. **The design box is a scaled copy of the whole composition** (same aspect ratio), positioned by
   the layer's normalized `x`/`y`. The upstream components lay themselves out against the
   **composition** (`useVideoConfig().width/height`), *not* against the box. If the adapter simply
   drops the upstream component inside the box, a 60 %-scale box would show a composition-sized
   design overflowing its box.
   → **Required:** every adapter must render the upstream inside a **composition-sized** child that
   is then scaled into the box:

   ```tsx
   const s = props.box.widthPx / Math.max(1, props.width)   // == layer.scale
   <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
     <AbsoluteFill
       style={{
         width: props.width, height: props.height,
         transform: s === 1 ? undefined : `scale(${s})`,
         transformOrigin: 'top left',
       }}
     >
       <UpstreamComponent … />
     </AbsoluteFill>
   </AbsoluteFill>
   ```

   This also solves the hardcoded-pixel problem: the upstream's fixed `fontSize: 130` is scaled
   with the box, exactly like the design's own geometry.
   **When `s === 1`, omit the `transform` entirely** — an identity `transform` still creates a
   stacking context (see §0.3).
2. **`useCurrentFrame()` inside the upstream is the *composition* frame**, because the design
   component is **not** wrapped in a `<Sequence>`. If the design layer has
   `startFrame = 60`, the upstream animation is already 60 frames in when the layer appears.
   → **Required integration change (outside this folder):** wrap the design component in a
   `<Sequence from={layer.startFrame}>` in `PersonalizationComposition.tsx`, immediately inside
   the `<AbsoluteFill>` that hosts it:

   ```tsx
   <AbsoluteFill key={layer.id} style={{ ...layerStyle, height: box.heightPx ?? '100%' }}>
     <Sequence from={layer.startFrame} durationInFrames={Math.max(1, layer.endFrame ? layer.endFrame - layer.startFrame : undefined)}>
       <DesignComponent … />
     </Sequence>
   </AbsoluteFill>
   ```

   `<Sequence>` makes `useCurrentFrame()` return the **layer-local** frame; it does **not** change
   `useVideoConfig()` (the composition's width/height/fps are unaffected), so the upstream's
   geometry is untouched. `Sequence` is already imported and used in that file (the end-card
   sequence), and the `NOOP_SEQUENCE_MANAGER` there only stubs the *media* registration manager,
   which `<Sequence>` does not need.
   Without this change the design's own `animation.delayInFrames` cannot be honoured, because the
   frozen upstreams all start their motion at frame 0.
3. **Stacking contexts break `mix-blend-mode`.** The parent wrapper applies the entrance
   `transform` and `opacity`. `transform` (even `scale(1)`) and `opacity < 1` both create a
   stacking context, which **confines `mix-blend-mode: screen`** to that wrapper. This directly
   affects `bokeh-circles` — see §5.7.

### 0.2 Brand value sources (exact field names)

The registry already resolves brand values for you. Do not re-derive them.

| Adapter input | Registry source | Type | Notes |
|---|---|---|---|
| `businessName` | `brand.businessName` (`PreviewInputProps['brand']`) | `string` | |
| `headline` | `brand.headline` | `string` | |
| `offer` | `brand.offer` | `string` | |
| `cta` | `brand.cta` | `string` | |
| `logoUrl` | `brand.logoUrl` | `string \| null` | also delivered as `media.logo` |
| `accentColor` | `colors.accent` (`PreviewBrandColors.accent`) | `string` (hex) | |
| `primaryColor` | `colors.primary` | `string` (hex) | |
| `textColor` | `colors.text` | `string` (hex) | also `props.color` (the layer's colour override) |
| `backgroundDim` | `colors.backgroundDim` | `number` | the composition's own dim scrim |

**How the registry feeds a design component** (`resolveDesignTextSlots` / `resolveDesignMedia`):

- `textSlots` is a `Record<slotKey, string>`. The slot marked `primary: true` receives
  **`layer.text`** (what the customer typed on the layer); every other slot receives
  `brandTextValue(slot.field, brand)` — i.e. `brand[field]` for
  `field ∈ {businessName, headline, offer, cta, phone, website}`.
  → Declare the slots so that the customer's editable text lands in the right upstream prop.
- `media` is a `Record<role, string | null>` for `role ∈ {logo, product, service}`:
  `media.logo = brand.logoUrl`, `media.product = brand.productUrl`, `media.service = brand.serviceUrl`;
  the **first required** binding's role is overridden by `layer.imageUrl` when the customer picked
  an image for the layer.
- `colors` carries `primary`, `accent`, `text`, `backgroundDim`.

### 0.3 Global rules

1. **The upstream components are frozen.** Do not patch, restyle or refactor them. Only their
   **props** may be supplied. Where a template paints something the adapter cannot turn off (an
   opaque canvas, a baked-in label), the adapter works around it by **composition** (a bounded
   wrapper, a sibling layer), not by editing the file.
2. **The user's real video stays underneath.** The design is rendered as a sibling layer above the
   `@remotion/media` `<Video>` in `PersonalizationComposition`, with `pointerEvents: 'none'`.
   Never re-import or re-render the video inside a template.
3. **Transparent canvas.** Where the template exposes a background colour prop, the adapter passes
   `"transparent"` — never a brand colour — so the video shows through. The single exception is
   `end-card` (§4.4/§4.5).
4. **No upstream demo copy may be reachable.** The upstream `default*Props` objects must never be
   spread into the adapter's props (that would re-introduce `"Alex Morgan"`,
   `"Thanks for watching"`, `"Background Demo"`, …). Every content prop comes from §0.2.
5. **Aspect ratios.** The four Phase 1 formats are `16:9` (1920×1080), `9:16` (1080×1920),
   `1:1` (1080×1080) and `4:5` (1080×1350) — `PreviewAspectRatio` in
   `src/shared/personalization/preview/types.ts`. All five templates read `width`/`height` from
   `useVideoConfig()`, so they resize with the composition; the only *hardcoded pixel* problem is
   `bounce-in-headline` (§1.6), which the §0.1 scale-wrapper solves.
6. **fps.** The target renders at **30 fps** (`DEFAULT_PREVIEW_FPS = 30`). All five upstreams were
   authored for 30 fps and export `export const FPS = 30`. Do not re-time them.
7. **Fonts.** The upstream templates hardcode
   `-apple-system, "Segoe UI", Roboto, sans-serif` as a **module-level constant** — it is not a
   prop and cannot be overridden through props. The registry passes `props.fontFamily` (the
   customer's font choice) to the design component, so the adapter may apply it to a wrapper,
   but the upstream's own text will still use its constant. Accept the system stack, or (if brand
   fonts are mandatory) ship a separate adapter component rather than editing the upstream file.
8. **Attribution.** The product must display
   `© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates`
   plus the verbatim MIT permission notice. The per-design `source.attribution` string in the
   catalog should carry exactly this line.
9. **No new npm dependencies.** The five components import only `react` and `remotion`.
10. **Determinism.** All five are pure functions of `useCurrentFrame()`; no `Math.random()`, no
    `Date.now()`, no network access, no CSS `@keyframes`/`animation`. They render identically in
    `<Player>` and in `@remotion/web-renderer`.

---

## 1. `bounce-in-headline` → category `animated-headline`

### 1.1 Upstream component and export shape

```ts
// src/shared/personalization/templates/_upstream/bounce-in-headline/BounceInHeadline.tsx
export const FPS = 30;
export const DURATION_FRAMES = 120;
export type BounceInHeadlineProps = { ... };
export const defaultBounceInHeadlineProps: BounceInHeadlineProps = { ... };
export const BounceInHeadline: React.FC<BounceInHeadlineProps>;
export default BounceInHeadline;
```

**Named export `BounceInHeadline` and a default export — the same component.** Import the
**named** export so the binding to the upstream file is explicit.

### 1.2 Exact props accepted

```ts
export type BounceInHeadlineProps = {
  headline: string;   // required
  background: string; // required
  color: string;      // required
  bounces: number;    // required
  height: number;     // required
  delay: number;      // required — FRAMES
  duration: number;   // required — FRAMES
};
```

All seven are required; no defaults are applied if one is omitted.

### 1.3 Prop → brand mapping

| Upstream prop | Registry value | Notes |
|---|---|---|
| `headline` | `textSlots.headline` (slot `field: 'headline'`, **primary**) | fallback chain: `headline → offer → businessName → 'Your brand'`. **The component renders the whole string in one `<div>`** — it does *not* split per word, despite the upstream README saying "word by word". If per-word motion is required, either render one component per word with staggered `delay`, or use the upstream `kinetic-word-stack` instead. |
| `color` | `props.color` (the layer's colour override) falling back to `colors.text` | text colour |
| `background` | `"transparent"` | **not** `colors.primary` — a fill would hide the video |
| `bounces` | `3` (upstream default) | keep |
| `height` | `120` (upstream default) | keep; the scale-wrapper scales it with the box |
| `delay` | `0` | the layer's own `startFrame` provides the offset (§0.1.2); the upstream's internal `delay` stays 0 so the bounce starts the moment the layer appears |
| `duration` | `36` (upstream default) | keep |

`businessName`, `offer`, `cta`, `logoUrl`, `accentColor`, `primaryColor` are **not** used by this
template.

### 1.4 Props to REMOVE from the adapter's public surface

- The upstream default copy `"Make It Bounce"` — never reachable; the adapter always passes the
  resolved `headline` slot.
- `background` — always `"transparent"`, never a user input.
- `bounces`, `height`, `delay`, `duration` — internal motion constants, not brand inputs. Expose
  them only as `RemotionDesignTemplate.defaultProps` if the picker wants a tuning knob.

### 1.5 Animation timing and fps assumption

- Module constants: `FPS = 30`, `DURATION_FRAMES = 120` (4.0 s at 30 fps).
- `progress = interpolate(frame, [delay, delay + duration], [0, 1], clamped)` → the effect occupies
  frames `8 → 44` with the upstream defaults (`delay = 8`, `duration = 36`).
- `opacity = interpolate(progress, [0, 0.1], [0, 1])` → fully opaque from frame ≈ 11.6.
- `bounceY = |sin(progress · π · bounces)| · height · (1 - progress)` while `progress < 1`, else `0`
  — a damped sine, **not** a Remotion `spring()`.
- The element is translated by `translateY(-bounceY px)`; there is no scale, no rotation and **no
  exit animation**. It stays fully visible from frame ≈ 12 to frame 119.
- **fps assumption:** the component does **not** import `useVideoConfig()`, so `delay` and
  `duration` are **raw frame counts** and `height` is raw pixels. At 30 fps the effect lasts 1.2 s;
  at 60 fps it would last 2.4 s of wall-clock and look twice as slow. **Keep 30 fps.**

### 1.6 Hardcoded values that must be parameterised

| Value | Where | Problem | Action |
|---|---|---|---|
| `fontSize: 130` | text style | fixed px — too small for a 1080×1920 frame, reasonable for 1920×1080 | the prop surface has **no font-size prop**. The §0.1 scale-wrapper scales it together with the box; if the design is used at `scale = 1` on a 9:16 canvas, the headline will look small. Either accept it, or implement a font-size-agnostic adapter component of your own. **Do not edit the upstream file.** |
| `letterSpacing: 6` | text style | fixed px | same as above (scaled by the wrapper) |
| `fontWeight: 900` | text style | fine | keep |
| `FONT_SANS` | module const | system stack, not a prop | see §0.3 rule 7 |
| `height: 120` | prop | px bounce height | keep (scaled by the wrapper) |
| `delay: 8`, `duration: 36` | props | frames | set `delay = 0` (the layer's `startFrame` owns the offset) and keep `duration = 36` |

### 1.7 Player + web-renderer safety

- **`<Player>`:** safe. Uses only `useCurrentFrame`, `interpolate`, `AbsoluteFill` and inline styles.
  It does not depend on `useVideoConfig()`, so it is insensitive to the composition metadata.
- **`@remotion/web-renderer`:** safe. No `staticFile`, no `<Video>`/`<Audio>`, no `<Img>`, no
  `filter`, no `mix-blend-mode`, no `background-clip`, no CSS `animation`. Only `opacity`,
  `transform: translateY()`, `font-size`, `letter-spacing`, `color` and `background-color` — all
  rasterise identically in a browser DOM capture.
- **Legibility caveat:** the headline has no text shadow and no scrim. Over a bright video,
  `colors.text` may be unreadable. The adapter may draw its own scrim (its own element, not the
  upstream's) or rely on the composition's existing `brandColors.backgroundDim` scrim.

---

## 2. `logo-stroke-draw` → category `logo-reveal`

### 2.1 Upstream component and export shape

```ts
// src/shared/personalization/templates/_upstream/logo-stroke-draw/LogoStrokeDraw.tsx
export const FPS = 30;
export const DURATION_FRAMES = 110;
export type LogoStrokeDrawProps = { ... };
export const defaultLogoStrokeDrawProps: LogoStrokeDrawProps = { ... };
export const LogoStrokeDraw: React.FC<LogoStrokeDrawProps>;
export default LogoStrokeDraw;
```

Import the **named** export `LogoStrokeDraw`.

### 2.2 Exact props accepted

```ts
export type LogoStrokeDrawProps = {
  backgroundColor: string; // required
  accentColor: string;     // required
  textColor: string;       // required
  monogram: string;        // required
  brandText: string;       // required
};
```

All five required; no optional props.

### 2.3 Prop → brand mapping

| Upstream prop | Registry value | Notes |
|---|---|---|
| `monogram` | first character of `textSlots.businessName`, upper-cased | e.g. `"Acme Co." → "A"`. The monogram is an SVG `<text>` at `fontSize = R * 1.15`, `fontWeight 800`, `dominantBaseline="central"` — exactly one glyph fits. Fallback: first character of `headline`, else `"★"`. |
| `brandText` | `textSlots.businessName` | the wordmark under the badge, `fontWeight 700`, `letterSpacing 0.22em` |
| `accentColor` | `colors.accent` | drives the ring stroke, the 16 %-alpha badge fill, the underline and the radial glow. If `colors.accent` is empty, fall back to `colors.primary`. |
| `textColor` | `props.color` falling back to `colors.text` | monogram, wordmark and the shine band |
| `backgroundColor` | `"transparent"` | **not** `colors.primary` |

**`media.logo` (the brand logo URL) is NOT consumed by the upstream component** —
`LogoStrokeDraw` draws a monogram badge + wordmark; it has no image prop. Two supported strategies:

- **(A, recommended, keeps the upstream file frozen):** the adapter renders the upstream component
  **and** overlays its own `<Img src={media.logo} />` centred on the badge, timed to the upstream's
  `fillIn` window (frames 44 → 66, opacity `fillIn`), sized to the badge diameter
  (`2 * (height * 0.2 - height * 0.011 / 2)`) and centred at `(width/2, height * 0.42)`.
  The upstream `monogram` must then be a single space (`" "`) so the glyph is invisible while the
  badge geometry still animates.
  → In the catalog, declare `media: [{ role: 'logo', label: 'Logo', required: false }]`
  (the logo is optional — the monogram lockup works on its own).
- **(B):** skip the upstream component and implement the logo reveal in the adapter with `<Img>`.
  This loses the stroke-draw motion and is a larger change — only take it if the brand logo must be
  the hero. If you do, declare `media: [{ role: 'logo', …, required: true }]`.

`headline`, `offer`, `cta`, `primaryColor` are not used by this template.

### 2.4 Props to REMOVE from the adapter's public surface

- Upstream demo copy `"ACME INC."` and monogram `"A"` — always derived from `businessName`.
- `backgroundColor` — always `"transparent"`.
- `accentColor` / `textColor` — derived from the brand, not per-render user input.

### 2.5 Animation timing and fps assumption

Module constants: `FPS = 30`, `DURATION_FRAMES = 110` (3.67 s at 30 fps). The phase markers are
**raw frame numbers** (measured against the *layer-local* frame, see §0.1.2):

| Window | Property | Behaviour |
|---|---|---|
| 0 → 50 | `drawProgress` | the badge ring is drawn stroke-by-stroke (`strokeDashoffset` from `ringLen` to `0`) |
| 44 → 66 | `fillIn` | the badge fill fades in to `accentColor` at 16 % alpha |
| 58 → 84 | `shine` | a bright diagonal band sweeps across the badge, clipped to the badge circle |
| 60 → 78 | `textIn` | the wordmark fades in and rises by `height * 0.025` |
| 44 → 74 | `settle` | `spring({ damping: 14, stiffness: 90, mass: 0.8, durationInFrames: 30 })` scales the whole lockup from `0.94` to `1.0` |
| 100 → 109 | `exitOpacity` | the whole layer eases to `0.92` — it never fully disappears |

**fps assumption:** the component imports `useVideoConfig()` and uses `fps` **only** for the
`spring()` (so the settle is fps-independent). Every other phase marker is a raw frame count, so
at 60 fps the whole reveal takes twice as long in wall-clock. **Keep 30 fps.**

### 2.6 Hardcoded values that must be parameterised

| Value | Where | Problem | Action |
|---|---|---|---|
| `cx = width / 2`, `cy = height * 0.42` | layout | relative to the composition | keep |
| `R = height * 0.2` | badge radius | relative | keep; badge diameter = `0.4 * height` |
| `strokeW = height * 0.011` | ring stroke | relative | keep |
| `fontSize = R * 1.15` (monogram) | SVG `<text>` | relative | keep |
| `fontSize = height * 0.05` (wordmark) | wordmark | relative | keep |
| `letterSpacing: "0.22em"` | wordmark | relative to the font size → scales | keep |
| underline `width = width * 0.12`, `height = height * 0.004`, `borderRadius = height * 0.004` | underline | relative | keep |
| wordmark `top = cy + R + height * 0.07` | layout | relative | keep |
| `clipPath id="lsd-shine-clip"` | SVG | **fixed DOM id** — two mounted instances duplicate the id and the second clip may resolve to the first | accepted: the clip shape is identical, so the visual result is unchanged. If two of these are ever mounted at once, expect a shared clip, not a crash. |

**No font-size or pixel value needs changing for 16:9 / 9:16 / 1:1 / 4:5** — this is the most
resolution-agnostic of the five.

### 2.7 Player + web-renderer safety

- **`<Player>`:** safe. `useCurrentFrame` + `useVideoConfig` only. The SVG uses `strokeDasharray` /
  `strokeDashoffset` / `clipPath` — static-DOM features, no filters.
- **`@remotion/web-renderer`:** safe. No `staticFile`, no `<Video>`/`<Audio>`, no CSS `filter`, no
  `mix-blend-mode`, no `background-clip: text`, no CSS `animation`. The only thing to watch is the
  fixed SVG `id` (above), not the rasteriser.
- **Overlay note:** the component adds a low-alpha radial "backdrop glow"
  (`radial-gradient(circle at cx cy, ${accentColor}22 0%, transparent ${R*2.2}px)`) behind the
  badge. Over a video this is a subtle brand-tinted halo — desirable, but it is not switchable.

---

## 3. `lower-third-glass-card` → category `lower-third`

### 3.1 Upstream component and export shape

```ts
// src/shared/personalization/templates/_upstream/lower-third-glass-card/LowerThirdGlassCard.tsx
export const FPS = 30;
export const DURATION_FRAMES = 120;
export type LowerThirdGlassCardProps = { ... };
export const defaultLowerThirdGlassCardProps: LowerThirdGlassCardProps = { ... };
export const LowerThirdGlassCard: React.FC<LowerThirdGlassCardProps>;
export default LowerThirdGlassCard;
```

Import the **named** export `LowerThirdGlassCard`.

### 3.2 Exact props accepted

```ts
export type LowerThirdGlassCardProps = {
  backgroundColor: string; // required
  accentColor: string;     // required
  textColor: string;       // required
  nameText: string;        // required
  titleText: string;       // required
};
```

All five required; no optional props.

### 3.3 Prop → brand mapping

| Upstream prop | Registry value | Notes |
|---|---|---|
| `nameText` | `textSlots.businessName` (slot `field: 'businessName'`, **primary**) | primary line, `fontSize = height * 0.058`, `fontWeight 800`, `whiteSpace: "nowrap"` |
| `titleText` | `textSlots.offer` (slot `field: 'offer'`) | secondary line, `fontSize = height * 0.026`, `fontWeight 500`, `letterSpacing 0.05em`, `whiteSpace: "nowrap"`. Fallback: `headline` if `offer` is empty. |
| `accentColor` | `colors.accent` | left accent bar, inner glow and the full-frame radial ambient wash |
| `textColor` | `props.color` falling back to `colors.text` | name + title text |
| `backgroundColor` | `"transparent"` | **not** `colors.primary` |

`media.logo` is **not** consumed. If a logo badge next to the name is wanted, the adapter should
draw its own `<Img>` at the card's left padding (`cardW * 0.07`, `cardH * 0.24`).
`headline`, `cta`, `primaryColor` are unused by this template.

### 3.4 Props to REMOVE from the adapter's public surface

- Upstream demo copy `"Alex Morgan"` / `"Head of Product, Acme Inc."` — always derived.
- `backgroundColor` — always `"transparent"`.
- Note: the card body's fill is **not** the `backgroundColor` prop — it is a hardcoded
  `linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))` with a
  `1px solid rgba(255,255,255,0.22)` border and `backdrop-filter: blur(14px)`. Over a bright video
  the card may be low-contrast; the adapter may draw a scrim behind it (its own element).

### 3.5 Animation timing and fps assumption

Module constants: `FPS = 30`, `DURATION_FRAMES = 120` (4.0 s at 30 fps).

| Window | Property | Behaviour |
|---|---|---|
| 0 → 28 | `cardIn` | `spring({ damping: 18, stiffness: 90, durationInFrames: 28 })`; the card starts `height * 0.18` below its resting position and slides up |
| 12 → 32 | `nameIn` | `spring({ damping: 16, stiffness: 110, durationInFrames: 20 })`; the name fades in and rises 12 px |
| 24 → 42 | `titleIn` | linear fade of the title (no spring) |
| 104 → 119 | `exitOpacity` | the whole card fades to 0 over the last 15 frames |
| — | `glowPulse` | `0.5 + 0.5 * sin(frame * 0.08)` — a continuous sine breathing on the inner accent glow (never lands on a dead frame) |

**fps assumption:** the component imports `useVideoConfig()` and uses `fps` for both springs (so they
are fps-independent), but the `titleIn` (24 → 42) and `exitOpacity` (104 → 119) windows are **raw
frame counts**. At 60 fps the exit fade would take twice as long. **Keep 30 fps.**

### 3.6 Hardcoded values that must be parameterised

| Value | Where | Problem | Action |
|---|---|---|---|
| `cardW = width * 0.42`, `cardH = height * 0.2` | geometry | relative to the composition | keep |
| `cardX = width * 0.06`, `restY = height * 0.74` | geometry | relative — the card sits bottom-left of the *composition* | keep. Because the upstream measures against the composition and the §0.1 wrapper scales the whole thing, the card lands at the bottom-left of the **box**, not of the composition. Choose the catalog `placement` so the box covers the area where the card should appear. |
| `radius = height * 0.022` | border radius | relative | keep |
| `padX = cardW * 0.07` | padding | relative | keep |
| `fontSize = height * 0.058` (name), `height * 0.026` (title) | text | relative | keep |
| `whiteSpace: "nowrap"` on both lines | text | **hard overflow risk** — a long business name or offer runs off the card and off the canvas | the adapter must **truncate** the strings it passes (≈ 28 characters for `nameText`, ≈ 40 for `titleText`) or the text will overflow. `whiteSpace` is not overridable through props. |
| `backdropFilter: blur(14px)` + `WebkitBackdropFilter` | card body | **rasteriser-dependent** | verify in the web renderer; if the blur is dropped the card becomes a translucent white gradient (still legible) |
| `boxShadow: 0 ${height*0.018}px ${height*0.05}px rgba(0,0,0,0.45)` | card body | relative | keep |
| accent bar `width = cardW * 0.012` | card body | relative | keep |
| `translateY(12px)` / `translateY(6px)` | name / title entrance | fixed px | negligible; keep |
| ambient wash `radial-gradient(120% 90% at 22% 88%, ${accentColor}22 0%, transparent 55%)` | full frame | a full-canvas low-alpha accent wash over the video | an intentional brand tint; it is not switchable. At 13 % alpha of the accent the video still reads. |

### 3.7 Player + web-renderer safety

- **`<Player>`:** safe. Springs + `interpolate` + `useVideoConfig`; no external assets.
- **`@remotion/web-renderer`:** **conditional.** The only at-risk feature is
  `backdrop-filter: blur(14px)`. If it is dropped the card still renders (translucent white
  gradient + 1 px white border + accent bar) — it simply loses the frosted look. **Verify visually
  in an exported frame before shipping.**
- `backdrop-filter` blends with the pixels behind the element. Over the user's `<Video>` that is
  the desired frosted-glass effect — but it also means the effect depends on the video being
  painted beneath in the same stacking context. The §0.1 scale-wrapper **does** create a stacking
  context (`transform: scale(s)`), so the blur will composite against the wrapper's backdrop
  rather than the video. If the blur must sample the video, render this design at `scale = 1` with
  no scale-wrapper transform (see §0.1 rule 1) and place the card with the upstream's own
  composition-relative geometry.

---

## 4. `end-card` → category `promo-cta`

### 4.1 Upstream component and export shape

```ts
// src/shared/personalization/templates/_upstream/end-card/EndCard.tsx
export const FPS = 30;
export const DURATION_FRAMES = 150;
export type EndCardProps = { ... };
export const defaultEndCardProps: EndCardProps = { ... };
export const EndCard: React.FC<EndCardProps>;
export default EndCard;
// NOTE: the internal `CtaButton` sub-component is NOT exported.
```

Import the **named** export `EndCard`. The CTA button is rendered internally — it cannot be
restyled or replaced through props.

### 4.2 Exact props accepted

```ts
export type EndCardProps = {
  title: string;       // required
  subtitle: string;    // required
  ctaText: string;     // required
  background: string;  // required — canvas fill AND CTA label colour
  titleColor: string;  // required
  accentColor: string; // required
};
```

All six required; no optional props.

### 4.3 Prop → brand mapping

| Upstream prop | Registry value | Notes |
|---|---|---|
| `title` | `textSlots.headline` (slot `field: 'headline'`, **primary**) | main title, `fontWeight 900`, `maxWidth = width * 0.85` |
| `subtitle` | `textSlots.offer` (slot `field: 'offer'`) | supporting line at `opacity * 0.7`, `letterSpacing 4`. Append `businessName` if the offer is short, e.g. `"20% off · Acme Co."`. |
| `ctaText` | `textSlots.cta` (slot `field: 'cta'`) | CTA pill label (the chevron is drawn automatically) |
| `titleColor` | `props.color` falling back to `colors.text` | title **and** subtitle (the subtitle is derived from `titleColor` at 70 % alpha) |
| `accentColor` | `colors.accent` | accent line, the two expanding rings, **and the CTA pill fill** |
| `background` | `colors.primary` (solid) | **see §4.4 — this must be a solid colour** |

`media.logo` is **not** consumed. If a logo is required in the card, the adapter draws its own
`<Img>` inside the card region.
`businessName` is folded into `subtitle` (see above).

### 4.4 THE `background` COUPLING (critical)

Inside the component:

```tsx
<CtaButton
  text={ctaText}
  delay={60}
  fillColor={accentColor}
  labelColor={background}   // ← the CTA label + chevron use the BACKGROUND colour
  fontSize={isPortrait ? width * 0.038 : height * 0.034}
/>
```

and the root is `<AbsoluteFill style={{ backgroundColor: background }}>`.

Consequences:

- `background = "transparent"` ⇒ the CTA label and the chevron are **invisible** (their colour
  becomes `transparent`). **Never pass `"transparent"` to this component.**
- `background` does double duty: it is the card fill *and* the CTA text colour. It must be a
  **solid, high-contrast** colour against `accentColor`.
- Because the root `AbsoluteFill` fills the whole frame with `background`, the component is **not**
  a transparent overlay. The §0.1 scale-wrapper makes it work: the wrapper is a scaled copy of the
  composition, so the component's opaque fill is confined to the **box**, and the box is a
  sub-region of the composition. Set the catalog `placement` so the box is the card area
  (e.g. `x = 0.5`, `y = 0.78`, `scale = 0.9` for a 16:9 composition) and the opaque fill stays
  inside the frame, with the video visible around it.

### 4.5 Recommended composition (bounded card region)

```tsx
const s = props.box.widthPx / Math.max(1, props.width)
<AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
  <AbsoluteFill
    style={{
      width: props.width, height: props.height,
      transform: s === 1 ? undefined : `scale(${s})`,
      transformOrigin: 'top left',
    }}
  >
    <EndCard
      title={slots.headline}
      subtitle={subtitle}
      ctaText={slots.cta}
      background={props.colors.primary}      // solid card fill == CTA label colour
      titleColor={props.color || props.colors.text}
      accentColor={props.colors.accent}
    />
  </AbsoluteFill>
</AbsoluteFill>
```

Notes:

- The wrapper's `overflow: 'hidden'` clips the component's full-frame fill to the box, and the
  scale-wrapper maps the composition-sized content into the box. Together they turn the opaque
  full-frame card into a **bounded brand-coloured panel** with the video visible around it.
- The upstream content is vertically centred *inside the composition*, so after scaling it lands in
  the middle of the box. Choose `placement.y` accordingly.
- The expanding rings are drawn at the centre of the **composition** (`min(width, height) * 0.8`),
  i.e. the centre of the box after scaling. They will be clipped by the box if the box is smaller
  than the ring — that reads fine as a motif, but be aware of it.
- Because `background` is now a solid brand colour, pick `colors.primary` with enough contrast
  against `colors.accent` for the CTA pill to be readable, and `colors.text` for `titleColor` with
  enough contrast against `colors.primary`.

### 4.6 Props to REMOVE from the adapter's public surface

- Upstream demo copy `"Thanks for watching"`, `"LEARN MORE AT OUR SITE"`, `"Visit our website"` —
  always derived from the brand.
- `background` — not a raw user input; it is `colors.primary` (or a contrast-checked variant
  chosen by the adapter).

### 4.7 Animation timing and fps assumption

Module constants: `FPS = 30`, `DURATION_FRAMES = 150` (5.0 s at 30 fps).

| Window | Property | Behaviour |
|---|---|---|
| 0 → 90 | `ringScale` | the two accent rings expand from `0.3` to `1.6` of the base size, `Easing.out(Easing.cubic)` |
| 0 → 30 → 90 | `ringOpacity` | 0 → 0.25 → 0.1 |
| 8 → … | `titleScale` | `spring({ damping: 12, mass: 1, stiffness: 80 })` starting at frame 8 |
| 8 → 24 | `titleOpacity` | linear fade-in of the title |
| 24 → 40 | `subOpacity`, `subY` | the subtitle fades in and rises 20 px, `Easing.out(Easing.cubic)` |
| 60 → 74.4 | CTA entrance | `enterProgress` over `delay → delay + DUR_NORMAL * 1.6` (DUR_NORMAL = 9) — the pill rises 34 px and scales `0.94 → 1.0` |
| 60 → | CTA sheen | a 38 %-wide white band sweeps the pill every `fps * 2.4` s (= 72 frames at 30 fps) |
| 60 → | CTA chevron nudge | `3 * sin((relFrame / fps) * π)` — a slow 3 px lean |

**fps assumption:** the component imports `useVideoConfig()` and uses `fps` for the springs (fps-
independent) and for the sheen period and the chevron nudge (wall-clock correct). The remaining
markers (`0→90`, `8→24`, `24→40`, `delay 60`) are **raw frame counts**, so at 60 fps the
choreography stretches. **Keep 30 fps.**

### 4.8 Hardcoded values that must be parameterised

| Value | Where | Problem | Action |
|---|---|---|---|
| `isPortrait = height > width` | layout switch | the *composition* ratio, not the box ratio | fine — keep. For **9:16** and **4:5** the portrait branch is used. |
| `titleFontSize = isPortrait ? width * 0.075 : height * 0.075` | title | relative | keep |
| `subFontSize = isPortrait ? width * 0.03 : height * 0.03` | subtitle | relative | keep |
| CTA `fontSize = isPortrait ? width * 0.038 : height * 0.034` | CTA | relative | keep |
| `padding: 64`, `gap: 24 \| 32`, CTA `marginTop: 60 \| 80` | layout | **fixed px** | at 1080×1920 a 64 px padding is proportionally small but acceptable; the scale-wrapper rescales it with the box anyway. |
| accent line `80 × 4` | layout | **fixed px** | small but fixed; acceptable |
| ring size `min(width,height) * 0.8 / 0.5` | layout | relative to the **composition** | inside a bounded box the outer ring is clipped; acceptable as a motif. |
| `padV = fontSize * 0.66`, `padH = fontSize * 1.5`, `chevron = fontSize * 0.62` | CTA pill | relative | keep |
| chevron `strokeWidth = 3.4` | CTA pill | **fixed px** | acceptable |
| `boxShadow: 0 ${fontSize*0.5}px ${fontSize*1.4}px rgba(0,0,0,0.35)` | CTA pill | relative | keep |
| `borderRadius: 999` | CTA pill | fine | keep |

### 4.9 Player + web-renderer safety

- **`<Player>`:** safe. `useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring`, `Easing`,
  inline styles and one inline SVG `<polyline>`. No external assets, no filters, no blend modes.
- **`@remotion/web-renderer`:** safe. Everything used is basic CSS (`background`, `border-radius`,
  `box-shadow`, `transform`, `opacity`, `linear-gradient`) plus an inline SVG polyline — all
  rasterise identically in a browser DOM capture.
- **Overlay note:** the component is *not* transparent by design; the §0.1 scale-wrapper + the
  box clip is what makes it overlay-able.

---

## 5. `bokeh-circles` → category `visual-effect`

### 5.1 Upstream component and export shape

```ts
// src/shared/personalization/templates/_upstream/bokeh-circles/BokehCircles.tsx
export const FPS = 30;
export const DURATION_FRAMES = 150;
export type BokehCirclesProps = { ... };
export const defaultBokehCirclesProps: BokehCirclesProps = { ... };
export const BokehCircles: React.FC<BokehCirclesProps>;
export default BokehCircles;
```

Import the **named** export `BokehCircles`.

### 5.2 Exact props accepted

```ts
export type BokehCirclesProps = {
  colors: string[];    // required — circle tint palette
  baseColor: string;   // required — canvas fill
  count: number;       // required — number of circles
  label?: string;      // optional — centred label text
  labelColor?: string; // optional — label colour
};
```

`label` and `labelColor` are the only optional props.

### 5.3 Prop → brand mapping

| Upstream prop | Registry value | Notes |
|---|---|---|
| `baseColor` | `"transparent"` | **not** `colors.primary` — a fill would hide the video |
| `colors` | `[colors.accent, colors.primary, colors.accent, colors.text]` | The upstream assigns `colors[Math.floor(seededRandom(i * 17 + 6) * colors.length)]` to each circle, i.e. pseudo-randomly. Pass **3–4** brand-derived colours. The upstream default palette is warm cream (`#ffd1a4`, `#ffe6c7`, `#fff3d6`, `#ffc89e`) — substitute the brand palette. |
| `count` | `14`–`18` (upstream default is `24`) | 24 blurred 80–320 px discs is a heavy full-frame effect. Over a customer's video, start lower. Motion constant, not a brand input. |
| `label` | `undefined` | **must** be `undefined`. A centred 72 px label would sit on top of the video with no purpose. |
| `labelColor` | `props.color` falling back to `colors.text` | unused while `label` is `undefined`, but pass it for type-safety |

`businessName`, `headline`, `offer`, `cta`, `logoUrl` are **not** used by this template.

### 5.4 Props to REMOVE from the adapter's public surface

- `label` — always `undefined`; the upstream default is the demo string `"Background Demo"` and it
  must never be reachable.
- `baseColor` — always `"transparent"`.
- `count` / `colors` — internal motion constants, not brand inputs (`colors` is derived from the
  brand palette).

### 5.5 Animation timing and fps assumption

Module constants: `FPS = 30`, `DURATION_FRAMES = 150` (5.0 s at 30 fps). The effect is a
**seamless loop** — no entrance, no exit; it is meant to run for the whole composition.

Per circle (all deterministic, seeded by index):

| Quantity | Formula |
|---|---|
| phase `t` | `frame * 0.02 * speed + phase` |
| x (as % of width) | `seedX * 100 + sin(t) * 8` |
| y (as % of height) | `seedY * 100 + cos(t * 0.8) * 8` |
| size pulse | `1 + sin(t * 1.2) * 0.15` |
| base size | `80 + seededRandom(i * 7 + 3) * 240` px |
| speed | `0.4 + seededRandom(i * 11 + 4) * 0.8` |
| opacity | `0.25 + seededRandom(i * 19 + 7) * 0.45` |

The `label` opacity ramp (10 → 25) is irrelevant while `label` is `undefined`.

**fps assumption:** the component does **not** import `useVideoConfig()` — all motion is a function
of the raw frame number, so the drift speed is **frames-per-second dependent**. At 30 fps the orbs
drift slowly; at 60 fps they would drift twice as fast. **Keep 30 fps.**

### 5.6 Hardcoded values that must be parameterised

| Value | Where | Problem | Action |
|---|---|---|---|
| `sizeBase = 80 + seededRandom * 240` px | circle size | **fixed px** — at 1920×1080 a 320 px orb is ~30 % of the frame height; at 1080×1920 it is proportionally smaller | acceptable; reduce `count` for small canvases |
| `blur(20px)` | circle filter | **fixed px** and **rasteriser-dependent** | verify; see §5.7 |
| `mixBlendMode: "screen"` | circle | **stacking-context dependent** | see §5.7 — the single most important integration constraint for this template |
| `left`/`top` as `%` strings | circle position | relative | keep |
| label `fontSize: 72`, `letterSpacing: 4` | label | fixed px | irrelevant (label is `undefined`) |

### 5.7 Player + web-renderer safety — and the stacking-context trap

- **`<Player>`:** safe. `useCurrentFrame` only (plus `React.useMemo` for the circle list).
  Deterministic — the upstream uses its own `seededRandom` (a `sin`-based hash), **not**
  `Math.random()`, so the layout is identical on every render.
- **`@remotion/web-renderer`:** **conditional**, for two reasons:
  1. **`filter: blur(20px)`** on 14–24 absolutely positioned divs must rasterise. Chromium supports
     it; verify in an exported frame. If the blur is dropped, the effect becomes hard-edged
     translucent discs — clearly wrong, so this one **must** be verified, not just eyeballed.
  2. **`mix-blend-mode: "screen"`** blends the circles with whatever is painted *below them in the
     same stacking context*. Over the customer's `<Video>` that is the desired "light leak" look —
     **but the §0.1 scale-wrapper's `transform: scale(s)` creates a stacking context**, and the
     parent wrapper in `PersonalizationComposition` adds its own entrance `transform` and
     `opacity < 1`. Inside an isolated stacking context the circles blend against a transparent
     backdrop and render as flat translucent discs.
     → **Mitigation:** for this design, render it **full-frame** — catalog `placement` with
     `scale = 1` and `x = 0.5`, `y = 0.5` so `s === 1` and the adapter omits the transform
     entirely (§0.1 rule 1) — and give the layer `animation: 'none'` and `opacity: 1` so the
     parent never creates a stacking context either. Then `screen` blends against the video.
     During any fade the blend is briefly confined; that is acceptable.
     → **Fallback:** if the blend or the blur cannot be relied on, use the upstream `starfield`
     template (`baseColor="transparent"`, `label=undefined`) — it uses only plain CSS gradients, no
     filter and no blend mode, and is the safest "particles over video" effect in the surveyed
     repos. It is not copied into `_upstream/`; copy it verbatim from
     `free-remotion-templates/src/components/starfield/Starfield.tsx` and add the same header block
     if you take that route.

---

## 6. Adapter prop surface & catalog registration

### 6.1 The props a design component receives

From `src/shared/personalization/templates/types.ts` (`RemotionDesignComponentProps`):

```ts
{
  text: string                                  // value of the PRIMARY text slot
  textSlots: Record<string, string>             // by slot.key
  colors: { primary, accent, text, backgroundDim }
  media: Record<'logo' | 'product' | 'service', string | null>
  box: { leftPx, topPx, widthPx, heightPx }
  width, height, frame, fps
  opacity: number                                // layer opacity
  color: string                                  // layer colour override, or the brand text colour
  fontFamily?: string
}
```

### 6.2 Proposed design ids and catalog bindings

| Category (`RemotionDesignCategory`) | Suggested design `id` | Upstream | `textSlots` | `colors` | `media` | `animation` | `placement` | `aspectRatios` | `capabilities` |
|---|---|---|---|---|---|---|---|---|---|
| `animated-headline` | `bounce-in-headline` | `BounceInHeadline` | `headline` (primary, field `headline`) | `text` → the text colour | — | `durationInFrames: 36`, `delayInFrames: 0`, `easing: 'damped abs(sin) bounce'` | `x 0.5, y 0.5, scale 0.8, opacity 1, animation 'none'` | all four | `preview: true`, `browserExport: true` |
| `logo-reveal` | `logo-stroke-draw` | `LogoStrokeDraw` | `businessName` (primary, field `businessName`) | `accent` → ring/underline, `text` → monogram + wordmark | `logo` (optional) | `durationInFrames: 110`, `delayInFrames: 0`, `easing: 'interpolate + spring(damping:14, stiffness:90)'` | `x 0.5, y 0.45, scale 0.7, opacity 1, animation 'none'` | all four | `preview: true`, `browserExport: true` |
| `lower-third` | `lower-third-glass-card` | `LowerThirdGlassCard` | `businessName` (primary, field `businessName`), `role` (field `offer`) | `accent` → bar + glow, `text` → name + title | `logo` (optional) | `durationInFrames: 120`, `delayInFrames: 0`, `easing: 'spring(damping:18, stiffness:90)'` | `x 0.5, y 0.8, scale 1, opacity 1, animation 'none'` | all four | `preview: true`, `browserExport: true`, `notes: 'backdrop-filter blur(14px) — verify in the exported frame'` |
| `promo-cta` | `end-card` | `EndCard` | `headline` (primary, field `headline`), `offer` (field `offer`), `cta` (field `cta`) | `accent` → rings + CTA pill, `text` → title, `primary` → card fill | `logo` (optional) | `durationInFrames: 150`, `delayInFrames: 0`, `easing: 'spring(damping:12, stiffness:80) + cubic'` | `x 0.5, y 0.5, scale 0.85, opacity 1, animation 'none'` | all four | `preview: true`, `browserExport: true`, `notes: 'background prop is opaque by design — the box bounds it'` |
| `visual-effect` | `bokeh-circles` | `BokehCircles` | — | `accent` + `primary` → the circle palette | — | `durationInFrames: 150` (seamless loop), `delayInFrames: 0`, `easing: 'sin/cos drift loop'` | `x 0.5, y 0.5, scale 1, opacity 1, animation 'none'` (see §5.7) | all four | `preview: true`, `browserExport: true`, `notes: 'filter: blur(20px) + mix-blend-mode: screen — verify in the exported frame'` |

`RemotionDesignSource` for every one of them:

```ts
{
  repository: 'free-remotion-templates',
  repositoryUrl: 'https://github.com/RenderComp/free-remotion-templates',
  sourcePath: 'src/components/<dir>/<File>.tsx',
  license: 'MIT',
  attribution:
    '© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates',
}
```

### 6.3 Every adapter must

- render inside an `<AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>`;
- render the upstream inside a composition-sized child scaled into `props.box` (§0.1 rule 1);
- pass `"transparent"` for every background prop **except** `EndCard.background`;
- never spread the upstream `default*Props` objects;
- truncate the `nameText` / `titleText` it passes to the lower third (§3.6);
- be deterministic and free of network access.

---

## 7. Acceptance checklist for the integration agent

- [ ] The design layer is wrapped in `<Sequence from={layer.startFrame}>` so the upstream's
      `useCurrentFrame()` is **layer-local** (§0.1.2).
- [ ] Each design renders the upstream inside a composition-sized child scaled into `props.box`
      (§0.1 rule 1), with no `transform` when `s === 1`.
- [ ] No upstream demo copy is visible in any of the five designs.
- [ ] The customer's video is visible behind every overlay (no opaque full-canvas fill) — including
      the `promo-cta`, where the opaque region is the box only.
- [ ] `colors.accent`, `colors.primary` and `colors.text` all reach the templates.
- [ ] `media.logo` is rendered by the adapter (the upstream logo template has no image prop) or is
      explicitly declared optional.
- [ ] 16:9, 9:16, 1:1 and 4:5 all render without clipped or overflowing text (watch
      `whiteSpace: "nowrap"` in the lower third and the `fontSize: 130` headline).
- [ ] The composition still runs at **30 fps**; no template's timing was re-scaled.
- [ ] The `backdrop-filter` (lower third), the `filter: blur` and the `mix-blend-mode: screen`
      (bokeh) are **verified in an exported frame**, not only in the `<Player>` preview.
- [ ] The bokeh design is **not** nested inside an element that creates a stacking context, or it
      is knowingly accepted as a non-blended bokeh.
- [ ] The MIT attribution string + the verbatim MIT permission notice are rendered in the product
      UI, and every design's `source.attribution` carries that string.
- [ ] No npm dependency was added; no upstream file was edited.
