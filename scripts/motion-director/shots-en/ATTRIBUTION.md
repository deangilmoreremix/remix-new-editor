# Shot card sources and licensing notes (48 added in 2026-08; 38 remain after the 2026-10 trim)

The motion techniques in this batch of shot cards were researched from publicly released product promos and open-source project homepages.
**All implementations are re-implemented from scratch**: the repository contains no
clips, screenshots, art assets or brand elements from the original videos; the copy, color schemes and UI content in the implementations are all
neutral placeholder templates. The original authors did not participate in this project; the sources noted on the cards are only for tribute and research traceability
("reference only, re-implemented").

## Legal boundaries (important)

- Abstract motion **techniques/methods** (timing structure, easing approach, choreography logic) generally belong to the
  realm of methods and ideas; but the **specific expression** (the original video's imagery, art, copy, brand elements,
  recognizable overall audiovisual presentation) is protected by copyright, trademark and other rights. This project studies only the former,
  and avoids copying the latter through complete rewriting, de-branding and placeholdering.
- A source work being "publicly released" **does not mean** it grants permission to replicate or derive from it. This table records research
  traceability, not proof of license; for sources without explicit permission, what we rely on is the practice of "technique reference +
  independent rewrite, no original material", not any authorization from the rights holder.
- If any rights holder believes that a card's implementation still constitutes a copy of their specific expression, please open an issue,
  and we will promptly adjust or remove the corresponding content and attribution.

## Source list

Note: the table below records sources by **research batch** (one batch corresponds to one reference video or one reference site,
covering the several cards derived from that batch); the card files themselves carry no source attribution — per-card attribution is in the appendix
"Per-card source mapping" at the end.

| Research batch | Source | Type | Status |
|---|---|---|---|
| anime.js | https://animejs.com/ official site demos (GitHub: juliangarnier/anime) | Open-source project homepage (MIT project; copyright in the artistic presentation of the site demos belongs to the author) | Technique reference, re-implemented; none of its code or art used |
| remotion-bits.dev | https://remotion-bits.dev/ | Open-source example collection | Technique reference, re-implemented; none of its code used |
| x.com/amirdzm | Two motion works publicly released on X (the ~13s "Storyboard → Result" etc.) | Personal work (publicly released, no permission to replicate) | Technique reference, re-implemented; no original material |
| x.com/1amanly | Motion works publicly released on X | Same as above | Same as above |
| x.com/Jerrythe2d | Motion work publicly released on X (~84s) | Same as above | Same as above |
| x.com/bohdanmotion | Motion work publicly released on X (~26s) | Same as above | Same as above |
| x.com/thiswillblossom | SaaS concept ad publicly released on X (~2.1s four-panel grid) | Same as above | Same as above |
| x.com/tvnxty | Firecrawl brand/product promo (~66s, publicly released) | Commercial promo (publicly released, no permission to replicate) | Technique reference, re-implemented; no original material |
| x.com/aizal_mp4 (individual cards) | Willow Voice product promo (work by motion designer aizal, ~41s) | Commercial promo (publicly released, no permission to replicate) | Technique reference, re-implemented; no original material |
| Douyin 观机社 (dy09) | Edit of an Honor AI concept video posted by the Douyin account "观机社" (~22.6s) | Reposted edit; the underlying content is brand-oriented concept content (involving Honor brand elements) | Technique reference, re-implemented; brand wordmark replaced with a neutral placeholder word |
| Douyin 江经怜 (dy08, individual cards) | Work publicly released by the Douyin account "江经怜" (~19.4s vertical) | Personal work (publicly released, no permission to replicate) | Technique reference, re-implemented; no original material |
| reference/brand-scan | Customized from reference images provided by the user | Internal requirement | Original implementation |

> Known precision limitation: X / Douyin sources were recorded at the time per account homepage, and the
> specific post URLs were not kept one by one (the original videos were only kept locally during research and were not committed). The table has tried to add
> the duration and content description of identifiable works; for per-post traceability, search the corresponding account using these.

## Per-card source mapping

Correspondence between the 38 remaining cards and the research batches (from the research-period record mapping original-video time ranges):

| Source | Cards |
|---|---|
| anime.js official site demos | `radial-wave`, `value-stagger-gradient` |
| remotion-bits.dev | `basic-3d-scene`, `blur-slide`, `card-stack`, `carousel-3d`, `cursor-flyover`, `flying-words`, `fracture`, `glitch-cycle`, `gradient-transition`, `list-reveal`, `mosaic-reframe`, `terminal-3d` |
| x.com/1amanly | `avatar-bracket-carousel`, `countdown-arc-scatter`, `pill-chip-slot-cycle-handled`, `radial-ripple-phone-chips` |
| x.com/Jerrythe2d | `bezier-source-converge-merge`, `chip-grid-single-select-blackout`, `doc-park-left-pill-deal`, `picker-carousel-feature-cycle`, `scan-bracket-sweep`, `vertical-word-roll-blur-cycle` |
| x.com/aizal_mp4 (Willow Voice) | `aurora-bloom-bg-flip`, `glass-pill-dictation-typing` |
| x.com/amirdzm (work a) | `brace-expand`, `grain-dissolve` |
| x.com/bohdanmotion | `outline-word-fill`, `word-relay-geometry` |
| x.com/thiswillblossom | `quad-split-parallel-scenes` |
| x.com/tvnxty (Firecrawl promo) | `product-card-progressive-assemble`, `research-card-stack-scroll` |
| Douyin 观机社 | `logo-shrink-wordmark-lockup`, `white-flash-logo-simplify-cut` |
| Customized from user reference images (brand-scan) | `assemble-then-type-flyin`, `scanline-annotate-focus`, `scanline-assemble-flyin` |
