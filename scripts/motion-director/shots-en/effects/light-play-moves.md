---
name: light-play-moves
one_liner: Two light-effect styles: spotlight-sweep spotlight sweeping over text, sheen single-point light sweep
use_when: Treating light as another kind of brushstroke (sweep/wipe): dark-field title reveal (A), crowning the hero card (B)
length: A 170f ~5.7s / B 150f ~5s
energy: A medium / B low
tags: typography
---

## Intent
"Light" in the library has only ever had the single spot technique of spotlight-hero-card; these two styles make light into
a system, two brushstrokes with two duties: A is the **sweep**: a nearly invisible title in a dark field is swept bright by a swinging cone
of light, wherever the light goes becomes bright; the difference from spotlight-hero-card is that one lights a card,
this one sweeps text; B is the **wipe**: a 45° highlight band slowly sweeps once across a deep-ink hero card,
clipped by the rounded corners, a silent crowning.
All on dark bases or dark heroes: **brightening on a white base is invisible** (ruling) is the foundation of this whole card.

## Variants
| Style | Approach | Use when |
|----|------|------|
| A spotlight-sweep | Two layers of the same text: a dark version at 0.07 always on, a bright version with a radial mask following the light spot; a pendulum follow-spot swings two and a half round trips, damped to a stop dead centre, then an iris opens to full brightness and holds (demo title "Craft the shot.", closing on the video-shotcraft wordmark) | Dark-field big title reveal openers |
| B sheen-sweep | As the deep-ink card (demo: titanium-black metal card, etched with the video-shotcraft monochrome logo mark and wordmark) turns toward the light source, a 115° highlight band sweeps once, clipped with overflow hidden rounded corners | A single crowning during the hero card's still segment |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A contrast | Dark version 0.07 vs full brightness 1.0; the demo is warm white #f8efe2 serif type on a wine-red black velvet curtain (#1a0a0d→#070203), the curtain itself also lit only inside the light spot | Contrast is everything in this style; dark version >0.15 and there's no "lighting up" any more |
| A light spot | ellipse 360px (hard core + long soft edge), pendulum: x = 960+600·sin θ·env, θ starting at −π/2 (far left), period 50f, running 2.25 periods until f121; y follows a sagging arc (lowest 44px at centre); env smooths to 0 after the first round trip, x and speed reaching zero together at f121 (a pure sin would brake hard at the centre where it's fastest); on switching on, a tungsten warm-up flickers twice at 4–10f | f121–141 iris opens 360→1080px to full brightness (out-cubic), the light cone linearly narrowing into a soft top light (spread/dissipation decoupling ruling) |
| B highlight band | Width 2× card width, 115° gradient: wide soft light 0.14 + narrow bright core 0.5 (warm white, screen), sweeping once at 58–90f with swift; in the same segment the card rotateY 21°→14° (turning toward the light source = the physical motivation of the sweep); brushed-metal texture under the band and a bright copy of the etched text revealed by the same mask | A 0.5 core is loud enough on titanium black without smearing; two-sided clamp + conditional mounting ensure it sweeps only once |
| Remove the mask | Sweep light (B) conditionally mounted, unmounted as soon as the sweep finishes; A's light cone narrows into a permanent soft top light | Residual layers at opacity 0 are still composited every frame: unmount unused light layers outright |
| Ending | A ~30f / B ~55f hold; during the hold only very slow motion remains (A floating dust and top light breathing, B card rotateY turning another 1.5°) | No handheld shake (Q3) |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- **Light effects total ≤2 per film**: light is the fastest technique to cheapen a film; every card flashing once
  equals a cheap template
- Style B passed on a high-standard retry: the old rejection (ruling of 2026-07-13) targeted the implementation of the time not looking good,
  not the approach being unworkable; the four constraints = single point + hero + rounded-corner clip + sweeps only once; violate any
  one and it's back in the rejection zone
- A dark base is the foundation: both styles depend entirely on a dark base/dark hero; for light effects on a white base skip this card altogether
- A and spotlight-hero-card: pick one per film, both are "spotlight" vocabulary

## Reference implementation
demos/effects/light-play-moves/
(SheenSweepRetry.tsx / SpotlightSweepReveal.tsx)
