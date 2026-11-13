# Upstream Remotion templates — SmartVideo GO AI, Phase 1

Five upstream Remotion templates copied **verbatim** into this folder as the source of truth for the
Phase 1 personalization templates. Every file carries a provenance header; the upstream code below
that header is byte-for-byte identical to the upstream repository (verified with `diff`).

**Do not edit the upstream bodies.** The integration layer lives outside this folder and adapts
these components through their props. See [`ADAPTER-SPEC.md`](./ADAPTER-SPEC.md) for the contract.

Full survey of all 138 templates across the three upstream repos:
[`docs/REMOTION_TEMPLATE_INVENTORY.md`](../../../../../docs/REMOTION_TEMPLATE_INVENTORY.md).

---

## Provenance (shared by all five)

| | |
|---|---|
| **Upstream repository** | `https://github.com/deangilmoreremix/free-remotion-templates` |
| **Canonical upstream URL** | `https://github.com/RenderComp/free-remotion-templates` (from the repo's own `package.json` → `repository`) |
| **Branch / commit** | `main` @ `f648980e528defb7594e24c6447055f0540f340b` (2026-09-07) |
| **Upstream project** | RenderComp — 50 free MIT-licensed Remotion templates |
| **License** | MIT — `Copyright (c) 2026 Trimora Inc.` (upstream `LICENSE` file at repo root) |
| **Attribution required?** | **Yes — mandatory.** MIT requires the copyright notice and permission notice to be retained in all copies or substantial portions. |
| **Upstream Remotion version** | `remotion@4.0.518` (target repo runs `remotion@4.0.499` — API-compatible for everything used here) |
| **Upstream React version** | `react@^19` (target repo runs `react@^19`) |
| **Upstream assets** | **none.** Upstream `ASSETS.md` records 0 bundled font/image/audio/video files; all graphics are inline SVG/CSS and all fonts are system stacks. |

### Exact attribution string that must be rendered in the product UI

```
© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates
```

Where it must appear:

1. In the product's **credits / "About" / legal** surface (mandatory — MIT).
2. In the **export credits** surface shown next to a finished branded video, alongside the
   verbatim MIT permission notice and the `Copyright (c) 2026 Trimora Inc.` line.
3. Optionally in the template-picker UI, as a per-template credit line:
   *“Bounce-In Headline — © 2026 Trimora Inc. (RenderComp), MIT”*.

**Do not** display the MIT-BRITO or MIT-RVE attribution strings for these five templates — no
`remotion-video-templates` or `remotion-templates` code is present in this folder.

### npm packages required beyond `remotion`

| Package | Needed by | Why |
|---|---|---|
| `react` | all five | `React.FC`, `React.useMemo` |
| `react-dom` | all five | peer of `react` for the composition tree (already present in the target repo) |
| — nothing else — | all five | no `@remotion/renderer`, no `@remotion/player`, no `@remotion/media`, no `@remotion/google-fonts`, no `@remotion/zod-types`, no `zod`, no `@remotion/transitions`, no `next/image` |

All five use **system font stacks only** — `-apple-system, "Segoe UI", Roboto, sans-serif`. There is
no `@font-face`, no webfont download, no `staticFile()` call, and no `<Video>`/`<Audio>` element.

---

## 1. `bounce-in-headline`

| | |
|---|---|
| **Template id** | `bounce-in-headline` |
| **Category** | animated headline |
| **Upstream repo** | `https://github.com/deangilmoreremix/free-remotion-templates` (canonical: `https://github.com/RenderComp/free-remotion-templates`) |
| **Upstream file path** | `src/components/bounce-in-headline/BounceInHeadline.tsx` |
| **License** | MIT — `Copyright (c) 2026 Trimora Inc.` |
| **Attribution to display** | `© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates` |
| **Files copied** | `bounce-in-headline/BounceInHeadline.tsx` (only) |
| **Upstream export shape** | named `BounceInHeadline` (React.FC) **and** `export default BounceInHeadline`; named `BounceInHeadlineProps` type; named `defaultBounceInHeadlineProps`; named `FPS = 30`, `DURATION_FRAMES = 120` |
| **npm packages beyond `remotion`** | `react` only |

**Upstream props signature**

```ts
export type BounceInHeadlineProps = {
  headline: string;      // the text
  background: string;    // canvas fill colour  → set "transparent" for overlay use
  color: string;         // text colour
  bounces: number;       // number of bounces (default 3)
  height: number;        // max bounce height in px (default 120)
  delay: number;         // entrance delay in FRAMES (default 8)
  duration: number;      // total effect length in FRAMES (default 36)
};
```

**Required assets:** none — system font stack, plain CSS (`opacity` + `translateY`).
**Overlay-able:** yes — `background` is a plain colour prop.
**Browser-export compatible:** yes — no `staticFile`, no `<Video>`/`<Audio>`, no renderer imports.

---

## 2. `logo-stroke-draw`

| | |
|---|---|
| **Template id** | `logo-stroke-draw` |
| **Category** | logo reveal |
| **Upstream repo** | `https://github.com/deangilmoreremix/free-remotion-templates` (canonical: `https://github.com/RenderComp/free-remotion-templates`) |
| **Upstream file path** | `src/components/logo-stroke-draw/LogoStrokeDraw.tsx` |
| **License** | MIT — `Copyright (c) 2026 Trimora Inc.` |
| **Attribution to display** | `© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates` |
| **Files copied** | `logo-stroke-draw/LogoStrokeDraw.tsx` (only) |
| **Upstream export shape** | named `LogoStrokeDraw` (React.FC) **and** `export default LogoStrokeDraw`; named `LogoStrokeDrawProps` type; named `defaultLogoStrokeDrawProps`; named `FPS = 30`, `DURATION_FRAMES = 110` |
| **npm packages beyond `remotion`** | `react` only |

**Upstream props signature**

```ts
export type LogoStrokeDrawProps = {
  backgroundColor: string; // canvas fill → set "transparent" for overlay use
  accentColor: string;     // ring stroke, badge fill, underline, glow
  textColor: string;       // monogram + wordmark + shine band
  monogram: string;        // single character drawn inside the badge
  brandText: string;       // wordmark under the badge
};
```

**Required assets:** none — system font stack, inline SVG (`strokeDasharray`, `clipPath`).
**Overlay-able:** yes — `backgroundColor` is a plain colour prop; every dimension is a fraction of
`width`/`height`.
**Browser-export compatible:** yes — no `staticFile`, no `<Video>`/`<Audio>`, no renderer imports.
**Note:** the component has **no image prop** — it draws a monogram badge + wordmark, it does not
render a logo file. See `ADAPTER-SPEC.md` §2 for how `brand.logoUrl` is handled.

---

## 3. `lower-third-glass-card`

| | |
|---|---|
| **Template id** | `lower-third-glass-card` |
| **Category** | lower third |
| **Upstream repo** | `https://github.com/deangilmoreremix/free-remotion-templates` (canonical: `https://github.com/RenderComp/free-remotion-templates`) |
| **Upstream file path** | `src/components/lower-third-glass-card/LowerThirdGlassCard.tsx` |
| **License** | MIT — `Copyright (c) 2026 Trimora Inc.` |
| **Attribution to display** | `© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates` |
| **Files copied** | `lower-third-glass-card/LowerThirdGlassCard.tsx` (only) |
| **Upstream export shape** | named `LowerThirdGlassCard` (React.FC) **and** `export default LowerThirdGlassCard`; named `LowerThirdGlassCardProps` type; named `defaultLowerThirdGlassCardProps`; named `FPS = 30`, `DURATION_FRAMES = 120` |
| **npm packages beyond `remotion`** | `react` only |

**Upstream props signature**

```ts
export type LowerThirdGlassCardProps = {
  backgroundColor: string; // canvas fill → set "transparent" for overlay use
  accentColor: string;     // accent bar, inner glow, backdrop wash
  textColor: string;       // name + title text
  nameText: string;        // primary line (person / business name)
  titleText: string;       // secondary line (role / offer)
};
```

**Required assets:** none — system font stack, plain CSS incl. `backdrop-filter: blur(14px)`.
**Overlay-able:** yes — `backgroundColor` is a plain colour prop; the card is anchored bottom-left.
**Browser-export compatible:** conditional — `backdrop-filter` must be verified in the browser
rasteriser (the card degrades gracefully if the blur is dropped).

---

## 4. `end-card`

| | |
|---|---|
| **Template id** | `end-card` |
| **Category** | promotional CTA |
| **Upstream repo** | `https://github.com/deangilmoreremix/free-remotion-templates` (canonical: `https://github.com/RenderComp/free-remotion-templates`) |
| **Upstream file path** | `src/components/end-card/EndCard.tsx` |
| **License** | MIT — `Copyright (c) 2026 Trimora Inc.` |
| **Attribution to display** | `© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates` |
| **Files copied** | `end-card/EndCard.tsx` (only) |
| **Upstream export shape** | named `EndCard` (React.FC) **and** `export default EndCard`; named `EndCardProps` type; named `defaultEndCardProps`; named `FPS = 30`, `DURATION_FRAMES = 150`. The internal `CtaButton` sub-component is **not** exported. |
| **npm packages beyond `remotion`** | `react` only |

**Upstream props signature**

```ts
export type EndCardProps = {
  title: string;       // headline
  subtitle: string;    // supporting line
  ctaText: string;     // CTA button label
  background: string;  // canvas fill AND CTA label colour (see note)
  titleColor: string;  // title + subtitle colour
  accentColor: string; // accent line, expanding rings, CTA pill fill
};
```

**Required assets:** none — system font stack, inline SVG chevron.
**Overlay-able:** partial — `background` doubles as the CTA label colour
(`labelColor={background}`), so it **cannot** be made transparent. Overlay by bounding the
component to a card region — see `ADAPTER-SPEC.md` §4.
**Browser-export compatible:** yes — no `staticFile`, no `<Video>`/`<Audio>`, no renderer imports.

---

## 5. `bokeh-circles`

| | |
|---|---|
| **Template id** | `bokeh-circles` |
| **Category** | visual effect |
| **Upstream repo** | `https://github.com/deangilmoreremix/free-remotion-templates` (canonical: `https://github.com/RenderComp/free-remotion-templates`) |
| **Upstream file path** | `src/components/bokeh-circles/BokehCircles.tsx` |
| **License** | MIT — `Copyright (c) 2026 Trimora Inc.` |
| **Attribution to display** | `© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates` |
| **Files copied** | `bokeh-circles/BokehCircles.tsx` (only) |
| **Upstream export shape** | named `BokehCircles` (React.FC) **and** `export default BokehCircles`; named `BokehCirclesProps` type; named `defaultBokehCirclesProps`; named `FPS = 30`, `DURATION_FRAMES = 150` |
| **npm packages beyond `remotion`** | `react` only |

**Upstream props signature**

```ts
export type BokehCirclesProps = {
  colors: string[];      // circle tint palette (assigned pseudo-randomly)
  baseColor: string;     // canvas fill → set "transparent" for overlay use
  count: number;         // number of circles (default 24)
  label?: string;        // centred label text — MUST stay undefined for overlay use
  labelColor?: string;   // label colour (unused when label is undefined)
};
```

**Required assets:** none — system font stack, plain CSS (`radial-gradient`, `filter: blur(20px)`,
`mix-blend-mode: screen`).
**Overlay-able:** yes — `baseColor` is a plain colour prop and `label` is optional.
**Browser-export compatible:** conditional — `filter: blur(20px)` and `mix-blend-mode: screen` must
be verified in the browser rasteriser. `starfield` is the documented fallback (it uses no filter and
no blend mode) if the blend cannot be relied on.

---

## File map

```
src/shared/personalization/templates/_upstream/
├── README.md                          ← this file (manifest + attribution)
├── ADAPTER-SPEC.md                    ← contract for the integration agent
├── bokeh-circles/BokehCircles.tsx
├── bounce-in-headline/BounceInHeadline.tsx
├── end-card/EndCard.tsx
├── logo-stroke-draw/LogoStrokeDraw.tsx
└── lower-third-glass-card/LowerThirdGlassCard.tsx
```

No `node_modules`, no `package.json`, no `remotion.config.ts`, no app configuration and no upstream
helper folder were copied — none of the five selected templates import anything other than
`react` and `remotion`.
